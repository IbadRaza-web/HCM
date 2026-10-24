import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { finalizePayrun } from "@/services/payroll";

type Ctx = { params: Promise<{ id: string }> };

/** Admin-only one-way lock; only Admin can finalize payroll (brief, checklist #16). */
export const POST = handler<Ctx>(async (_req, ctx) => {
  const user = await requireUser(["admin"]);
  const { id } = await ctx.params;
  await finalizePayrun(user.id, id);
  return ok({ ok: true });
});
