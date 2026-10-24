import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ApiError } from "@/lib/auth";
import { ok, fail, parseBody, handler } from "@/lib/api";
import { employee360, updateEmployee } from "@/services/employees";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (_req, ctx) => {
  const user = await requireUser(["admin", "hr"]);
  const { id } = await ctx.params;
  if (user.role === "employee" && user.employeeId !== id)
    throw new ApiError(403, "You can only view your own profile");
  return ok(await employee360(id));
});

const schema = z.object({
  full_name: z.string().min(2).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  designation_id: z.string().uuid().nullable().optional(),
  join_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  exit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(["active", "probation", "exited"]).optional(),
  basic_salary: z.coerce.number().positive("Salary must be greater than 0").optional(),
});

export const PUT = handler<Ctx>(async (req, ctx) => {
  const user = await requireUser(["hr", "employee"]);
  const { id } = await ctx.params;
  if (user.role === "employee" && user.employeeId !== id)
    throw new ApiError(403, "Employees can only edit their own phone and address");
  const patch = await parseBody(req, schema);
  const actorRole = user.role as "hr" | "employee";
  return ok({ employee: await updateEmployee(user.id, actorRole, id, patch) });
});
