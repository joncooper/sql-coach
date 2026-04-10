import { NextRequest, NextResponse } from "next/server";
import { getProblem, getAdjacentSlugs } from "@/lib/problems";
import { getTableSchema, getSampleData, executeAdminQuery } from "@/lib/db";
import { getGenerated, ensureGeneratedSchema } from "@/lib/generated";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const problem = await getProblem(slug);

  if (!problem) {
    return NextResponse.json(
      { error: "Problem not found" },
      { status: 404 }
    );
  }

  // Ensure generated problem schema exists in PG
  const generated = await getGenerated(slug);
  if (generated) {
    await ensureGeneratedSchema(generated);
  }

  const domain = problem.domain;
  const schemaRows = await getTableSchema(problem.tables, domain);

  // Group schema rows by table (use just the table name, not schema-qualified)
  const tables: Record<string, { column_name: string; data_type: string; is_nullable: string }[]> = {};
  for (const row of schemaRows) {
    const key = row.table_name;
    if (!tables[key]) tables[key] = [];
    tables[key].push({
      column_name: row.column_name,
      data_type: row.data_type,
      is_nullable: row.is_nullable,
    });
  }

  const samples = await getSampleData(problem.tables, domain);
  const adjacent = await getAdjacentSlugs(slug);

  // Run solution to get expected output example
  let expectedOutput: { columns: string[]; rows: unknown[][] } | null = null;
  try {
    const solResult = await executeAdminQuery(problem.solution, [domain]);
    expectedOutput = { columns: solResult.columns, rows: solResult.rows };
  } catch {
    // If solution fails (shouldn't happen), just omit expected output
  }

  // Strip solution from response
  const { solution, ...safe } = problem;
  return NextResponse.json({ ...safe, schema: tables, samples, adjacent, expectedOutput });
}
