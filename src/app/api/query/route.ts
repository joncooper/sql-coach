import { NextRequest, NextResponse } from "next/server";
import { executeUserQuery } from "@/lib/db";
import { recordRun } from "@/lib/tracking";

export async function POST(request: NextRequest) {
  const { sql, domain, slug } = await request.json();

  if (!sql || typeof sql !== "string") {
    return NextResponse.json({ error: "SQL is required" }, { status: 400 });
  }

  try {
    const searchPath = domain ? [domain] : undefined;
    const result = await executeUserQuery(sql, searchPath);
    if (slug) {
      recordRun({ slug, sql, success: true }).catch((e) =>
        console.error("recordRun failed", e)
      );
    }
    return NextResponse.json(result);
  } catch (err: unknown) {
    const pgErr = err as { message: string; position?: string };
    if (slug) {
      recordRun({ slug, sql, success: false, error: pgErr.message }).catch(
        (e) => console.error("recordRun failed", e)
      );
    }
    return NextResponse.json(
      { error: pgErr.message, position: pgErr.position },
      { status: 422 }
    );
  }
}
