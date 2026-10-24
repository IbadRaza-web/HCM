import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handler, ok, parseBody } from "@/lib/api";
import { importEmployeesCsv } from "@/services/employees";

const schema = z.object({
  csv: z.string().min(1).max(2_000_000),
  dry_run: z.boolean().default(true),
});

export const POST = handler(async (req) => {
  const user = await requireUser(["hr"]);
  const { csv, dry_run } = await parseBody(req, schema);
  return ok(await importEmployeesCsv(user.id, csv, dry_run));
});
