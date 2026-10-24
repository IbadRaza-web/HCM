import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ApiError } from "./auth";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data as object, { status });
}

export function fail(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) {
    const msg = Object.values(e.flatten().fieldErrors)
      .flat()
      .filter(Boolean)[0];
    return NextResponse.json({ error: msg || "Invalid input" }, { status: 422 });
  }
  console.error("[api]", e);
  return NextResponse.json(
    { error: e instanceof Error ? e.message : "Server error" },
    { status: 500 }
  );
}

/** Wrap a route handler with uniform error mapping (401/403/409/422/500). */
export function handler<C = unknown>(
  fn: (req: Request, ctx: C) => Promise<Response>
) {
  return async (req: Request, ctx: C) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      return fail(e);
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(422, "Invalid JSON body");
  }
  return schema.parse(json);
}
