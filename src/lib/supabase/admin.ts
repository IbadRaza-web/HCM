import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server-only: bypasses RLS, so every caller must
 * enforce role + data-scope checks before using it.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/** Apply a SQL migration through the guarded exec_sql RPC (dev helper). */
export async function applySql(sql: string) {
  const { error } = await supabaseAdmin.rpc("exec_sql", { sql });
  if (error) throw new Error(`Migration failed: ${error.message}`);
}
