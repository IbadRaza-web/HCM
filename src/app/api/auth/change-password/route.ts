import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { writeAudit } from "@/lib/org";
import { ok, fail, parseBody } from "@/lib/api";

const schema = z.object({ password: z.string().min(8, "Password must be at least 8 characters") });

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return ok({ error: "Not signed in" }, 401);
    const { password } = await parseBody(req, schema);
    const sb = await getSupabaseServer();
    const { error } = await sb.auth.updateUser({ password });
    if (error) return ok({ error: error.message }, 422);
    await supabaseAdmin.from("profiles").update({ must_change_password: false }).eq("id", user.id);
    await writeAudit({ actorId: user.id, action: "auth.password_change", entityType: "profiles", entityId: user.id });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
