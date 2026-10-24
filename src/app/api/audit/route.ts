import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";

/** Append-only audit log; Admin only (brief: HR/Employee cannot view it). */
export const GET = handler(async (req) => {
  await requireUser(["admin"]);
  const page = Number(new URL(req.url).searchParams.get("page") ?? "1") || 1;
  const per = 50;
  const { data, count } = await supabaseAdmin
    .from("audit_logs")
    .select("*, profiles(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * per, page * per - 1);
  return ok({ logs: data ?? [], total: count ?? 0, page });
});
