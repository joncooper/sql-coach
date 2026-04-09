import { NextRequest, NextResponse } from "next/server";
import { executeUserQuery, executeAdminQuery } from "@/lib/db";
import { getProblem } from "@/lib/problems";
import { compareResults } from "@/lib/compare";

export async function POST(request: NextRequest) {
  const { sql, slug } = await request.json();

  if (!sql || !slug) {
    return NextResponse.json(
      { error: "sql and slug are required" },
      { status: 400 }
    );
  }

  const problem = await getProblem(slug);
  if (!problem) {
    return NextResponse.json(
      { error: "Problem not found" },
      { status: 404 }
    );
  }

  try {
    const [userResult, expectedResult] = await Promise.all([
      executeUserQuery(sql),
      executeAdminQuery(problem.solution),
    ]);

    const comparison = compareResults(
      { columns: expectedResult.columns, rows: expectedResult.rows },
      { columns: userResult.columns, rows: userResult.rows },
      {
        orderMatters: problem.order_matters,
        expectedColumns: problem.expected_columns,
      }
    );

    return NextResponse.json({
      ...comparison,
      expected: { columns: expectedResult.columns, rows: expectedResult.rows },
      actual: { columns: userResult.columns, rows: userResult.rows },
      executionTimeMs: userResult.executionTimeMs,
    });
  } catch (err: unknown) {
    const pgErr = err as { message: string; position?: string };
    return NextResponse.json(
      { error: pgErr.message, position: pgErr.position },
      { status: 422 }
    );
  }
}
