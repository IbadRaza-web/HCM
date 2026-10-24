import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail, parseBody, handler } from "@/lib/api";
import { aiChat, type ChatTurn } from "@/lib/ai";

const schema = z.object({
  message: z.string().min(1, "Type a message").max(1000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(2000),
  })).max(10).default([]),
});

export const POST = handler(async (req) => {
  const user = await requireUser();
  const { message, history } = await parseBody(req, schema);
  const result = await aiChat(user, history as ChatTurn[], message);
  return ok(result);
});
