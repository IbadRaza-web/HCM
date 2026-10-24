import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { adminKpis, hrKpis, employeeKpis } from "@/services/analytics";
import { todayISO } from "@/lib/dates";

/** Role-scoped KPIs — the same service the AI tools use. */
export const GET = handler(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) =>
    !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
    new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, "Invalid date");
  const f = z.object({
    from: date.optional(),
    to: date.optional(),
    department_id: z.string().uuid().optional(),
  }).refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "Start date must be on or before end date",
  }).refine((v) => !v.to || v.to <= todayISO(), {
    message: "End date cannot be in the future",
  }).refine((v) => !v.from || v.from <= (v.to ?? todayISO()), {
    message: "Start date cannot be in the future",
  }).parse({
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    department_id: url.searchParams.get("department_id") || undefined,
  });
  const filters = { from: f.from, to: f.to, departmentId: f.department_id };
  if (user.role === "admin") return ok({ role: "admin", kpis: await adminKpis(filters) });
  if (user.role === "hr") return ok({ role: "hr", kpis: await hrKpis(filters) });
  if (!user.employeeId) return ok({ role: "employee", kpis: null });
  return ok({ role: "employee", kpis: await employeeKpis(user.employeeId) });
});
