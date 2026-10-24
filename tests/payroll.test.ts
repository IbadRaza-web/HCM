import { describe, it, expect } from "vitest";
import { payrollCalc } from "@/services/payroll-calc";
import { monthStart, monthEnd, eachDay, isWorkingDay } from "@/lib/dates";
import { r2 } from "@/lib/money";

// October 2026 has 22 working days with Sat/Sun weekend
const M = "2026-10";
const WD = [6, 0];
const NO_HOLIDAYS: string[] = [];
const TODAY = "2026-10-31";

/** Attendance map with every working day of the month marked present. */
function presentAll(): Map<string, string> {
  const m = new Map<string, string>();
  for (const day of eachDay(monthStart(M), monthEnd(M)))
    if (isWorkingDay(day, WD, new Set())) m.set(day, "present");
  return m;
}

function calc(over: Partial<Parameters<typeof payrollCalc>[0]> = {}) {
  return payrollCalc({
    basic: 50_000,
    joinDate: "2026-01-01",
    exitDate: null,
    month: M,
    weekendDays: WD,
    holidays: NO_HOLIDAYS,
    today: TODAY,
    attendance: presentAll(),
    leaves: [],
    ...over,
  });
}

describe("payrollCalc", () => {
  it("full attendance month pays full gross, no deductions", () => {
    const r = calc();
    expect(r.working_days).toBe(22);
    expect(r.gross).toBe(75_000);
    expect(r.eligible_days).toBe(22);
    expect(r.deduction).toBe(0);
    expect(r.net).toBe(r.gross - r.tax);
  });

  it("no attendance records at all → every evaluated day is absent (brief rule)", () => {
    const r = calc({ attendance: new Map() });
    expect(r.absent_days).toBe(22);
    expect(r.deduction_days).toBe(22);
    expect(r.deduction).toBeCloseTo(r2(75_000 / 22) * 22, 1);
  });

  it("gross = 1.5 × basic with HRA 40% + medical 10%", () => {
    const r = calc();
    expect(r.hra).toBe(20_000);
    expect(r.medical).toBe(5_000);
    expect(r.basic + r.hra + r.medical).toBe(75_000);
  });

  it("each absent day deducts gross ÷ working days", () => {
    const attendance = presentAll();
    attendance.set("2026-10-05", "absent");
    attendance.set("2026-10-06", "absent");
    const r = calc({ attendance });
    const daily = r2(75_000 / 22); // 3409.09
    expect(r.deduction_days).toBe(2);
    expect(r.deduction).toBeCloseTo(daily * 2, 1);
  });

  it("half day deducts 0.5 × daily rate", () => {
    const attendance = presentAll();
    attendance.set("2026-10-05", "half_day");
    const r = calc({ attendance });
    expect(r.deduction_days).toBe(0.5);
    expect(r.deduction).toBeCloseTo(r2(75_000 / 22) * 0.5, 1);
  });

  it("approved paid leave is NOT deducted", () => {
    // on leave days there is no attendance record
    const attendance = presentAll();
    for (const d of eachDay("2026-10-05", "2026-10-09")) attendance.delete(d);
    const r = calc({ attendance, leaves: [{ start: "2026-10-05", end: "2026-10-09", paid: true }] });
    expect(r.deduction).toBe(0);
    expect(r.paid_leave_days).toBe(5);
  });

  it("unpaid leave IS deducted at the daily rate", () => {
    const attendance = presentAll();
    for (const d of eachDay("2026-10-05", "2026-10-09")) attendance.delete(d);
    const r = calc({ attendance, leaves: [{ start: "2026-10-05", end: "2026-10-09", paid: false }] });
    expect(r.unpaid_days).toBe(5);
    expect(r.deduction).toBeCloseTo(r2(75_000 / 22) * 5, 1);
  });

  it("unpaid leave spanning a weekend deducts working days only", () => {
    // Fri 23 → Mon 26 = 2 working days (23, 26) since 24/25 are weekend
    const attendance = presentAll();
    for (const d of eachDay("2026-10-23", "2026-10-26")) attendance.delete(d);
    const r = calc({ attendance, leaves: [{ start: "2026-10-23", end: "2026-10-26", paid: false }] });
    expect(r.unpaid_days).toBe(2);
  });

  it("mid-month joiner is prorated on eligible days", () => {
    // joins Mon 2026-10-05 → eligible = 20 of 22 working days
    const r = calc({ joinDate: "2026-10-05" });
    expect(r.eligible_days).toBe(20);
    expect(r.deduction).toBe(0);
    expect(r.taxable_annual).toBeCloseTo(75_000 * (20 / 22) * 12, 0);
  });

  it("leaver is prorated through the exit date", () => {
    // last day Fri 2026-10-16 → eligible = 12 working days (1..16 minus weekends 3,4,10,11)
    const r = calc({ exitDate: "2026-10-16" });
    expect(r.eligible_days).toBe(12);
  });

  it("never counts future days as absent when run mid-month", () => {
    const r = calc({ today: "2026-10-15", attendance: new Map() });
    expect(r.evaluated_days).toBe(11); // 1..15 minus weekends 3,4,10,11
    expect(r.absent_days).toBe(11);
    expect(r.working_days).toBe(22); // denominator stays full-month
  });

  it("public holiday inside the month shrinks the denominator and isn't deducted", () => {
    const r = calc({ holidays: ["2026-10-05"] });
    expect(r.working_days).toBe(21);
    expect(r.deduction).toBe(0);
  });

  it("tax uses the progressive slab on annualized gross", () => {
    const r = calc();
    // 75,000 × 12 = 900,000 → (900k − 600k) × 5% = 15,000/yr → 1,250/month
    expect(r.taxable_annual).toBe(900_000);
    expect(r.tax).toBe(1_250);
  });
});
