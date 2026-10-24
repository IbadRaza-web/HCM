/** Money helpers: round to 2 decimals; decimal-safe enough for the demo ranges we use. */
export function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface SalaryComponents {
  basic: number;
  hra: number;
  medical: number;
  gross: number;
}

/** Brief rule: gross = 1.5 × basic (HRA 40% of basic, medical 10% of basic). */
export function salaryComponents(basic: number): SalaryComponents {
  const b = r2(basic);
  const hra = r2(b * 0.4);
  const medical = r2(b * 0.1);
  return { basic: b, hra, medical, gross: r2(b + hra + medical) };
}

/**
 * Illustrative progressive annual tax slab (per brief):
 * ≤600k: 0 · ≤1.2M: 5% above 600k · ≤2.4M: 30k + 15% above 1.2M
 * ≤3.6M: 210k + 25% above 2.4M · else: 510k + 35% above 3.6M
 */
export function annualTax(annualGross: number): number {
  const a = Math.max(0, annualGross);
  if (a <= 600_000) return 0;
  if (a <= 1_200_000) return r2((a - 600_000) * 0.05);
  if (a <= 2_400_000) return r2(30_000 + (a - 1_200_000) * 0.15);
  if (a <= 3_600_000) return r2(210_000 + (a - 2_400_000) * 0.25);
  return r2(510_000 + (a - 3_600_000) * 0.35);
}

/** Monthly tax from a monthly gross (annualize → slab → ÷12), per the brief. */
export function monthlyTax(monthlyGross: number): number {
  return r2(annualTax(r2(monthlyGross * 12)) / 12);
}
