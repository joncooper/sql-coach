import { NextRequest, NextResponse } from "next/server";
import { getProblem, getAdjacentSlugs } from "@/lib/problems";
import { getTableSchema, getSampleData } from "@/lib/db";

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

  const schemaRows = await getTableSchema(problem.tables);

  // Group schema rows by table
  const tables: Record<string, { column_name: string; data_type: string; is_nullable: string }[]> = {};
  for (const row of schemaRows) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!tables[key]) tables[key] = [];
    tables[key].push({
      column_name: row.column_name,
      data_type: row.data_type,
      is_nullable: row.is_nullable,
    });
  }

  const samples = await getSampleData(problem.tables);
  const adjacent = await getAdjacentSlugs(slug);

  // Strip solution from response
  const { solution, ...safe } = problem;
  return NextResponse.json({ ...safe, schema: tables, samples, adjacent });
}
