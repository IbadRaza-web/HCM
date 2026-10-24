import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (_req, ctx) => {
  await requireUser(["admin", "hr"]);
  const { id } = await ctx.params;
  const { data: run } = await supabaseAdmin.from("payroll_runs").select("*").eq("id", id).maybeSingle();
  if (!run) return ok({ error: "Payroll run not found" }, 404);
  const { data: payslips } = await supabaseAdmin
    .from("payslips")
    .select("*, employees(full_name, employee_code, departments(name))")
    .eq("payroll_run_id", id).order("net", { ascending: false });
  return ok({ run, payslips: payslips ?? [] });
});
