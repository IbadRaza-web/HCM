import { describe, it, expect } from "vitest";
import { annualTax, monthlyTax, salaryComponents, r2 } from "@/lib/money";

describe("annual tax slab (progressive, illustrative per brief)", () => {
  it("first slab 0–600k is tax free", () => {
    expect(annualTax(0)).toBe(0);
    expect(annualTax(600_000)).toBe(0);
  });
  it("5% between 600k and 1.2M", () => {
    expect(annualTax(700_000)).toBe(5_000);
    expect(annualTax(1_200_000)).toBe(30_000);
  });
  it("30k + 15% between 1.2M and 2.4M", () => {
    expect(annualTax(2_400_000)).toBe(210_000);
  });
  it("210k + 25% between 2.4M and 3.6M", () => {
    expect(annualTax(3_600_000)).toBe(510_000);
  });
  it("510k + 35% above 3.6M", () => {
    expect(annualTax(4_600_000)).toBe(860_000);
  });
});

describe("monthly tax", () => {
  it("annualizes gross ×12, applies slab, divides by 12", () => {
    // 60,000/month → 720,000/yr → (720k−600k)×5% = 6,000 → 500/month
    expect(monthlyTax(60_000)).toBe(500);
    // 100,000/month → 1.2M/yr → 30,000/yr → 2,500/month
    expect(monthlyTax(100_000)).toBe(2_500);
    // 30,000/month → 360k/yr → 0
    expect(monthlyTax(30_000)).toBe(0);
  });
});

describe("salary components", () => {
  it("gross = basic + 40% HRA + 10% medical = 1.5 × basic", () => {
    expect(salaryComponents(50_000)).toEqual({
      basic: 50_000, hra: 20_000, medical: 5_000, gross: 75_000,
    });
    expect(salaryComponents(50_000).gross).toBe(75_000);
  });
  it("rounds to 2 decimals", () => {
    expect(r2(10.005)).toBe(10.01);
  });
});
