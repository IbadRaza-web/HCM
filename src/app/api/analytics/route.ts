import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { adminKpis, hrKpis, employeeKpis } from "@/services/analytics";

/** Role-scoped KPIs — the same service the AI tools use. */
export const GET = handler(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const f = {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    departmentId: url.searchParams.get("department_id") ?? undefined,
  };
  if (user.role === "admin") return ok({ role: "admin", kpis: await adminKpis(f) });
  if (user.role === "hr") return ok({ role: "hr", kpis: await hrKpis(f) });
  if (!user.employeeId) return ok({ role: "employee", kpis: null });
  return ok({ role: "employee", kpis: await employeeKpis(user.employeeId) });
});
