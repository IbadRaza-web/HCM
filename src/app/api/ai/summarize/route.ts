import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { dashboardSummary } from "@/lib/ai";
import { adminKpis, hrKpis } from "@/services/analytics";
import { todayISO } from "@/lib/dates";

/** 'Summarize' button on Admin/HR dashboards: insights from already-computed KPI JSON only. */
export const POST = handler(async (req) => {
  const user = await requireUser(["admin", "hr"]);
  const url = new URL(req.url);
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) =>
    !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) &&
    new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, "Invalid date");
  const filters = z.object({
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
  const parsedFilters = {
    from: filters.from,
    to: filters.to,
    departmentId: filters.department_id,
  };
  const kpis = user.role === "admin"
    ? await adminKpis(parsedFilters)
    : await hrKpis(parsedFilters);
  return ok(await dashboardSummary(user, kpis));
});
