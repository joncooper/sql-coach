import type { CriterionResult, GeneratedProblem, Problem } from "../types.ts";
import { withTempSchema, executeSQL } from "../lib/db.ts";

const REQUIRED_FIELDS: Array<{ key: keyof Problem; type: string }> = [
  { key: "slug", type: "string" },
  { key: "title", type: "string" },
  { key: "difficulty", type: "string" },
  { key: "category", type: "string" },
  { key: "tags", type: "object" },
  { key: "domain", type: "string" },
  { key: "tables", type: "object" },
  { key: "description", type: "string" },
  { key: "hints", type: "object" },
  { key: "order_matters", type: "boolean" },
  { key: "solution", type: "string" },
  { key: "expected_columns", type: "object" },
];

const VALID_DIFFICULTIES = ["easy", "medium", "hard"];

function rewriteSchema(sql: string, from: string, to: string): string {
  // Replace schema references: from.table -> to.table and CREATE SCHEMA from -> CREATE SCHEMA to
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sql.replace(new RegExp(`\\b${escaped}\\b`, "gi"), to);
}

export async function judgeProblemGen(
  rawResponse: string
): Promise<{ criteria: CriterionResult[]; parsed?: GeneratedProblem }> {
  const criteria: CriterionResult[] = [];

  // 1. json_valid
  let parsed: GeneratedProblem;
  try {
    parsed = JSON.parse(rawResponse);
    criteria.push({ name: "json_valid", pass: true });
  } catch (err) {
    criteria.push({
      name: "json_valid",
      pass: false,
      detail: (err as Error).message,
    });
    // Remaining criteria all skip
    for (const name of [
      "schema_valid", "ddl_executes", "dml_executes",
      "solution_executes", "columns_match", "hints_progressive",
    ]) {
      criteria.push({ name, pass: false, detail: "skipped: invalid JSON" });
    }
    return { criteria };
  }

  // 2. schema_valid
  const schemaErrors: string[] = [];

  if (typeof parsed.schema_name !== "string" || !parsed.schema_name) {
    schemaErrors.push("schema_name missing or not a string");
  }
  if (typeof parsed.ddl !== "string" || !parsed.ddl) {
    schemaErrors.push("ddl missing or not a string");
  }
  if (typeof parsed.seed_data !== "string" || !parsed.seed_data) {
    schemaErrors.push("seed_data missing or not a string");
  }
  if (!parsed.problem || typeof parsed.problem !== "object") {
    schemaErrors.push("problem missing or not an object");
  } else {
    for (const { key, type } of REQUIRED_FIELDS) {
      const val = parsed.problem[key];
      if (val === undefined || val === null) {
        schemaErrors.push(`problem.${key} missing`);
      } else if (typeof val !== type) {
        schemaErrors.push(
          `problem.${key}: expected ${type}, got ${typeof val}`
        );
      }
    }

    if (
      parsed.problem.difficulty &&
      !VALID_DIFFICULTIES.includes(parsed.problem.difficulty)
    ) {
      schemaErrors.push(
        `problem.difficulty: "${parsed.problem.difficulty}" not in ${VALID_DIFFICULTIES}`
      );
    }

    if (Array.isArray(parsed.problem.category)) {
      schemaErrors.push("problem.category must be a string, not an array");
    }

    if (
      parsed.problem.tags &&
      !Array.isArray(parsed.problem.tags)
    ) {
      schemaErrors.push("problem.tags must be an array");
    }

    if (
      parsed.problem.hints &&
      !Array.isArray(parsed.problem.hints)
    ) {
      schemaErrors.push("problem.hints must be an array");
    }

    if (
      parsed.problem.expected_columns &&
      !Array.isArray(parsed.problem.expected_columns)
    ) {
      schemaErrors.push("problem.expected_columns must be an array");
    }
  }

  criteria.push({
    name: "schema_valid",
    pass: schemaErrors.length === 0,
    detail: schemaErrors.length > 0 ? schemaErrors.join("; ") : undefined,
  });

  if (schemaErrors.length > 0 || !parsed.schema_name || !parsed.problem) {
    for (const name of [
      "ddl_executes", "dml_executes", "solution_executes",
      "columns_match", "hints_progressive",
    ]) {
      criteria.push({ name, pass: false, detail: "skipped: invalid schema" });
    }
    return { criteria, parsed };
  }

  // 3-6: Execute in temp schema
  await withTempSchema(async (tempSchema) => {
    const schemaName = parsed.schema_name;

    // 3. ddl_executes
    const ddl = rewriteSchema(parsed.ddl, schemaName, tempSchema);
    const ddlResult = await executeSQL(ddl);
    criteria.push({
      name: "ddl_executes",
      pass: !ddlResult.error,
      detail: ddlResult.error,
    });

    if (ddlResult.error) {
      for (const name of ["dml_executes", "solution_executes", "columns_match"]) {
        criteria.push({ name, pass: false, detail: "skipped: DDL failed" });
      }
      return;
    }

    // 4. dml_executes
    const dml = rewriteSchema(parsed.seed_data, schemaName, tempSchema);
    const dmlResult = await executeSQL(dml);
    criteria.push({
      name: "dml_executes",
      pass: !dmlResult.error,
      detail: dmlResult.error,
    });

    if (dmlResult.error) {
      for (const name of ["solution_executes", "columns_match"]) {
        criteria.push({ name, pass: false, detail: "skipped: DML failed" });
      }
      return;
    }

    // 5. solution_executes
    const solution = rewriteSchema(parsed.problem.solution, schemaName, tempSchema);
    const solResult = await executeSQL(solution);
    criteria.push({
      name: "solution_executes",
      pass: !solResult.error && solResult.rows.length > 0,
      detail: solResult.error ?? (solResult.rows.length === 0 ? "solution returned 0 rows" : undefined),
    });

    // 6. columns_match
    if (!solResult.error && solResult.columns.length > 0) {
      const expected = parsed.problem.expected_columns.map((c) => c.toLowerCase());
      const actual = solResult.columns.map((c) => c.toLowerCase());
      const match =
        expected.length === actual.length &&
        expected.every((col, i) => col === actual[i]);
      criteria.push({
        name: "columns_match",
        pass: match,
        detail: match
          ? undefined
          : `expected [${expected}], got [${actual}]`,
      });
    } else {
      criteria.push({
        name: "columns_match",
        pass: false,
        detail: "skipped: solution failed or returned no columns",
      });
    }
  });

  // 7. hints_progressive
  const hints = parsed.problem.hints ?? [];
  const solutionNorm = (parsed.problem.solution ?? "")
    .replace(/\s+/g, " ")
    .replace(/;/g, "")
    .trim()
    .toLowerCase();

  const hintContainsSolution = hints.some((h) => {
    const hNorm = h.replace(/\s+/g, " ").trim().toLowerCase();
    return hNorm.includes(solutionNorm) || solutionNorm.includes(hNorm);
  });

  criteria.push({
    name: "hints_progressive",
    pass: hints.length >= 2 && !hintContainsSolution,
    detail:
      hints.length < 2
        ? `only ${hints.length} hint(s)`
        : hintContainsSolution
          ? "a hint contains the full solution"
          : undefined,
  });

  return { criteria, parsed };
}
