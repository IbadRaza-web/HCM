import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { dashboardSummary } from "@/lib/ai";
import { adminKpis, hrKpis } from "@/services/analytics";

/** 'Summarize' button on Admin/HR dashboards: insights from already-computed KPI JSON only. */
export const POST = handler(async (req) => {
  const user = await requireUser(["admin", "hr"]);
  const url = new URL(req.url);
  const departmentId = url.searchParams.get("department_id") ?? undefined;
  const kpis = user.role === "admin"
    ? await adminKpis({ departmentId })
    : await hrKpis({ departmentId });
  return ok(await dashboardSummary(user, kpis));
});
