import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/auth";
import { getSettings, getHolidaySet, writeAudit, notify } from "@/lib/org";
import { minutesOf, nowTimeInTZ, todayISO, isWorkingDay, monthStart, monthEnd, eachDay } from "@/lib/dates";
import { r2 } from "@/lib/money";

function tzMinutes(tsIso: string): number {
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(tsIso));
  return minutesOf(hhmm);
}

export async function checkIn(employeeId: string, source: "web" | "camera" = "web") {
  const settings = await getSettings();
  if (!settings) throw new ApiError(400, "Company setup is not complete");
  const day = todayISO();
  const { data: existing } = await supabaseAdmin
    .from("attendance").select("id")
    .eq("employee_id", employeeId).eq("work_date", day).maybeSingle();
  if (existing) throw new ApiError(409, "You have already checked in today");

  const nowIso = new Date().toISOString();
  const late =
    tzMinutes(nowIso) > minutesOf(settings.office_start) + settings.grace_minutes;
  const { error } = await supabaseAdmin.from("attendance").insert({
    employee_id: employeeId, work_date: day, check_in_at: nowIso,
    status: late ? "late" : "present", source,
  });
  if (error) {
    if (error.code === "23505") throw new ApiError(409, "You have already checked in today");
    throw new ApiError(500, "Could not save check-in");
  }
  return { date: day, time: nowTimeInTZ(), status: late ? "late" : "present" };
}

export async function checkOut(employeeId: string) {
  const settings = await getSettings();
  if (!settings) throw new ApiError(400, "Company setup is not complete");
  const day = todayISO();
  const { data: row } = await supabaseAdmin.from("attendance").select("*")
    .eq("employee_id", employeeId).eq("work_date", day).maybeSingle();
  if (!row) throw new ApiError(404, "No check-in found for today");
  if (row.check_out_at) throw new ApiError(409, "You have already checked out today");

  const nowIso = new Date().toISOString();
  const hours = Math.max(0, (Date.now() - new Date(row.check_in_at).getTime()) / 3_600_000);
  const halfMin = Number(settings.half_day_hours) || 5;
  const status = hours < halfMin ? "half_day" : row.status === "late" ? "late" : "present";
  const { error } = await supabaseAdmin.from("attendance").update({
    check_out_at: nowIso, hours_worked: r2(hours), status,
  }).eq("id", row.id);
  if (error) throw new ApiError(500, "Could not save check-out");
  return { date: day, hours: r2(hours), status };
}

export interface BoardRow {
  employee_id: string;
  code: string;
  name: string;
  department: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  hours_worked: number | null;
  status: string;
  source: string | null;
}

/** Daily attendance board for Admin/HR: merges employees, attendance and approved leave. */
export async function attendanceBoard(date: string, departmentId?: string) {
  const settings = await getSettings();
  if (!settings) throw new ApiError(400, "Company setup is not complete");
  const holidays = await getHolidaySet(Number(date.slice(0, 4)));

  let eq = supabaseAdmin
    .from("employees")
    .select("id, full_name, employee_code, join_date, exit_date, departments(name)")
    .in("status", ["active", "probation"])
    .lte("join_date", date)
    .or(`exit_date.is.null,exit_date.gte.${date}`);
  if (departmentId) eq = eq.eq("department_id", departmentId);
  const { data: employees } = await eq;

  const empRows = (employees ?? []) as unknown as { id: string; full_name: string; employee_code: string; join_date: string; exit_date: string | null; departments: { name: string } | null }[];
  const ids = empRows.map((e) => e.id);
  const [{ data: atts }, { data: leaves }] = await Promise.all([
    ids.length
      ? supabaseAdmin.from("attendance").select("*").eq("work_date", date).in("employee_id", ids)
      : Promise.resolve({ data: [] }),
    ids.length
      ? supabaseAdmin.from("leave_requests").select("employee_id").eq("status", "approved")
          .lte("start_date", date).gte("end_date", date).in("employee_id", ids)
      : Promise.resolve({ data: [] }),
  ]);
  const attMap = new Map((atts ?? []).map((a) => [a.employee_id, a]));
  const leaveSet = new Set((leaves ?? []).map((l) => l.employee_id));
  const workingDay = isWorkingDay(date, settings.weekend_days, holidays);

  const rows: BoardRow[] = empRows.map((e) => {
    const a = attMap.get(e.id);
    let status: string;
    if (a) status = a.status;
    else if (leaveSet.has(e.id)) status = "on_leave";
    else if (!workingDay) status = "non_working";
    else status = "absent";
    return {
      employee_id: e.id, code: e.employee_code, name: e.full_name,
      department: e.departments?.name ?? null,
      check_in_at: a?.check_in_at ?? null, check_out_at: a?.check_out_at ?? null,
      hours_worked: a?.hours_worked ?? null, status, source: a?.source ?? null,
    };
  });
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return {
    date,
    working_day: workingDay,
    rows,
    totals: {
      present: count("present"), late: count("late"), half_day: count("half_day"),
      missing_checkout: count("missing_checkout"), on_leave: count("on_leave"),
      absent: count("absent"), non_working: count("non_working"),
    },
  };
}

