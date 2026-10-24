import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail, parseBody, handler } from "@/lib/api";
import { decideCorrection } from "@/services/attendance";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler<Ctx>(async (req, ctx) => {
  const user = await requireUser(["hr"]);
  const { id } = await ctx.params;
  const { decision, comment } = await parseBody(req, z.object({
    decision: z.enum(["approved", "rejected"]),
    comment: z.string().optional(),
  }));
  await decideCorrection(user.id, id, decision, comment);
  return ok({ ok: true });
});
