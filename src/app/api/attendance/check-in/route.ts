import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { checkIn } from "@/services/attendance";
import { writeAudit } from "@/lib/org";

export const POST = handler(async () => {
  const user = await requireUser(["employee"]);
  if (!user.employeeId) return ok({ error: "No employee record linked to your account" }, 400);
  const result = await checkIn(user.employeeId);
  await writeAudit({ actorId: user.id, action: "attendance.check_in", entityType: "attendance", entityId: `${user.employeeId}:${result.date}`, after: result });
  return ok(result, 201);
});
