import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { cancelLeave } from "@/services/leave";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler<Ctx>(async (_req, ctx) => {
  const user = await requireUser(["employee"]);
  const { id } = await ctx.params;
  if (!user.employeeId) return ok({ error: "No employee record linked" }, 400);
  await cancelLeave(user.id, user.employeeId, id);
  return ok({ ok: true });
});
