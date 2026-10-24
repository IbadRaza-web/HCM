import { monthStart, monthEnd, eachDay, isWorkingDay } from "@/lib/dates";
import { salaryComponents, monthlyTax, r2 } from "@/lib/money";

/**
 * Pure payroll calculation — no database access, fully unit-testable.
 * - working days: scheduled days in the month after weekends/holidays
 * - eligible days: intersected with employment dates (join/exit proration)
 * - deductions: absent + unpaid + 0.5 × half days; approved paid leave is free
 * - only days up to `today` are evaluated (no future absences)
 */
export interface PayrollCalcInput {
  basic: number;
  joinDate: string;
  exitDate: string | null;
  month: string; // YYYY-MM
  weekendDays: number[];
  holidays: Iterable<string>;
  today: string;
  /** work_date → status for this employee's attendance in the month */
  attendance: Map<string, string>;
  /** approved leave periods covering the month, with paid flag */
  leaves: { start: string; end: string; paid: boolean }[];
}

export function payrollCalc(p: PayrollCalcInput) {
  const start = monthStart(p.month), end = monthEnd(p.month);
  const comp = salaryComponents(p.basic);
  const holidaySet = p.holidays instanceof Set ? p.holidays : new Set(p.holidays);
  const monthDays = eachDay(start, end).filter((x) => isWorkingDay(x, p.weekendDays, holidaySet));
  const fullWD = monthDays.length;
  const eligible = monthDays.filter(
    (x) => x >= p.joinDate && (!p.exitDate || x <= p.exitDate));
  const evaluable = eligible.filter((x) => x <= p.today);

  let absent = 0, half = 0, unpaid = 0, presentish = 0, paidLeave = 0;
  for (const day of evaluable) {
    const st = p.attendance.get(day);
    if (st === "absent") absent++;
    else if (st === "half_day") half++;
    else if (st) presentish++;
    else if (p.leaves.some((l) => l.start <= day && day <= l.end && !l.paid)) unpaid++;
    else if (p.leaves.some((l) => l.start <= day && day <= l.end && l.paid)) paidLeave++;
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
    basic: comp.basic, hra: comp.hra, medical: comp.medical, gross: comp.gross,
    working_days: fullWD, eligible_days: eligible.length,
    absent_days: absent, unpaid_days: unpaid, half_days: half,
    daily_rate: dailyRate, deduction_days: deductionDays,
    deduction, taxable_annual: taxableAnnual, tax, net,
    evaluated_days: evaluable.length, present_days: presentish, paid_leave_days: paidLeave,
  };
}
