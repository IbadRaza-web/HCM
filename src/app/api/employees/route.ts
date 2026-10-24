import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, fail, parseBody, handler } from "@/lib/api";
import { listEmployees, registerEmployee } from "@/services/employees";

export const GET = handler(async (req) => {
  await requireUser(["admin", "hr"]);
  const url = new URL(req.url);
  const result = await listEmployees({
    search: url.searchParams.get("search") ?? undefined,
    department_id: url.searchParams.get("department_id") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    page: Number(url.searchParams.get("page") ?? "1") || 1,
  });
  return ok(result);
});

const schema = z.object({
  full_name: z.string().min(2, "Name is too short"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  department_id: z.string().uuid("Choose a department").nullable().optional(),
  designation_id: z.string().uuid().nullable().optional(),
  join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a join date"),
  basic_salary: z.coerce.number().positive("Salary must be greater than 0"),
  employee_code: z.string().optional(),
});

/** HR registers an employee → employee record + login with temporary password. */
export const POST = handler(async (req) => {
  const user = await requireUser(["hr"]);
  const p = await parseBody(req, schema);
  const result = await registerEmployee(user.id, p);
  return ok(result, 201);
});
