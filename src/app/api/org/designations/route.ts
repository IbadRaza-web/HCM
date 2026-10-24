import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/org";
import { ok, fail, parseBody, handler } from "@/lib/api";

export const GET = async () => {
  try {
    await requireUser();
    const { data } = await supabaseAdmin.from("designations")
      .select("*, departments(name)").order("title");
    return ok({ designations: data ?? [] });
  } catch (e) { return fail(e); }
};

export const POST = handler(async (req) => {
  const user = await requireUser(["admin"]);
  const { title, department_id } = await parseBody(req, z.object({
    title: z.string().min(2, "Title is too short"), department_id: z.string().uuid("Choose a department"),
  }));
  const { data, error } = await supabaseAdmin.from("designations")
    .insert({ title, department_id }).select().single();
  if (error) return ok({ error: "This designation already exists in the department" }, 422);
  await writeAudit({ actorId: user.id, action: "designation.create", entityType: "designations", entityId: data.id, after: data });
  return ok({ designation: data });
});

export const DELETE = handler(async (req) => {
  const user = await requireUser(["admin"]);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return ok({ error: "Missing id" }, 422);
  const { error } = await supabaseAdmin.from("designations").delete().eq("id", id);
  if (error) return ok({ error: "Designation is in use" }, 422);
  await writeAudit({ actorId: user.id, action: "designation.delete", entityType: "designations", entityId: id });
  return ok({ ok: true });
});
