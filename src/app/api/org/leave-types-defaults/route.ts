import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/org";
import { ok, fail, handler } from "@/lib/api";

/** One-click standard leave types (Annual 14, Sick 8, Casual 10, Unlimited unpaid). */
export const POST = handler(async () => {
  const user = await requireUser(["admin"]);
  const { error } = await supabaseAdmin.from("leave_types").upsert([
    { code: "annual", label: "Annual", yearly_quota: 14, paid: true },
    { code: "sick", label: "Sick", yearly_quota: 8, paid: true },
    { code: "casual", label: "Casual", yearly_quota: 10, paid: true },
    { code: "unpaid", label: "Unpaid", yearly_quota: null, paid: false },
  ], { onConflict: "code", ignoreDuplicates: true });
  if (error) return ok({ error: "Could not create leave types" }, 500);
  await writeAudit({ actorId: user.id, action: "leave_types.defaults", entityType: "leave_types" });
  return ok({ ok: true });
});
