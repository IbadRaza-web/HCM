import "server-only";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/auth";
import { writeAudit } from "@/lib/org";
import { parseCsv } from "@/lib/csv";

export interface RegisterEmployeeInput {
  full_name: string; email: string; phone?: string; address?: string;
  gender?: "male" | "female" | "other" | null;
  department_id?: string | null; designation_id?: string | null;
  join_date: string; basic_salary: number; employee_code?: string;
}

function tempPassword() {
  const rnd = Math.random().toString(36).slice(2, 10);
  return `Hcm-${rnd}`;
}

export async function nextEmployeeCode(): Promise<string> {
  const { count } = await supabaseAdmin.from("employees").select("id", { count: "exact", head: true });
  return `EMP-${String((count ?? 0) + 1).padStart(3, "0")}`;
}

/** HR registers an employee; creates the linked login with a temporary password (change forced). */
export async function registerEmployee(actorProfileId: string, p: RegisterEmployeeInput) {
  const code = p.employee_code?.trim() || (await nextEmployeeCode());
  const { data: emp, error } = await supabaseAdmin.from("employees").insert({
    employee_code: code, full_name: p.full_name, email: p.email.toLowerCase(),
    phone: p.phone ?? "", address: p.address ?? "", gender: p.gender ?? null,
    department_id: p.department_id || null, designation_id: p.designation_id || null,
    join_date: p.join_date, basic_salary: p.basic_salary, status: "active",
  }).select().single();
  if (error || !emp) {
    if (error?.code === "23505") throw new ApiError(422, "An employee with this code or email already exists");
    throw new ApiError(500, "Could not register employee");
  }

  const tmp = tempPassword();
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: p.email.toLowerCase(), password: tmp, email_confirm: true,
  });
  if (authErr || !authUser.user) {
    await supabaseAdmin.from("employees").delete().eq("id", emp.id);
    throw new ApiError(422, `Could not create login (${authErr?.message ?? "unknown"}). Check the email is not already registered.`);
  }
  const { error: pErr } = await supabaseAdmin.from("profiles").insert({
    id: authUser.user.id, role: "employee", employee_id: emp.id,
    full_name: p.full_name, must_change_password: true,
  });
  if (pErr) {
    await supabaseAdmin.from("employees").delete().eq("id", emp.id);
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    throw new ApiError(500, "Could not create employee profile");
  }
  await writeAudit({ actorId: actorProfileId, action: "employee.register", entityType: "employees", entityId: emp.id, after: { code, name: p.full_name } });
  return { employee: emp, temp_password: tmp };
}

const csvEmployeeSchema = z.object({
  code: z.string().trim().min(1, "Employee code is required"),
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().optional(),
  department: z.string().trim().min(1, "Department is required"),
  designation: z.string().trim().optional(),
  join_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  basic_salary: z.coerce.number().finite().positive("Salary must be greater than 0"),
});

