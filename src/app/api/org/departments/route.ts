import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/org";
import { ok, fail, parseBody } from "@/lib/api";

export const GET = async () => {
  try {
    await requireUser();
    const { data } = await supabaseAdmin.from("departments").select("*").order("name");
    return ok({ departments: data ?? [] });
  } catch (e) { return fail(e); }
};

export const POST = async (req: Request) => {
  try {
    const user = await requireUser(["admin"]);
    const { name } = await parseBody(req, z.object({ name: z.string().min(2, "Department name is too short") }));
    const { data, error } = await supabaseAdmin.from("departments").insert({ name }).select().single();
    if (error) return ok({ error: "Department already exists" }, 422);
    await writeAudit({ actorId: user.id, action: "department.create", entityType: "departments", entityId: data.id, after: data });
    return ok({ department: data });
  } catch (e) { return fail(e); }
};
