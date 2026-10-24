import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/org";
import { ok, fail, parseBody, handler } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handler<Ctx>(async (req, ctx) => {
  const user = await requireUser(["admin"]);
  const { id } = await ctx.params;
  const { name, active } = await parseBody(req, z.object({
    name: z.string().min(2).optional(), active: z.boolean().optional(),
  }));
  const { data, error } = await supabaseAdmin.from("departments")
    .update({ ...(name ? { name } : {}), ...(active != null ? { active } : {}) })
    .eq("id", id).select().single();
  if (error || !data) return ok({ error: "Could not update department" }, 422);
  await writeAudit({ actorId: user.id, action: "department.update", entityType: "departments", entityId: id, after: data });
  return ok({ department: data });
});

export const DELETE = handler<Ctx>(async (_req, ctx) => {
  const user = await requireUser(["admin"]);
  const { id } = await ctx.params;
  const { error } = await supabaseAdmin.from("departments").delete().eq("id", id);
  if (error) return ok({ error: "Department is in use (remove employees/designations first)" }, 422);
  await writeAudit({ actorId: user.id, action: "department.delete", entityType: "departments", entityId: id });
  return ok({ ok: true });
});
