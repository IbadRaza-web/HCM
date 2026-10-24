import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";

export const GET = handler(async () => {
  const user = await requireUser();
  const { data } = await supabaseAdmin
    .from("notifications").select("*").eq("recipient_id", user.id)
    .order("created_at", { ascending: false }).limit(30);
  const unread = (data ?? []).filter((n) => !n.read_at).length;
  return ok({ notifications: data ?? [], unread });
});

export const POST = handler(async (req) => {
  const user = await requireUser();
  const { id } = await (await req.json()) as { id?: string };
  if (id) {
    await supabaseAdmin.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("id", id).eq("recipient_id", user.id);
  } else {
    await supabaseAdmin.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("recipient_id", user.id).is("read_at", null);
  }
  return ok({ ok: true });
});
