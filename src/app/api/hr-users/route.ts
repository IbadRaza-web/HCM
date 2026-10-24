import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/org";
import { ok, fail, parseBody, handler } from "@/lib/api";
import { randomBytes } from "node:crypto";

function tempPassword() {
  return `Hcm-${randomBytes(9).toString("base64url")}`;
}

/** Admin manages HR and employee logins (list, deactivate, reset password). */
export const GET = async () => {
  try {
    await requireUser(["admin"]);
    const { data } = await supabaseAdmin
      .from("profiles").select("id, role, full_name, active, created_at, employees(full_name)")
      .in("role", ["hr", "employee"]).order("created_at");
    const { data: emails, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;
    const emailById = new Map((emails?.users ?? []).map((u) => [u.id, u.email]));
    return ok({
      users: (data ?? []).map((p) => ({ ...p, email: emailById.get(p.id) ?? "—" })),
    });
  } catch (e) { return fail(e); }
};

export const POST = handler(async (req) => {
  const user = await requireUser(["admin"]);
  const { full_name, email, role } = await parseBody(req, z.object({
    full_name: z.string().min(2, "Name is too short"),
    email: z.string().email("Valid email required"),
    role: z.literal("hr").default("hr"),
  }));
  const tmp = tempPassword();
  const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase(), password: tmp, email_confirm: true,
  });
  if (error || !authUser.user) return ok({ error: error?.message ?? "Could not create login" }, 422);
  const { error: pErr } = await supabaseAdmin.from("profiles").insert({
    id: authUser.user.id, role, full_name, must_change_password: true,
  });
  if (pErr) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    return ok({ error: "Could not create profile" }, 500);
  }
  await writeAudit({ actorId: user.id, action: "user.create", entityType: "profiles", entityId: authUser.user.id, after: { email, role } });
  return ok({ id: authUser.user.id, temp_password: tmp });
});

export const PUT = handler(async (req) => {
  const user = await requireUser(["admin"]);
  const { id, action } = await parseBody(req, z.object({
    id: z.string().uuid(), action: z.enum(["deactivate", "activate", "reset_password"]),
  }));
  if (id === user.id && action !== "reset_password")
    return ok({ error: "You cannot deactivate your own account" }, 422);
  const { data: target } = await supabaseAdmin.from("profiles").select("role").eq("id", id).maybeSingle();
  if (!target || target.role === "admin")
    return ok({ error: "Only HR and employee accounts can be managed here" }, 404);
  if (action === "reset_password") {
    const tmp = tempPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password: tmp });
    if (error) return ok({ error: error.message }, 422);
    const { error: profileError } = await supabaseAdmin.from("profiles")
      .update({ must_change_password: true }).eq("id", id);
    if (profileError) throw profileError;
    await writeAudit({ actorId: user.id, action: "user.reset_password", entityType: "profiles", entityId: id });
    return ok({ temp_password: tmp });
  }
  const { error } = await supabaseAdmin.from("profiles")
    .update({ active: action === "activate" }).eq("id", id);
  if (error) return ok({ error: "Could not update user" }, 500);
  await writeAudit({ actorId: user.id, action: `user.${action}`, entityType: "profiles", entityId: id });
  return ok({ ok: true });
});
