import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { attendanceBoard, myAttendanceMonth } from "@/services/attendance";
import { todayISO } from "@/lib/dates";

export const GET = handler(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  if (user.role === "employee") {
    if (!user.employeeId) return ok({ error: "No employee record linked" }, 400);
    const month = url.searchParams.get("month") ?? todayISO().slice(0, 7);
    return ok({ month, days: await myAttendanceMonth(user.employeeId, month) });
  }
  const date = url.searchParams.get("date") ?? todayISO();
  const department_id = url.searchParams.get("department_id") ?? undefined;
  return ok(await attendanceBoard(date, department_id || undefined));
});
