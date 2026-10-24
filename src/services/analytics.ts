import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSettings, getHolidaySet } from "@/lib/org";
import { monthStart, monthEnd, eachDay, isWorkingDay, todayISO, addDays } from "@/lib/dates";
import { r2 } from "@/lib/money";
import { leaveBalances } from "./leave";

export interface Filters { from?: string; to?: string; departmentId?: string }

function yearStartOf(today: string) { return today.slice(0, 4) + "-01-01"; }

async function activeEmployees(f: Filters, asOf: string) {
  let q = supabaseAdmin.from("employees").select("id, full_name, employee_code, gender, join_date, exit_date, department_id, basic_salary, departments(name)")
    .in("status", ["active", "probation"])
    .lte("join_date", asOf)
    .or(`exit_date.is.null,exit_date.gt.${asOf}`);
  if (f.departmentId) q = q.eq("department_id", f.departmentId);
  const { data } = await q;
  return data ?? [];
}

/** Attendance rate per the brief: (present+late+missing_checkout+0.5×half) ÷ (expected working days − approved leave). */
function rate(numer: number, denom: number) {
  return denom > 0 ? Math.round((numer / denom) * 1000) / 10 : 0;
}

export async function adminKpis(f: Filters) {
  const today = f.to || todayISO();
  const yStart = yearStartOf(today);
  const emps = await activeEmployees(f, today);

  // headcount at start of year (for attrition denominator)
  let startQ = supabaseAdmin.from("employees").select("id", { count: "exact", head: true })
    .in("status", ["active", "probation"]).lte("join_date", yStart)
    .or(`exit_date.is.null,exit_date.gt.${yStart}`);
  if (f.departmentId) startQ = startQ.eq("department_id", f.departmentId);
  const { count: hcStart } = await startQ;

  const { count: exitsYtd } = await supabaseAdmin.from("employees").select("id", { count: "exact", head: true })
    .lt("exit_date", today).gte("exit_date", yStart);
  const avgHc = ((hcStart ?? 0) + emps.length) / 2 || emps.length;
  const attrition = avgHc > 0 ? r2((exitsYtd ?? 0) / avgHc * 100) : 0;

  const m = today.slice(0, 7);
  const { data: runSlips } = await supabaseAdmin
    .from("payslips").select("net, gross, payroll_runs!inner(period_month, status)")
    .eq("payroll_runs.status", "finalized").eq("payroll_runs.period_month", monthStart(m));
  const payrollMonth = (runSlips ?? []).reduce((a, s) => a + Number(s.net), 0);
  const avgSalary = emps.length ? r2(emps.reduce((a, e) => a + Number(e.basic_salary), 0) / emps.length) : 0;

  const byDept = new Map<string, number>();
  emps.forEach((e) => {
    const k = e.departments?.name ?? "Unassigned";
    byDept.set(k, (byDept.get(k) ?? 0) + 1);
  });
  const gender = { male: 0, female: 0, other: 0 };
  emps.forEach((e) => { if (e.gender && e.gender in gender) gender[e.gender as keyof typeof gender]++; });

  return {
    headcount: emps.length, attritionYtd: attrition, exitsYtd: exitsYtd ?? 0,
    payrollCostMonth: r2(payrollMonth), avgBasicSalary: avgSalary,
    headcountByDept: [...byDept.entries()].map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count),
    gender,
  };
}

