import { getSupabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";

export type Role = "admin" | "hr" | "employee";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
  name: string;
  mustChangePassword: boolean;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Resolve the verified session into a trusted profile (role from DB, never from the client). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const sb = await getSupabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!p || !p.active) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    role: p.role,
    employeeId: p.employee_id ?? null,
    name: p.full_name || (user.email ?? "User"),
    mustChangePassword: !!p.must_change_password,
  };
}

/** Authenticated + active + (optionally) role-checked user for API routes. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new ApiError(401, "Not signed in");
  if (u.mustChangePassword) throw new ApiError(403, "You must change your password first");
  if (roles && !roles.includes(u.role)) throw new ApiError(403, "Forbidden");
  return u;
}
