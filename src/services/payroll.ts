import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/auth";
import { getSettings, writeAudit, notify } from "@/lib/org";
import { monthStart, monthEnd, eachDay, isWorkingDay, todayISO, fmtMonth } from "@/lib/dates";
import { salaryComponents, monthlyTax, r2 } from "@/lib/money";

interface EmployeeLike {
  id: string; full_name: string; employee_code: string; basic_salary: string | number;
  join_date: string; exit_date: string | null; status: string;
}

/**
 * Pure payroll calculation for one employee and month.
 * - full-month working days: scheduled days after weekends/holidays
 * - eligible days: intersected with employment dates (join/exit proration)
 * - deductions: absent + unpaid leave + 0.5 × half days (approved paid leave is free)
 * - only days that have already happened are evaluated (no future absences)
 */
export async function computePayslip(
  emp: EmployeeLike, month: string,
  settings: { weekend_days: number[] }, holidays: Set<string>, today: string
) {
  const start = monthStart(month), end = monthEnd(month);
  const comp = salaryComponents(Number(emp.basic_salary));
  const monthDays = eachDay(start, end).filter((x) => isWorkingDay(x, settings.weekend_days, holidays));
  const fullWD = monthDays.length;
  const eligible = monthDays.filter(
    (x) => x >= emp.join_date && (!emp.exit_date || x <= emp.exit_date));
  const evaluable = eligible.filter((x) => x <= today);

  const [{ data: atts }, { data: leaves }] = await Promise.all([
    supabaseAdmin.from("attendance").select("work_date, status")
      .eq("employee_id", emp.id).gte("work_date", start).lte("work_date", end),
    supabaseAdmin.from("leave_requests")
      .select("start_date, end_date, leave_types(paid)")
      .eq("employee_id", emp.id).eq("status", "approved")
      .lte("start_date", end).gte("end_date", start),
  ]);
  const attMap = new Map((atts ?? []).map((a) => [a.work_date, a.status]));
  const leaveCovers = (day: string, paid: boolean) =>
    (leaves ?? []).some(
      (l) => l.start_date <= day && day <= l.end_date && (l.leave_types as { paid: boolean }).paid === paid);

  let absent = 0, half = 0, unpaid = 0, presentish = 0, paidLeave = 0;
  for (const day of evaluable) {
    const st = attMap.get(day);
    if (st === "absent") absent++;
    else if (st === "half_day") half++;
    else if (st) presentish++;
    else if (leaveCovers(day, false)) unpaid++;
    else if (leaveCovers(day, true)) paidLeave++;
    else absent++;
  }

  const dailyRate = fullWD > 0 ? r2(comp.gross / fullWD) : 0;
  const deductionDays = r2(absent + unpaid + 0.5 * half);
  const deduction = r2(dailyRate * deductionDays);
  const proratedGross = fullWD > 0 ? r2(comp.gross * (eligible.length / fullWD)) : comp.gross;
  const taxableAnnual = r2(proratedGross * 12);
  const tax = monthlyTax(proratedGross);
  const net = r2(proratedGross - deduction - tax);

  return {
    employee_id: emp.id,
    basic: comp.basic, hra: comp.hra, medical: comp.medical, gross: comp.gross,
    working_days: fullWD, eligible_days: eligible.length,
    absent_days: absent, unpaid_days: unpaid, half_days: half,
    deduction, taxable_annual: taxableAnnual, tax, net,
    details: {
      employee_name: emp.full_name, employee_code: emp.employee_code,
      daily_rate: dailyRate, deduction_days: deductionDays,
      evaluated_days: evaluable.length, present_days: presentish, paid_leave_days: paidLeave,
      formula: "gross=1.5×basic; daily=gross/full-month working days; deduct absent+unpaid+0.5×half; tax=slab(gross×12)/12",
    },
  };
}

/** Create or recompute the draft payroll run for a month (HR). */
export async function runPayroll(actorProfileId: string, month: string) {
  const settings = await getSettings();
  if (!settings) throw new ApiError(400, "Company setup is not complete");
  const m = monthStart(month);
  const { data: run } = await supabaseAdmin.from("payroll_runs").select("*").eq("period_month", m).maybeSingle();
  if (run?.status === "finalized") throw new ApiError(409, `${fmtMonth(m)} is finalized and locked`);

  let runId = run?.id;
  if (!runId) {
    const { data: created, error } = await supabaseAdmin.from("payroll_runs")
      .insert({ period_month: m, created_by: actorProfileId }).select().single();
    if (error || !created) throw new ApiError(500, "Could not create payroll run");
    runId = created.id;
  }

  const holidays = await (await import("@/lib/org")).getHolidaySet(Number(m.slice(0, 4)));
  const today = todayISO();
  const { data: employees } = await supabaseAdmin.from("employees")
    .select("*").in("status", ["active", "probation"]).lte("join_date", monthEnd(m));
  const list = (employees ?? []).filter((e) => !e.exit_date || e.exit_date >= m);

  await supabaseAdmin.from("payslips").delete().eq("payroll_run_id", runId);
  const rows = [];
  for (const e of list) rows.push(await computePayslip(e, m, settings, holidays, today));
  if (rows.length) {
    const { error } = await supabaseAdmin.from("payslips").insert(rows);
    if (error) throw new ApiError(500, "Could not save payslips");
  }
  await writeAudit({ actorId: actorProfileId, action: "payroll.run", entityType: "payroll_runs", entityId: runId, after: { month: m, payslips: rows.length } });
  return { run_id: runId, month: m, payslips: rows.length };
}

/** Admin-only one-way lock. Employees are notified their payslip is ready. */
export async function finalizePayrun(adminProfileId: string, runId: string) {
  const { data: run } = await supabaseAdmin.from("payroll_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) throw new ApiError(404, "Payroll run not found");
  if (run.status === "finalized") throw new ApiError(409, "This run is already finalized");

  const { error } = await supabaseAdmin.from("payroll_runs").update({
    status: "finalized", finalized_by: adminProfileId, finalized_at: new Date().toISOString(),
  }).eq("id", runId);
  if (error) throw new ApiError(500, "Could not finalize run");

  const { data: slips } = await supabaseAdmin.from("payslips").select("employee_id").eq("payroll_run_id", runId);
  const ids = (slips ?? []).map((s) => s.employee_id);
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id").in("employee_id", ids);
    for (const p of profiles ?? []) await notify(p.id, "payslip", "Payslip ready",
      `Your payslip for ${fmtMonth(run.period_month)} is available.`);
  }
  await writeAudit({ actorId: adminProfileId, action: "payroll.finalize", entityType: "payroll_runs", entityId: runId, before: { status: "draft" }, after: { status: "finalized" } });
}
