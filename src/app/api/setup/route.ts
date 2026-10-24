import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isSetupComplete, writeAudit } from "@/lib/org";
import { ok, parseBody, fail } from "@/lib/api";
import { ApiError } from "@/lib/auth";

const schema = z.object({
  company_name: z.string().min(2),
  admin_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  office_start: z.string().default("09:00"),
  grace_minutes: z.coerce.number().int().min(0).max(240).default(15),
  weekend_days: z.array(z.coerce.number().int().min(0).max(6)).min(1).default([6, 0]),
  office_lat: z.number().nullable().optional(),
  office_lng: z.number().nullable().optional(),
  seed_leave_types: z.boolean().default(true),
});

export async function POST(req: Request) {
  try {
    const p = await parseBody(req, schema);
    if (await isSetupComplete()) throw new ApiError(409, "Setup already completed");

    const email = p.email.toLowerCase();
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email, password: p.password, email_confirm: true,
    });
    if (authErr || !authUser.user) throw new ApiError(422, authErr?.message ?? "Could not create the Admin account");

    const { error: settingsErr } = await supabaseAdmin.from("company_settings").insert({
      id: 1, company_name: p.company_name, office_start: p.office_start,
      grace_minutes: p.grace_minutes, weekend_days: p.weekend_days,
      office_lat: p.office_lat ?? null, office_lng: p.office_lng ?? null,
    });
    if (settingsErr) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new ApiError(409, "Setup already completed");
    }
    const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
      id: authUser.user.id, role: "admin", full_name: p.admin_name, must_change_password: false,
    });
    if (profileErr) {
      await supabaseAdmin.from("company_settings").delete().eq("id", 1);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new ApiError(500, "Could not create the Admin profile");
    }
    if (p.seed_leave_types) {
      await supabaseAdmin.from("leave_types").upsert([
        { code: "annual", label: "Annual", yearly_quota: 14, paid: true },
        { code: "sick", label: "Sick", yearly_quota: 8, paid: true },
        { code: "casual", label: "Casual", yearly_quota: 10, paid: true },
        { code: "unpaid", label: "Unpaid", yearly_quota: null, paid: false },
      ], { onConflict: "code", ignoreDuplicates: true });
    }
    await writeAudit({ actorId: authUser.user.id, action: "setup.complete", entityType: "company_settings", entityId: "1", after: { company_name: p.company_name, admin: email } });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
