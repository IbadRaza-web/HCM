import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";

/** Employee's own payslips (server-side scope: forced to own employee_id). */
export const GET = handler(async () => {
  const user = await requireUser();
  if (!user.employeeId) return ok({ payslips: [] });
  const { data } = await supabaseAdmin
    .from("payslips")
    .select("id, net, gross, tax, deduction, payroll_runs(period_month, status)")
    .eq("employee_id", user.employeeId)
    .order("created_at", { ascending: false });
  return ok({ payslips: data ?? [] });
});
