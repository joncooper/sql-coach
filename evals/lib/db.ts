import pg from "pg";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import type { Problem } from "../types.ts";

const { Pool, types } = pg;

// Match the app's type parsing
types.setTypeParser(20, parseFloat); // int8
types.setTypeParser(1700, parseFloat); // numeric

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  error?: string;
}

export async function executeSQL(sql: string): Promise<QueryResult> {
  try {
    const result = await pool.query(sql);
    // DDL statements (CREATE TABLE, etc.) don't return fields/rows
    const columns = result.fields?.map((f) => f.name) ?? [];
    const rows = result.rows?.map((row) => columns.map((col) => row[col])) ?? [];
    return { columns, rows };
  } catch (err: unknown) {
    return { columns: [], rows: [], error: (err as Error).message };
  }
}

let schemaCounter = 0;

export async function withTempSchema<T>(
  fn: (schemaName: string) => Promise<T>
): Promise<T> {
  const schemaName = `eval_${Date.now()}_${schemaCounter++}`;
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
  try {
    return await fn(schemaName);
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
  }
}

export async function cleanupStaleSchemas(): Promise<number> {
  const result = await pool.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'eval_%'`
  );
  for (const row of result.rows) {
    await pool.query(`DROP SCHEMA IF EXISTS ${row.schema_name} CASCADE`);
  }
  return result.rows.length;
}

const PROBLEMS_DIR = join(process.cwd(), "problems");

export async function loadProblem(slug: string): Promise<Problem> {
  const files = await import("node:fs/promises").then((fs) =>
    fs.readdir(PROBLEMS_DIR)
  );
  const file = files.find(
    (f) => f.endsWith(".yml") && f.includes(slug)
  );
  if (!file) throw new Error(`Problem not found: ${slug}`);
  const raw = await readFile(join(PROBLEMS_DIR, file), "utf-8");
  return yaml.load(raw) as Problem;
}

export async function shutdown(): Promise<void> {
  await pool.end();
}
