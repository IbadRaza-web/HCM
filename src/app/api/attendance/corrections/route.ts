import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser, ApiError } from "@/lib/auth";
import { ok, fail, parseBody, handler } from "@/lib/api";
import { requestCorrection } from "@/services/attendance";

export const GET = handler(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  let q = supabaseAdmin
    .from("attendance_corrections")
    .select("*, employees(full_name, employee_code)")
    .order("created_at", { ascending: false }).limit(50);
  if (user.role === "employee") {
    if (!user.employeeId) return ok({ corrections: [] });
    q = q.eq("employee_id", user.employeeId);
  }
  if (url.searchParams.get("pending") === "1") q = q.eq("status", "pending");
  const { data } = await q;
  return ok({ corrections: data ?? [] });
});

export const POST = handler(async (req) => {
  const user = await requireUser(["employee"]);
  if (!user.employeeId) throw new ApiError(400, "No employee record linked to your account");
  const p = await parseBody(req, z.object({
    work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    requested_check_in: z.string().optional().nullable(),
    requested_check_out: z.string().optional().nullable(),
    reason: z.string().min(3, "Please give a reason"),
  }));
  await requestCorrection(user.id, user.employeeId, {
    work_date: p.work_date,
    requested_check_in: p.requested_check_in || null,
    requested_check_out: p.requested_check_out || null,
    reason: p.reason,
  });
  return ok({ ok: true }, 201);
});
