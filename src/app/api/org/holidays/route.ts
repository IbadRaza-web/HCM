import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/org";
import { ok, fail, parseBody, handler } from "@/lib/api";

export const GET = async () => {
  try {
    await requireUser();
    const { data } = await supabaseAdmin.from("holidays").select("*").order("holiday_date");
    return ok({ holidays: data ?? [] });
  } catch (e) { return fail(e); }
};

export const POST = handler(async (req) => {
  const user = await requireUser(["admin"]);
  const { holiday_date, name } = await parseBody(req, z.object({
    holiday_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    name: z.string().min(2, "Give the holiday a name"),
  }));
  const { data, error } = await supabaseAdmin.from("holidays").insert({ holiday_date, name }).select().single();
  if (error) return ok({ error: "This date is already a holiday" }, 422);
  await writeAudit({ actorId: user.id, action: "holiday.create", entityType: "holidays", entityId: data.id, after: data });
  return ok({ holiday: data });
});

export const DELETE = handler(async (req) => {
  const user = await requireUser(["admin"]);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return ok({ error: "Missing id" }, 422);
  await supabaseAdmin.from("holidays").delete().eq("id", id);
  await writeAudit({ actorId: user.id, action: "holiday.delete", entityType: "holidays", entityId: id });
  return ok({ ok: true });
});
