import { NextRequest, NextResponse } from "next/server";
import { executeUserQuery } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { sql } = await request.json();

  if (!sql || typeof sql !== "string") {
    return NextResponse.json({ error: "SQL is required" }, { status: 400 });
  }

  try {
    const result = await executeUserQuery(sql);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const pgErr = err as { message: string; position?: string };
    return NextResponse.json(
      { error: pgErr.message, position: pgErr.position },
      { status: 422 }
    );
  }
}
