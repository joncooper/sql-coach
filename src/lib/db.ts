import { Pool, types } from "pg";
import type { QueryResult } from "@/types";

// Parse numeric/int types as JS numbers instead of strings
types.setTypeParser(20, parseFloat); // int8
types.setTypeParser(1700, parseFloat); // numeric

export const adminPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const readonlyPool = new Pool({
  connectionString: process.env.DATABASE_READONLY_URL,
  statement_timeout: 5000,
});

async function queryWithSearchPath(
  pool: Pool,
  sql: string,
  searchPath?: string[],
  maxRows?: number
): Promise<QueryResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (searchPath?.length) {
      await client.query(
        `SET LOCAL search_path TO ${searchPath.join(", ")}, public`
      );
    }
    const start = performance.now();
    const result = await client.query(sql);
    const elapsed = performance.now() - start;
    await client.query("COMMIT");

    const columns = result.fields.map((f) => f.name);
    const allRows = result.rows.map((row) => columns.map((col) => row[col]));
    const rows = maxRows ? allRows.slice(0, maxRows) : allRows;

    return {
      columns,
      rows,
      rowCount: result.rowCount ?? 0,
      executionTimeMs: Math.round(elapsed),
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function executeUserQuery(
  sql: string,
  searchPath?: string[]
): Promise<QueryResult> {
  return queryWithSearchPath(readonlyPool, sql, searchPath, 1000);
}

export async function executeAdminQuery(
  sql: string,
  searchPath?: string[]
): Promise<QueryResult> {
  return queryWithSearchPath(adminPool, sql, searchPath);
}

export async function getTableSchema(tableNames: string[], domain: string) {
  // Tables are now unqualified names; use domain as the schema
  const qualified = tableNames.map((t) =>
    t.includes(".") ? t : `${domain}.${t}`
  );
  const result = await adminPool.query(
    `SELECT table_schema, table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE (table_schema || '.' || table_name) = ANY($1)
     ORDER BY table_schema, table_name, ordinal_position`,
    [qualified]
  );
  return result.rows;
}

export async function getSampleData(
  tableNames: string[],
  domain: string,
  limit = 5
): Promise<Record<string, { columns: string[]; rows: unknown[][] }>> {
  const samples: Record<string, { columns: string[]; rows: unknown[][] }> = {};
  for (const name of tableNames) {
    const qualified = name.includes(".") ? name : `${domain}.${name}`;
    const result = await adminPool.query(
      `SELECT * FROM ${qualified} LIMIT ${limit}`
    );
    const columns = result.fields.map((f) => f.name);
    const rows = result.rows.map((row) => columns.map((col) => row[col]));
    // Use just the table name as the key (not schema-qualified)
    const displayName = name.includes(".") ? name.split(".").pop()! : name;
    samples[displayName] = { columns, rows };
  }
  return samples;
}