export async function hrKpis(f: Filters) {
  const today = f.to || todayISO();
  const settings = await getSettings();
  if (!settings) throw new Error("Setup incomplete");
  const holidays = await getHolidaySet(Number(today.slice(0, 4)));
  const emps = await activeEmployees(f, today);
  const ids = emps.map((e) => e.id);

  const [{ data: todayAtt }, { data: onLeave }, { data: pendingLeave }, { data: pendingCorr }] = await Promise.all([
    ids.length ? supabaseAdmin.from("attendance").select("employee_id, status").eq("work_date", today).in("employee_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length ? supabaseAdmin.from("leave_requests").select("employee_id").eq("status", "approved").lte("start_date", today).gte("end_date", today).in("employee_id", ids)
      : Promise.resolve({ data: [] }),
    supabaseAdmin.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabaseAdmin.from("attendance_corrections").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  // month attendance analytics (per department) + 14-day trend + top late-comers
  const m = today.slice(0, 7), start = monthStart(m), end = monthEnd(m);
  const evalEnd = end < today ? end : today;
  const [{ data: monthAtt }, { data: monthLeave }] = await Promise.all([
    ids.length ? supabaseAdmin.from("attendance").select("employee_id, work_date, status").gte("work_date", start).lte("work_date", end).in("employee_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length ? supabaseAdmin.from("leave_requests").select("employee_id, start_date, end_date, working_days, leave_types(label, code)")
      .eq("status", "approved").lte("start_date", end).gte("end_date", start).in("employee_id", ids)
      : Promise.resolve({ data: [] }),
  ]);

  const empById = new Map(emps.map((e) => [e.id, e]));
  const attByEmp = new Map<string, Map<string, string>>();
  (monthAtt ?? []).forEach((a) => {
    if (!attByEmp.has(a.employee_id)) attByEmp.set(a.employee_id, new Map());
    attByEmp.get(a.employee_id)!.set(a.work_date, a.status);
  });
  const leaveCover = (empId: string, day: string) =>
    (monthLeave ?? []).some((l) => l.employee_id === empId && l.start_date <= day && day <= l.end_date);

  const deptStats = new Map<string, { present: number; expected: number; absent: number; late: number }>();
  const lateCountByEmp = new Map<string, number>();
  const trendMap = new Map<string, { numer: number; denom: number }>();

  for (const e of emps) {
    const dept = e.departments?.name ?? "Unassigned";
    const ds = deptStats.get(dept) ?? { present: 0, expected: 0, absent: 0, late: 0 };
    const att = attByEmp.get(e.id) ?? new Map();
    for (const day of eachDay(start, evalEnd)) {
      if (!isWorkingDay(day, settings.weekend_days, holidays)) continue;
      if (day < e.join_date || (e.exit_date && day > e.exit_date)) continue;
      const st = att.get(day);
      if (leaveCover(e.id, day)) continue; // approved leave out of denominator
      ds.expected++;
      const t = trendMap.get(day) ?? { numer: 0, denom: 0 };
      t.denom++;
      if (st === "present" || st === "missing_checkout") { ds.present++; t.numer++; }
      else if (st === "late") { ds.present++; ds.late++; t.numer++; lateCountByEmp.set(e.id, (lateCountByEmp.get(e.id) ?? 0) + 1); }
      else if (st === "half_day") { ds.present += 0.5; t.numer += 0.5; }
      else ds.absent++;
      trendMap.set(day, t);
    }
    deptStats.set(dept, ds);
  }

  const topLate = [...lateCountByEmp.entries()]
    .map(([id, lates]) => ({ name: empById.get(id)?.full_name ?? "—", lates }))
    .sort((a, b) => b.lates - a.lates).slice(0, 5);

  const leaveByType = new Map<string, number>();
  (monthLeave ?? []).forEach((l) => {
    const k = (l.leave_types as { label: string })?.label ?? "Leave";
    // count only days inside this month
    const days = eachDay(l.start_date < start ? start : l.start_date, l.end_date > end ? end : l.end_date)
      .filter((x) => isWorkingDay(x, settings.weekend_days, holidays)).length;
    leaveByType.set(k, (leaveByType.get(k) ?? 0) + days);
  });

  const statusCount = (s: string) => (todayAtt ?? []).filter((a) => a.status === s).length;
  return {
    today: {
      present: statusCount("present"), late: statusCount("late"),
      half_day: statusCount("half_day"), on_leave: (onLeave ?? []).length,
      absent: Math.max(0, emps.length - (todayAtt ?? []).length - (onLeave ?? []).length),
    },
    pendingApprovals: { leave: pendingLeave ?? 0, corrections: pendingCorr ?? 0 },
    month: {
      byDept: [...deptStats.entries()].map(([department, s]) => ({
        department,
        attendanceRate: rate(s.present, s.expected),
        latePct: rate(s.late, s.present + s.late || s.present),
        absenteeism: rate(s.absent, s.expected),
      })),
      trend: [...trendMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, t]) => ({ date, rate: rate(t.numer, t.denom) })),
      topLate,
      leaveByType: [...leaveByType.entries()].map(([type, days]) => ({ type, days })),
    },
  };
}

export async function employeeKpis(employeeId: string) {
  const settings = await getSettings();
  if (!settings) throw new Error("Setup incomplete");
  const today = todayISO();
  const weekStart = addDays(today, -((new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7)); // Monday
  const [{ data: todayAtt }, { data: weekAtt }, { data: lateCount }, balances, { data: lastPayslip }] = await Promise.all([
    supabaseAdmin.from("attendance").select("*").eq("employee_id", employeeId).eq("work_date", today).maybeSingle(),
    supabaseAdmin.from("attendance").select("hours_worked").eq("employee_id", employeeId).gte("work_date", weekStart).lte("work_date", today),
    supabaseAdmin.from("attendance").select("id", { count: "exact", head: true }).eq("employee_id", employeeId).eq("status", "late").gte("work_date", today.slice(0, 7) + "-01"),
    leaveBalances(employeeId),
    supabaseAdmin.from("payslips").select("id, net, gross, payroll_runs(period_month, status)").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(1),
  ]);
  const weekHours = r2((weekAtt ?? []).reduce((a, x) => a + Number(x.hours_worked ?? 0), 0));
  return {
    todayAttendance: todayAtt ?? null,
    weekHours, weekTarget: 40,
    lateCountMonth: lateCount ?? 0,
    balances,
    lastPayslip: lastPayslip?.[0] ?? null,
  };
}
