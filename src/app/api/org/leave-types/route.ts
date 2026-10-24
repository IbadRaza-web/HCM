import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/org";
import { ok, fail, parseBody, handler } from "@/lib/api";
import { leaveTypes } from "@/services/leave";

export const GET = async () => {
  try {
    await requireUser();
    return ok({ leave_types: await leaveTypes() });
  } catch (e) { return fail(e); }
};

const schema = z.object({
  code: z.string().min(2).regex(/^[a-z0-9_-]+$/, "Use lowercase letters/digits"),
  label: z.string().min(2),
  yearly_quota: z.coerce.number().int().min(0).max(365).nullable(),
  paid: z.boolean().default(true),
});

export const POST = handler(async (req) => {
  const user = await requireUser(["admin"]);
  const p = await parseBody(req, schema);
  const { data, error } = await supabaseAdmin.from("leave_types").insert(p).select().single();
  if (error) return ok({ error: "A leave type with this code already exists" }, 422);
  await writeAudit({ actorId: user.id, action: "leave_type.create", entityType: "leave_types", entityId: data.id, after: data });
  return ok({ leave_type: data });
});

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handler<Ctx>(async (req, ctx) => {
  const user = await requireUser(["admin"]);
  const { id } = await ctx.params;
  const p = await parseBody(req, schema.partial());
  const { data, error } = await supabaseAdmin.from("leave_types").update(p).eq("id", id).select().single();
  if (error || !data) return ok({ error: "Could not update leave type" }, 422);
  await writeAudit({ actorId: user.id, action: "leave_type.update", entityType: "leave_types", entityId: id, after: data });
  return ok({ leave_type: data });
});

export const DELETE = handler<Ctx>(async (_req, ctx) => {
  const user = await requireUser(["admin"]);
  const { id } = await ctx.params;
  const { error } = await supabaseAdmin.from("leave_types").delete().eq("id", id);
  if (error) return ok({ error: "Leave type is used by requests — deactivate it instead" }, 422);
  await writeAudit({ actorId: user.id, action: "leave_type.delete", entityType: "leave_types", entityId: id });
  return ok({ ok: true });
});
