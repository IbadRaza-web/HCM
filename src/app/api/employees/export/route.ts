import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { exportEmployeesCsv } from "@/services/employees";

export const GET = handler(async () => {
  await requireUser(["admin", "hr"]);
  const csv = await exportEmployeesCsv();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="employees-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
