import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { adminPool } from "@/lib/db";

export interface Analysis {
  summary: string;
  categories: string[];
  concept_gaps: string[];
  severity: "syntax" | "logic" | "misread-prompt" | "unknown";
}

let initPromise: Promise<void> | null = null;

// Self-heal: ensure the coaching schema exists. Runs once per process.
// Prod deploys should also run scripts/init-tracking.sql via setup.sh, but
// this keeps dev environments from needing manual steps after pulling.
function ensureSchema(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const sqlPath = join(process.cwd(), "scripts", "init-tracking.sql");
    const sql = await readFile(sqlPath, "utf-8");
    await adminPool.query(sql);
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

export async function recordRun(params: {
  slug: string;
  sql: string;
  success: boolean;
  error?: string | null;
}): Promise<void> {
  await ensureSchema();
  await adminPool.query(
    `INSERT INTO coaching.problem_runs (slug, sql, success, error)
     VALUES ($1, $2, $3, $4)`,
    [params.slug, params.sql, params.success, params.error ?? null]
  );
}

export async function recordSubmission(params: {
  slug: string;
  sql: string;
  passed: boolean;
  executionMs?: number | null;
  error?: string | null;
}): Promise<number> {
  await ensureSchema();
  const result = await adminPool.query<{ id: string }>(
    `INSERT INTO coaching.problem_submissions
       (slug, sql, passed, execution_ms, error)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      params.slug,
      params.sql,
      params.passed,
      params.executionMs ?? null,
      params.error ?? null,
    ]
  );
  return Number(result.rows[0].id);
}

export async function setAnalysis(
  id: number,
  analysis: Analysis
): Promise<void> {
  await adminPool.query(
    `UPDATE coaching.problem_submissions
        SET analysis = $2, analyzed_at = now(), analysis_error = NULL
      WHERE id = $1`,
    [id, analysis]
  );
}

export async function setAnalysisError(
  id: number,
  error: string
): Promise<void> {
  await adminPool.query(
    `UPDATE coaching.problem_submissions
        SET analysis_error = $2, analyzed_at = now()
      WHERE id = $1`,
    [id, error]
  );
}

export type AnalysisStatus =
  | { status: "pending" }
  | { status: "done"; analysis: Analysis }
  | { status: "error"; error: string }
  | { status: "not_found" };

export async function getAnalysis(id: number): Promise<AnalysisStatus> {
  const result = await adminPool.query<{
    analysis: Analysis | null;
    analyzed_at: Date | null;
    analysis_error: string | null;
  }>(
    `SELECT analysis, analyzed_at, analysis_error
       FROM coaching.problem_submissions
      WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return { status: "not_found" };
  const row = result.rows[0];
  if (row.analysis) return { status: "done", analysis: row.analysis };
  if (row.analysis_error) return { status: "error", error: row.analysis_error };
  return { status: "pending" };
}
