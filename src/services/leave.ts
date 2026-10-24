import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/auth";
import { getSettings, writeAudit, notify } from "@/lib/org";
import { workingDaysBetween } from "@/lib/dates";

export interface LeaveTypeBalance {
  id: string; code: string; label: string; paid: boolean;
  yearly_quota: number | null; used: number; remaining: number | null;
}

export async function leaveTypes() {
  const { data } = await supabaseAdmin.from("leave_types").select("*").eq("active", true).order("code");
  return data ?? [];
}

export async function leaveBalances(employeeId: string, year?: number): Promise<LeaveTypeBalance[]> {
  const y = year ?? new Date().getFullYear();
  const types = await leaveTypes();
  const { data: used } = await supabaseAdmin.from("leave_requests")
    .select("working_days, leave_type_id").eq("employee_id", employeeId)
    .eq("status", "approved").gte("start_date", `${y}-01-01`).lte("end_date", `${y}-12-31`);
  const usedMap = new Map<string, number>();
  (used ?? []).forEach((u) =>
    usedMap.set(u.leave_type_id, (usedMap.get(u.leave_type_id) ?? 0) + Number(u.working_days)));
  return types.map((t) => {
    const u = r1(usedMap.get(t.id) ?? 0);
    return {
      id: t.id, code: t.code, label: t.label, paid: t.paid,
      yearly_quota: t.yearly_quota, used: u,
      remaining: t.yearly_quota == null ? null : Math.max(0, r1(t.yearly_quota - u)),
    };
  });
}

function r1(n: number) { return Math.round(n * 10) / 10; }

export async function applyLeave(
  actorProfileId: string, employeeId: string,
  p: { leave_type_id: string; start_date: string; end_date: string; reason: string }
) {
  const settings = await getSettings();
  if (!settings) throw new ApiError(400, "Company setup is not complete");
  if (p.start_date > p.end_date) throw new ApiError(422, "End date must be on or after the start date");

  const { data: overlap } = await supabaseAdmin.from("leave_requests").select("id")
    .eq("employee_id", employeeId).in("status", ["pending", "approved"])
    .lte("start_date", p.end_date).gte("end_date", p.start_date).maybeSingle();
  if (overlap) throw new ApiError(422, "You already have a leave request overlapping these dates");

  const { data: type } = await supabaseAdmin.from("leave_types").select("*")
    .eq("id", p.leave_type_id).maybeSingle();
  if (!type) throw new ApiError(422, "Unknown leave type");

  const holidays = new Set<string>();
  for (const y of new Set([Number(p.start_date.slice(0, 4)), Number(p.end_date.slice(0, 4))])) {
    const { data: hs } = await supabaseAdmin.from("holidays").select("holiday_date")
      .gte("holiday_date", `${y}-01-01`).lte("holiday_date", `${y}-12-31`);
    (hs ?? []).forEach((h) => holidays.add(h.holiday_date));
  }
  const wd = workingDaysBetween(p.start_date, p.end_date, settings.weekend_days, holidays);
  if (wd === 0) throw new ApiError(422, "The selected dates contain no working days");

  if (type.yearly_quota != null) {
    const balances = await leaveBalances(employeeId, Number(p.start_date.slice(0, 4)));
    const bal = balances.find((b) => b.id === type.id);
    if (bal && r1(bal.used + wd) > type.yearly_quota) {
      throw new ApiError(422,
        bal.remaining != null && bal.remaining < wd
          ? `Only ${bal.remaining} working day(s) of ${type.label} left this year`
          : `This request exceeds your ${type.label} quota`);
    }
  }

  const { data: req, error } = await supabaseAdmin.from("leave_requests").insert({
    employee_id: employeeId, leave_type_id: p.leave_type_id,
    start_date: p.start_date, end_date: p.end_date, working_days: wd,
    reason: p.reason, status: "pending",
  }).select().single();
  if (error) throw new ApiError(500, "Could not submit leave request");

  const { data: hrs } = await supabaseAdmin.from("profiles").select("id").eq("role", "hr").eq("active", true);
  for (const hr of hrs ?? []) await notify(hr.id, "leave_request", "New leave request",
    `A leave request for ${wd} working day(s) is pending approval.`);
  await writeAudit({ actorId: actorProfileId, action: "leave.apply", entityType: "leave_requests", entityId: req.id, after: req });
  return { id: req.id, working_days: wd };
}

export async function cancelLeave(actorProfileId: string, employeeId: string, id: string) {
  const { data: req } = await supabaseAdmin.from("leave_requests").select("*").eq("id", id).maybeSingle();
  if (!req || req.employee_id !== employeeId) throw new ApiError(404, "Leave request not found");
  if (req.status === "approved") throw new ApiError(422, "Approved leave can only be changed by HR");
  if (req.status !== "pending") throw new ApiError(409, "This request is already closed");
  const { error } = await supabaseAdmin.from("leave_requests").update({ status: "cancelled" }).eq("id", id);
  if (error) throw new ApiError(500, "Could not cancel request");
  await writeAudit({ actorId: actorProfileId, action: "leave.cancel", entityType: "leave_requests", entityId: id, before: req });
}

/** HR approve/reject with comment; notifies the employee and writes audit. */
export async function decideLeave(
  actorProfileId: string, id: string, decision: "approved" | "rejected", comment?: string
) {
  const { data: req } = await supabaseAdmin
    .from("leave_requests").select("*, leave_types(label), employees(full_name)").eq("id", id).maybeSingle();
  if (!req) throw new ApiError(404, "Leave request not found");
  if (req.status !== "pending") throw new ApiError(409, "This request was already decided");

  const { error } = await supabaseAdmin.from("leave_requests").update({
    status: decision, decided_by: actorProfileId,
    decision_comment: comment ?? null, decided_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new ApiError(500, "Could not save decision");

  const { data: profile } = await supabaseAdmin.from("profiles").select("id")
    .eq("employee_id", req.employee_id).maybeSingle();
  if (profile) await notify(profile.id, "leave_decision",
    `Leave ${decision}`,
    `Your ${req.leave_types?.label ?? "leave"} request (${req.start_date} → ${req.end_date}) was ${decision}.${comment ? " Note: " + comment : ""}`);
  await writeAudit({ actorId: actorProfileId, action: `leave.${decision}`, entityType: "leave_requests", entityId: id, before: { status: "pending" }, after: { status: decision, comment } });
}

/** Employees with approved leave covering a date. */
export async function onLeaveOn(date: string) {
  const { data } = await supabaseAdmin
    .from("leave_requests")
    .select("employee_id, leave_types(label), employees(full_name, employee_code)")
    .eq("status", "approved").lte("start_date", date).gte("end_date", date);
  return (data ?? []) as unknown as {
    employee_id: string;
    leave_types: { label: string } | null;
    employees: { full_name: string; employee_code: string } | null;
  }[];
}
