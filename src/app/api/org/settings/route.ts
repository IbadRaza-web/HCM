import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { getSettings, writeAudit } from "@/lib/org";
import { ok, fail, parseBody } from "@/lib/api";

export const GET = async () => {
  try {
    await requireUser(["admin", "hr"]);
    return ok({ settings: await getSettings() });
  } catch (e) { return fail(e); }
};

const schema = z.object({
  company_name: z.string().min(2),
  office_start: z.string(),
  grace_minutes: z.coerce.number().int().min(0).max(240),
  half_day_hours: z.coerce.number().min(1).max(12),
  weekend_days: z.array(z.coerce.number().int().min(0).max(6)).min(1),
  office_lat: z.number().nullable().optional(),
  office_lng: z.number().nullable().optional(),
  radius_m: z.coerce.number().int().min(10).max(5000).optional(),
});

export const PUT = async (req: Request) => {
  try {
    const user = await requireUser(["admin"]);
    const p = await parseBody(req, schema);
    const before = await getSettings();
    const { error } = await supabaseAdmin.from("company_settings").update({
      company_name: p.company_name, office_start: p.office_start,
      grace_minutes: p.grace_minutes, half_day_hours: p.half_day_hours,
      weekend_days: p.weekend_days, office_lat: p.office_lat ?? null,
      office_lng: p.office_lng ?? null, radius_m: p.radius_m ?? 150,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) return ok({ error: "Could not save settings" }, 500);
    await writeAudit({ actorId: user.id, action: "settings.update", entityType: "company_settings", entityId: "1", before, after: p });
    return ok({ ok: true });
  } catch (e) { return fail(e); }
};
