import "server-only";
import { supabaseAdmin } from "./supabase/admin";

export interface CompanySettings {
  id: number;
  company_name: string;
  office_start: string;
  grace_minutes: number;
  half_day_hours: number;
  weekend_days: number[];
  office_lat: number | null;
  office_lng: number | null;
  radius_m: number;
  timezone: string;
}

export async function getSettings(): Promise<CompanySettings | null> {
  const { data } = await supabaseAdmin
    .from("company_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return (data as CompanySettings) ?? null;
}

export async function getHolidaySet(year?: number): Promise<Set<string>> {
  let q = supabaseAdmin.from("holidays").select("holiday_date");
  if (year) {
    q = q
      .gte("holiday_date", `${year}-01-01`)
      .lt("holiday_date", `${year + 1}-01-01`);
  }
  const { data } = await q;
  return new Set((data ?? []).map((h: { holiday_date: string }) => h.holiday_date));
}

/** First-run setup is complete once the single company_settings row exists. */
export async function isSetupComplete(): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from("company_settings")
    .select("id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}

export async function writeAudit(entry: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}) {
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    before_json: entry.before ?? null,
    after_json: entry.after ?? null,
  });
}

export async function notify(
  recipientId: string,
  type: string,
  title: string,
  body = ""
) {
  await supabaseAdmin
    .from("notifications")
    .insert({ recipient_id: recipientId, type, title, body });
}
