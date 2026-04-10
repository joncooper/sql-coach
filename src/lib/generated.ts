import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";
import type { Problem } from "@/types";

const GENERATED_DIR = join(process.cwd(), "generated");

export interface GeneratedProblem {
  schema_name: string;
  gen_schema: string; // the actual PG schema name (gen_ prefixed)
  ddl: string;
  seed_data: string;
  problem: Problem;
}

function rewriteSchema(sql: string, from: string, to: string): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sql.replace(new RegExp(`\\b${escaped}\\b`, "gi"), to);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function storeGenerated(gp: GeneratedProblem): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true });
  const filepath = join(GENERATED_DIR, `${gp.problem.slug}.json`);
  await writeFile(filepath, JSON.stringify(gp, null, 2));
}

export async function listGenerated(): Promise<GeneratedProblem[]> {
  try {
    const files = await readdir(GENERATED_DIR);
    const results: GeneratedProblem[] = [];
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const raw = await readFile(join(GENERATED_DIR, file), "utf-8");
      results.push(JSON.parse(raw));
    }
    return results;
  } catch {
    return []; // directory doesn't exist yet
  }
}

export async function getGenerated(
  slug: string
): Promise<GeneratedProblem | null> {
  try {
    const raw = await readFile(
      join(GENERATED_DIR, `${slug}.json`),
      "utf-8"
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function ensureGeneratedSchema(
  gp: GeneratedProblem
): Promise<void> {
  const genSchema = gp.gen_schema;

  // Check if schema exists
  const check = await pool.query(
    `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
    [genSchema]
  );
  if (check.rows.length > 0) return; // already exists

  // Re-create from stored DDL + seed data
  const ddl = rewriteSchema(gp.ddl, gp.schema_name, genSchema);
  const dml = rewriteSchema(gp.seed_data, gp.schema_name, genSchema);

  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${genSchema}`);
  await pool.query(ddl);
  await pool.query(dml);

  // Grant readonly access
  await pool.query(
    `GRANT USAGE ON SCHEMA ${genSchema} TO coach_readonly`
  );
  await pool.query(
    `GRANT SELECT ON ALL TABLES IN SCHEMA ${genSchema} TO coach_readonly`
  );
}

/**
 * Validate and create a generated problem schema.
 * Returns the GeneratedProblem with gen_schema set, or throws on failure.
 */
export async function validateAndCreate(raw: {
  schema_name: string;
  ddl: string;
  seed_data: string;
  problem: Problem;
}): Promise<GeneratedProblem> {
  const genSchema = `gen_${raw.schema_name}`;

  // Rewrite all SQL to use the gen_ prefix
  const ddl = rewriteSchema(raw.ddl, raw.schema_name, genSchema);
  const dml = rewriteSchema(raw.seed_data, raw.schema_name, genSchema);
  const solution = rewriteSchema(
    raw.problem.solution,
    raw.schema_name,
    genSchema
  );

  // Rewrite table references in the problem
  const tables = raw.problem.tables.map((t) =>
    rewriteSchema(t, raw.schema_name, genSchema)
  );

  try {
    // Create schema and execute DDL
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${genSchema}`);
    await pool.query(ddl);

    // Execute seed data
    await pool.query(dml);

    // Execute solution and verify it works
    const result = await pool.query(solution);
    if (!result.rows || result.rows.length === 0) {
      throw new Error("Solution returned 0 rows");
    }

    // Verify columns match
    const actualCols = result.fields.map((f) => f.name.toLowerCase());
    const expectedCols = raw.problem.expected_columns.map((c) =>
      c.toLowerCase()
    );
    if (
      actualCols.length !== expectedCols.length ||
      !actualCols.every((c, i) => c === expectedCols[i])
    ) {
      throw new Error(
        `Column mismatch: expected [${expectedCols}], got [${actualCols}]`
      );
    }

    // Grant readonly access
    await pool.query(
      `GRANT USAGE ON SCHEMA ${genSchema} TO coach_readonly`
    );
    await pool.query(
      `GRANT SELECT ON ALL TABLES IN SCHEMA ${genSchema} TO coach_readonly`
    );

    // Sanitize starter_code — LLMs often put partial solutions in it.
    // Only keep it if it's clearly a placeholder (short comment + SELECT ...).
    let starterCode = raw.problem.starter_code ?? "";
    const starterHasRealSQL =
      starterCode.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim().length > 30;
    if (starterHasRealSQL) {
      starterCode = `-- Write your query here\nSELECT\n  \nFROM ${tables[0]}`;
    }

    const gp: GeneratedProblem = {
      schema_name: raw.schema_name,
      gen_schema: genSchema,
      ddl: raw.ddl,
      seed_data: raw.seed_data,
      problem: {
        ...raw.problem,
        starter_code: starterCode,
        solution,
        tables,
        domain: genSchema,
      },
    };

    return gp;
  } catch (err) {
    // Cleanup on failure
    await pool
      .query(`DROP SCHEMA IF EXISTS ${genSchema} CASCADE`)
      .catch(() => {});
    throw err;
  }
}
