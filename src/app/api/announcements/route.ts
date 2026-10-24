import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { writeAudit } from "@/lib/org";
import { ok, fail, parseBody, handler } from "@/lib/api";

export const GET = handler(async () => {
  await requireUser();
  const { data } = await supabaseAdmin
    .from("announcements").select("*, profiles!announcements_posted_by_fk(full_name)")
    .eq("active", true).order("created_at", { ascending: false }).limit(30);
  return ok({ announcements: data ?? [] });
});

export const POST = handler(async (req) => {
  const user = await requireUser(["admin", "hr"]);
  const { title, body } = await parseBody(req, z.object({
    title: z.string().min(3, "Title is too short"), body: z.string().min(3, "Body is too short"),
  }));
  const { data, error } = await supabaseAdmin
    .from("announcements").insert({ title, body, posted_by: user.id }).select().single();
  if (error) return ok({ error: "Could not post announcement" }, 500);
  await writeAudit({ actorId: user.id, action: "announcement.post", entityType: "announcements", entityId: data.id, after: data });
  return ok({ announcement: data }, 201);
});
