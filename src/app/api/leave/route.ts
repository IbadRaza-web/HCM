import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser, ApiError } from "@/lib/auth";
import { ok, fail, parseBody, handler } from "@/lib/api";
import { applyLeave } from "@/services/leave";

export const GET = handler(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  let q = supabaseAdmin
    .from("leave_requests")
    .select("*, employees(full_name, employee_code, departments(name)), leave_types(label, code), profiles!leave_requests_decided_by_fk(full_name)")
    .order("created_at", { ascending: false }).limit(100);
  if (user.role === "employee") {
    if (!user.employeeId) return ok({ requests: [] });
    q = q.eq("employee_id", user.employeeId);
  }
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) {
    // fall back without the optional profile join
    let q2 = supabaseAdmin.from("leave_requests")
      .select("*, employees(full_name, employee_code), leave_types(label, code)")
      .order("created_at", { ascending: false }).limit(100);
    if (user.role === "employee") q2 = q2.eq("employee_id", user.employeeId!);
    if (status) q2 = q2.eq("status", status);
    const { data: d2 } = await q2;
    return ok({ requests: d2 ?? [] });
  }
  return ok({ requests: data ?? [] });
});

export const POST = handler(async (req) => {
  const user = await requireUser(["employee"]);
  if (!user.employeeId) throw new ApiError(400, "No employee record linked to your account");
  const p = await parseBody(req, z.object({
    leave_type_id: z.string().uuid("Choose a leave type"),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick an end date"),
    reason: z.string().min(3, "Please give a reason"),
  }));
  const result = await applyLeave(user.id, user.employeeId, p);
  return ok(result, 201);
});
