import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { ok, fail, parseBody, handler } from "@/lib/api";
import { runPayroll } from "@/services/payroll";

export const GET = handler(async () => {
  await requireUser(["admin", "hr"]);
  const { data } = await supabaseAdmin
    .from("payroll_runs")
    .select("*, payslips(count)")
    .order("period_month", { ascending: false });
  return ok({ runs: data ?? [] });
});

export const POST = handler(async (req) => {
  const user = await requireUser(["hr"]);
  const { month } = await parseBody(req, z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM"),
  }));
  const result = await runPayroll(user.id, month);
  return ok(result, 201);
});
