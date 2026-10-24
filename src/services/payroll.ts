import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/auth";
import { getSettings, writeAudit, notify, getHolidaySet } from "@/lib/org";
import { monthStart, monthEnd, todayISO, fmtMonth } from "@/lib/dates";
import { payrollCalc } from "./payroll-calc";

interface EmployeeLike {
  id: string; full_name: string; employee_code: string; basic_salary: string | number;
  join_date: string; exit_date: string | null; status: string;
}

/** Loads attendance + approved leave from the DB, then delegates to the pure payrollCalc. */
export async function computePayslip(
  emp: EmployeeLike, month: string,
  settings: { weekend_days: number[] }, holidays: Set<string>, today: string
) {
  const start = monthStart(month), end = monthEnd(month);
  const [{ data: atts }, { data: leaves }] = await Promise.all([
    supabaseAdmin.from("attendance").select("work_date, status")
      .eq("employee_id", emp.id).gte("work_date", start).lte("work_date", end),
    supabaseAdmin.from("leave_requests")
      .select("start_date, end_date, leave_types(paid)")
      .eq("employee_id", emp.id).eq("status", "approved")
      .lte("start_date", end).gte("end_date", start),
  ]);
  const calc = payrollCalc({
    basic: Number(emp.basic_salary),
    joinDate: emp.join_date,
    exitDate: emp.exit_date,
    month,
    weekendDays: settings.weekend_days,
    holidays,
    today,
    attendance: new Map((atts ?? []).map((a) => [a.work_date, a.status])),
    leaves: (leaves ?? []).map((l) => ({
      start: l.start_date, end: l.end_date,
      paid: (l.leave_types as unknown as { paid: boolean })?.paid !== false,
    })),
  });
  return {
    employee_id: emp.id,
    basic: calc.basic, hra: calc.hra, medical: calc.medical, gross: calc.gross,
    working_days: calc.working_days, eligible_days: calc.eligible_days,
    absent_days: calc.absent_days, unpaid_days: calc.unpaid_days, half_days: calc.half_days,
    deduction: calc.deduction, taxable_annual: calc.taxable_annual, tax: calc.tax, net: calc.net,
    details: {
      employee_name: emp.full_name, employee_code: emp.employee_code,
      daily_rate: calc.daily_rate, deduction_days: calc.deduction_days,
      evaluated_days: calc.evaluated_days, present_days: calc.present_days, paid_leave_days: calc.paid_leave_days,
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

  const holidays = await getHolidaySet(Number(m.slice(0, 4)));
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
