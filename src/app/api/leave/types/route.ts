import { requireUser } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";
import { leaveTypes, leaveBalances } from "@/services/leave";

export const GET = handler(async () => {
  const user = await requireUser();
  const types = await leaveTypes();
  const balances = user.employeeId ? await leaveBalances(user.employeeId) : null;
  return ok({ leave_types: types, balances });
});
