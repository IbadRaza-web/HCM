import { requireUser, ApiError } from "@/lib/auth";
import { fail, handler } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/org";
import { payslipPdf } from "@/services/payslip-pdf";
import { fmtMonth } from "@/lib/dates";

type Ctx = { params: Promise<{ id: string }> };

/** Payslip PDF: Admin/HR any, Employee only their own (server-side scope check). */
export const GET = handler<Ctx>(async (_req, ctx) => {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { data: slip } = await supabaseAdmin
      .from("payslips")
      .select("*, employees(full_name, employee_code, join_date, department_id, departments(name), designations(title)), payroll_runs(period_month, status)")
      .eq("id", id).maybeSingle();
    if (!slip) throw new ApiError(404, "Payslip not found");
    if (user.role === "employee" && slip.employee_id !== user.employeeId)
      throw new ApiError(403, "You can only download your own payslips");
    const settings = await getSettings();
    const bytes = await payslipPdf({
      company: settings?.company_name ?? "HCM Lite",
      monthLabel: fmtMonth(slip.payroll_runs.period_month),
      employeeName: slip.employees.full_name,
      employeeCode: slip.employees.employee_code,
      department: slip.employees.departments?.name ?? null,
      designation: slip.employees.designations?.title ?? null,
      joinDate: slip.employees.join_date,
      status: slip.payroll_runs.status,
      slip,
    });
    const fileName = `payslip-${slip.employees.employee_code}-${slip.payroll_runs.period_month.slice(0, 7)}.pdf`;
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    return fail(e);
  }
});