export async function importEmployeesCsv(actorProfileId: string, csv: string, dryRun: boolean) {
  let rows: string[][];
  try {
    rows = parseCsv(csv);
  } catch (error) {
    throw new ApiError(422, error instanceof Error ? error.message : "Could not parse CSV");
  }
  if (rows.length < 2) throw new ApiError(422, "CSV must contain a header and at least one employee row");

  const aliases: Record<string, string> = {
    employee_code: "code",
    full_name: "name",
    department_name: "department",
    designation_title: "designation",
  };
  const headers = rows[0].map((value) => {
    const key = value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, "_");
    return aliases[key] ?? key;
  });
  if (new Set(headers).size !== headers.length) throw new ApiError(422, "CSV contains duplicate column headers");
  const missing = ["code", "name", "email", "department", "join_date", "basic_salary"].filter((h) => !headers.includes(h));
  if (missing.length) throw new ApiError(422, `Missing required CSV column(s): ${missing.join(", ")}`);

  const [{ data: departments, error: departmentsError }, { data: employees, error: employeesError },
    { data: authUsers, error: authError }] = await Promise.all([
    supabaseAdmin.from("departments").select("id,name").eq("active", true),
    supabaseAdmin.from("employees").select("employee_code,email"),
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  if (departmentsError || employeesError || authError) throw new ApiError(500, "Could not validate CSV against existing company data");

  const departmentByName = new Map((departments ?? []).map((d) => [d.name.trim().toLowerCase(), d]));
  const codes = new Set((employees ?? []).map((e) => e.employee_code.toLowerCase()));
  const emails = new Set([
    ...(employees ?? []).map((e) => e.email.toLowerCase()),
    ...(authUsers?.users ?? []).map((u) => u.email?.toLowerCase()).filter((email): email is string => Boolean(email)),
  ]);
  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();
  const parsed = rows.slice(1).map((cells, index) => {
    const value = Object.fromEntries(headers.map((header, col) => [header, cells[col] ?? ""]));
    const result = csvEmployeeSchema.safeParse(value);
    const errors = result.success
      ? []
      : result.error.issues.map((issue) => ({ field: String(issue.path[0] ?? "row"), reason: issue.message }));
    const employee = result.success ? result.data : null;
    const department = employee ? departmentByName.get(employee.department.toLowerCase()) : null;
    if (employee && !department) errors.push({ field: "department", reason: `Unknown department "${employee.department}"` });
    if (employee && (codes.has(employee.code.toLowerCase()) || seenCodes.has(employee.code.toLowerCase())))
      errors.push({ field: "code", reason: "Employee code already exists in the database or CSV" });
    if (employee && (emails.has(employee.email.toLowerCase()) || seenEmails.has(employee.email.toLowerCase())))
      errors.push({ field: "email", reason: "Email already exists in the database or CSV" });
    if (employee && department && errors.length === 0) {
      seenCodes.add(employee.code.toLowerCase());
      seenEmails.add(employee.email.toLowerCase());
    }
    return { row: index + 2, employee, department, errors };
  });

  const validRows = parsed.filter((row) => row.employee && row.department && row.errors.length === 0);
  if (dryRun) {
    return {
      dry_run: true, total: parsed.length, valid: validRows.length, invalid: parsed.length - validRows.length,
      rows: parsed.map((row) => ({ row: row.row, valid: row.errors.length === 0, errors: row.errors, code: row.employee?.code })),
    };
  }

  const results = await Promise.all(parsed.map(async (row) => {
    if (!row.employee || !row.department || row.errors.length) {
      return { row: row.row, valid: false, errors: row.errors };
    }
    try {
      const created = await registerEmployee(actorProfileId, {
        full_name: row.employee.name,
        email: row.employee.email,
        phone: row.employee.phone,
        department_id: row.department.id,
        join_date: row.employee.join_date,
        basic_salary: row.employee.basic_salary,
        employee_code: row.employee.code,
      });
      return { row: row.row, valid: true, errors: [], code: row.employee.code, temp_password: created.temp_password };
    } catch (error) {
      return { row: row.row, valid: false, errors: [{ field: "row", reason: error instanceof Error ? error.message : "Could not import employee" }] };
    }
  }));
  const imported = results.filter((row) => row.valid).length;
  return { dry_run: false, total: results.length, imported, failed: results.length - imported, rows: results };
}

export async function updateEmployee(
  actorProfileId: string, actorRole: "hr" | "employee", id: string,
  patch: Record<string, unknown>
) {
  const { data: before } = await supabaseAdmin.from("employees").select("*").eq("id", id).maybeSingle();
  if (!before) throw new ApiError(404, "Employee not found");

  const allowed: string[] = actorRole === "hr"
    ? ["full_name", "phone", "address", "gender", "department_id", "designation_id", "join_date", "exit_date", "status", "basic_salary"]
    : ["phone", "address"];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (k in patch) update[k] = patch[k] ?? null;
  if (Object.keys(update).length === 1) throw new ApiError(422, "Nothing to update");

  const { data: after, error } = await supabaseAdmin.from("employees").update(update).eq("id", id).select().single();
  if (error) throw new ApiError(500, "Could not update employee");
  await writeAudit({ actorId: actorProfileId, action: "employee.update", entityType: "employees", entityId: id, before, after });
  return after;
}

export async function listEmployees(opts: {
  search?: string; department_id?: string; status?: string; page?: number;
}) {
  const page = Math.max(1, opts.page ?? 1), per = 12;
  let q = supabaseAdmin
    .from("employees")
    .select("*, departments(name), designations(title)", { count: "exact" });
  if (opts.search) {
    const s = opts.search.replace(/[%,]/g, "");
    q = q.or(`full_name.ilike.%${s}%,employee_code.ilike.%${s}%,email.ilike.%${s}%`);
  }
  if (opts.department_id) q = q.eq("department_id", opts.department_id);
  if (opts.status) q = q.eq("status", opts.status);
  else q = q.neq("status", "exited"); // hmm keep: default show non-exited
  const { data, count } = await q.order("employee_code").range((page - 1) * per, page * per - 1);
  return { rows: data ?? [], total: count ?? 0, page, per };
}

export async function getEmployee(id: string) {
  const { data } = await supabaseAdmin
    .from("employees").select("*, departments(name), designations(title)").eq("id", id).maybeSingle();
  if (!data) throw new ApiError(404, "Employee not found");
  return data;
}

export async function employee360(id: string) {
  const emp = await getEmployee(id);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [att, leaves, balances, payslip] = await Promise.all([
    supabaseAdmin.from("attendance").select("*").eq("employee_id", id).gte("work_date", monthAgo).order("work_date", { ascending: false }),
    supabaseAdmin.from("leave_requests").select("*, leave_types(label)").eq("employee_id", id).order("created_at", { ascending: false }).limit(10),
    (await import("./leave")).leaveBalances(id),
    supabaseAdmin.from("payslips").select("id, net, gross, payroll_runs(period_month, status)").eq("employee_id", id).order("created_at", { ascending: false }).limit(1),
  ]);
  return {
    employee: emp,
    attendance: att.data ?? [],
    leaves: leaves.data ?? [],
    balances,
    lastPayslip: payslip.data?.[0] ?? null,
  };
}

export async function exportEmployeesCsv() {
  const { data } = await supabaseAdmin
    .from("employees").select("*, departments(name), designations(title)").order("employee_code");
  const rows = data ?? [];
  const head = ["code", "name", "email", "phone", "department", "designation", "join_date", "status", "basic_salary"];
  const lines = [head.join(",")];
  for (const e of rows) {
    const cells = [
      e.employee_code, e.full_name, e.email, e.phone ?? "",
      e.departments?.name ?? "", e.designations?.title ?? "",
      e.join_date, e.status, String(e.basic_salary),
    ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}