/** Employee's own month calendar with derived day statuses. */
export async function myAttendanceMonth(employeeId: string, month: string) {
  const settings = await getSettings();
  if (!settings) throw new ApiError(400, "Company setup is not complete");
  const holidays = await getHolidaySet(Number(month.slice(0, 4)));
  const start = monthStart(month), end = monthEnd(month);
  const [{ data: atts }, { data: leaves }] = await Promise.all([
    supabaseAdmin.from("attendance").select("*").eq("employee_id", employeeId)
      .gte("work_date", start).lte("work_date", end),
    supabaseAdmin.from("leave_requests").select("start_date, end_date").eq("employee_id", employeeId)
      .eq("status", "approved"),
  ]);
  const attMap = new Map((atts ?? []).map((a) => [a.work_date, a]));
  const covered = (day: string) =>
    (leaves ?? []).some((l) => l.start_date <= day && day <= l.end_date);
  const today = todayISO();
  return eachDay(start, end).map((day) => {
    const a = attMap.get(day);
    let status: string;
    if (a) status = a.status;
    else if (covered(day)) status = "on_leave";
    else if (!isWorkingDay(day, settings.weekend_days, holidays)) status = "non_working";
    else if (day > today) status = "upcoming";
    else status = "absent";
    return { date: day, status, check_in_at: a?.check_in_at ?? null, check_out_at: a?.check_out_at ?? null, hours_worked: a?.hours_worked ?? null };
  });
}

export async function requestCorrection(
  profileId: string, employeeId: string,
  p: { work_date: string; requested_check_in?: string | null; requested_check_out?: string | null; reason: string }
) {
  const { data: dup } = await supabaseAdmin.from("attendance_corrections")
    .select("id").eq("employee_id", employeeId).eq("work_date", p.work_date)
    .eq("status", "pending").maybeSingle();
  if (dup) throw new ApiError(409, "A correction for this date is already pending");
  const { error } = await supabaseAdmin.from("attendance_corrections").insert({
    employee_id: employeeId, work_date: p.work_date,
    requested_check_in: p.requested_check_in ?? null,
    requested_check_out: p.requested_check_out ?? null,
    reason: p.reason, requested_by: profileId,
  });
  if (error) throw new ApiError(500, "Could not submit correction");
}

/** HR decision; approval rewrites the attendance row with source='correction'. */
export async function decideCorrection(
  deciderProfileId: string, id: string, decision: "approved" | "rejected", comment?: string
) {
  const { data: c } = await supabaseAdmin.from("attendance_corrections").select("*").eq("id", id).maybeSingle();
  if (!c) throw new ApiError(404, "Correction request not found");
  if (c.status !== "pending") throw new ApiError(409, "This correction was already decided");

  if (decision === "approved") {
    const settings = (await getSettings())!;
    const { data: existing } = await supabaseAdmin.from("attendance").select("*")
      .eq("employee_id", c.employee_id).eq("work_date", c.work_date).maybeSingle();
    const checkIn = c.requested_check_in ?? existing?.check_in_at ?? null;
    const checkOut = c.requested_check_out ?? existing?.check_out_at ?? null;
    if (!checkIn) throw new ApiError(422, "Correction needs a check-in time");
    let status = "present";
    let hours: number | null = null;
    if (tzMinutes(checkIn) > minutesOf(settings.office_start) + settings.grace_minutes) status = "late";
    if (checkOut) {
      hours = r2(Math.max(0, (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3_600_000));
      if (hours < (Number(settings.half_day_hours) || 5)) status = "half_day";
    } else if (c.work_date < todayISO()) {
      status = "missing_checkout";
    }
    const { error } = await supabaseAdmin.from("attendance").upsert({
      employee_id: c.employee_id, work_date: c.work_date, check_in_at: checkIn,
      check_out_at: checkOut, hours_worked: hours, status, source: "correction",
    }, { onConflict: "employee_id,work_date" });
    if (error) throw new ApiError(500, "Could not apply correction");
  }

  const { error } = await supabaseAdmin.from("attendance_corrections").update({
    status: decision, decided_by: deciderProfileId, decision_comment: comment ?? null, decided_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw new ApiError(500, "Could not save decision");

  const { data: profile } = await supabaseAdmin.from("profiles").select("id")
    .eq("employee_id", c.employee_id).maybeSingle();
  if (profile) await notify(profile.id, "attendance_correction",
    `Attendance correction ${decision}`, `Your correction for ${c.work_date} was ${decision}.`);
  await writeAudit({ actorId: deciderProfileId, action: `attendance.correction.${decision}`,
    entityType: "attendance_corrections", entityId: id, after: { decision, comment } });
}
