import { NextRequest, NextResponse } from "next/server";
import { executeUserQuery, executeAdminQuery } from "@/lib/db";
import { getProblem } from "@/lib/problems";
import { compareResults } from "@/lib/compare";
import { recordSubmission } from "@/lib/tracking";
import { analyzeSubmission } from "@/lib/analyzeSubmission";

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
    const searchPath = [problem.domain];
    const [userResult, expectedResult] = await Promise.all([
      executeUserQuery(sql, searchPath),
      executeAdminQuery(problem.solution, searchPath),
    ]);

    const comparison = compareResults(
      { columns: expectedResult.columns, rows: expectedResult.rows },
      { columns: userResult.columns, rows: userResult.rows },
      {
        orderMatters: problem.order_matters,
        expectedColumns: problem.expected_columns,
      }
    );

    const submissionId = await recordSubmission({
      slug,
      sql,
      passed: comparison.pass,
      executionMs: userResult.executionTimeMs,
      error: null,
    }).catch((e) => {
      console.error("recordSubmission failed", e);
      return null;
    });

    if (!comparison.pass && submissionId !== null) {
      void analyzeSubmission({
        submissionId,
        slug,
        studentSql: sql,
        error: null,
        diffSummary: comparison.coaching,
      }).catch((e) => console.error("analyzeSubmission failed", e));
    }

    return NextResponse.json({
      ...comparison,
      expected: {
        columns: expectedResult.columns,
        columnTypes: expectedResult.columnTypes,
        rows: expectedResult.rows,
      },
      actual: {
        columns: userResult.columns,
        columnTypes: userResult.columnTypes,
        rows: userResult.rows,
      },
      executionTimeMs: userResult.executionTimeMs,
      submissionId,
    });
  } catch (err: unknown) {
    const pgErr = err as { message: string; position?: string };

    const submissionId = await recordSubmission({
      slug,
      sql,
      passed: false,
      error: pgErr.message,
    }).catch((e) => {
      console.error("recordSubmission failed", e);
      return null;
    });

    if (submissionId !== null) {
      void analyzeSubmission({
        submissionId,
        slug,
        studentSql: sql,
        error: pgErr.message,
        diffSummary: null,
      }).catch((e) => console.error("analyzeSubmission failed", e));
    }

    return NextResponse.json(
      { error: pgErr.message, position: pgErr.position, submissionId },
      { status: 422 }
    );
  }
}
