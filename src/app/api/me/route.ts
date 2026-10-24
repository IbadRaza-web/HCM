import { getSessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ok, fail, handler } from "@/lib/api";

/** Current user + linked employee, for the profile page. */
export const GET = handler(async () => {
  const user = await getSessionUser();
  if (!user) return ok({ error: "Not signed in" }, 401);
  let employee = null;
  if (user.employeeId) {
    const { data } = await supabaseAdmin
      .from("employees").select("id, employee_code, phone, address, join_date, departments(name)")
      .eq("id", user.employeeId).maybeSingle();
    employee = data;
  }
  return ok({ name: user.name, email: user.email, role: user.role, employee });
});
