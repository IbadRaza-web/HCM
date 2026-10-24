import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail, parseBody, handler } from "@/lib/api";
import { smartLeave } from "@/lib/ai";

export const POST = handler(async (req) => {
  const user = await requireUser(["employee"]);
  const { text } = await parseBody(req, z.object({
    text: z.string().min(4, "Describe your leave in a sentence").max(300),
  }));
  return ok(await smartLeave(user, text));
});
