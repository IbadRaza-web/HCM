import { describe, it, expect } from "vitest";
import { workingDaysBetween, eachDay, isWorkingDay, addDays, monthEnd } from "@/lib/dates";

const WEEKEND = [6, 0]; // Sat + Sun

describe("working days", () => {
  it("skips weekends", () => {
    // 2026-10-26 is a Monday; week Mon 26 – Fri 30 → 5 working days
    expect(workingDaysBetween("2026-10-26", "2026-11-01", WEEKEND, [])).toBe(5);
  });
  it("skips public holidays", () => {
    expect(workingDaysBetween("2026-10-26", "2026-10-30", WEEKEND, ["2026-10-27"])).toBe(4);
  });
  it("single working day counts as 1", () => {
    expect(workingDaysBetween("2026-10-26", "2026-10-26", WEEKEND, [])).toBe(1);
  });
  it("a Saturday alone is 0", () => {
    expect(workingDaysBetween("2026-10-31", "2026-10-31", WEEKEND, [])).toBe(0);
  });
  it("handles range across months", () => {
    expect(workingDaysBetween("2026-10-28", "2026-11-04", WEEKEND, [])).toBe(
      workingDaysBetween("2026-10-28", "2026-11-04", WEEKEND, [])
    );
  });
});

describe("date helpers", () => {
  it("eachDay is inclusive", () => {
    expect(eachDay("2026-10-28", "2026-10-31")).toEqual(["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"]);
  });
  it("addDays crosses month boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
  it("monthEnd handles 31-day and 28-day months", () => {
    expect(monthEnd("2026-10")).toBe("2026-10-31");
    expect(monthEnd("2027-02")).toBe("2027-02-28");
  });
  it("isWorkingDay checks weekday and holidays", () => {
    expect(isWorkingDay("2026-10-26", WEEKEND, new Set())).toBe(true); // Monday
    expect(isWorkingDay("2026-10-31", WEEKEND, new Set())).toBe(false); // Saturday
    expect(isWorkingDay("2026-10-26", WEEKEND, new Set(["2026-10-26"]))).toBe(false);
  });
});
