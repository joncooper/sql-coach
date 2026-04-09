import { Pool, types } from "pg";
import type { QueryResult } from "@/types";

// Parse numeric/int types as JS numbers instead of strings
types.setTypeParser(20, parseFloat); // int8
types.setTypeParser(1700, parseFloat); // numeric

const adminPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const readonlyPool = new Pool({
  connectionString: process.env.DATABASE_READONLY_URL,
  statement_timeout: 5000,
});

export async function executeUserQuery(sql: string): Promise<QueryResult> {
  const client = await readonlyPool.connect();
  try {
    const start = performance.now();
    const result = await client.query(sql);
    const elapsed = performance.now() - start;

    const columns = result.fields.map((f) => f.name);
    const rows = result.rows.slice(0, 1000).map((row) =>
      columns.map((col) => row[col])
    );

    return {
      columns,
      rows,
      rowCount: result.rowCount ?? 0,
      executionTimeMs: Math.round(elapsed),
    };
  } finally {
    client.release();
  }
}

export async function executeAdminQuery(sql: string): Promise<QueryResult> {
  const start = performance.now();
  const result = await adminPool.query(sql);
  const elapsed = performance.now() - start;

  const columns = result.fields.map((f) => f.name);
  const rows = result.rows.map((row) => columns.map((col) => row[col]));

  return {
    columns,
    rows,
    rowCount: result.rowCount ?? 0,
    executionTimeMs: Math.round(elapsed),
  };
}

export async function getTableSchema(tableRefs: string[]) {
  const result = await adminPool.query(
    `SELECT table_schema, table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE (table_schema || '.' || table_name) = ANY($1)
     ORDER BY table_schema, table_name, ordinal_position`,
    [tableRefs]
  );
  return result.rows;
}

export async function getSampleData(
  tableRefs: string[],
  limit = 5
): Promise<Record<string, { columns: string[]; rows: unknown[][] }>> {
  const samples: Record<string, { columns: string[]; rows: unknown[][] }> = {};
  for (const ref of tableRefs) {
    const result = await adminPool.query(
      `SELECT * FROM ${ref} LIMIT ${limit}`
    );
    const columns = result.fields.map((f) => f.name);
    const rows = result.rows.map((row) => columns.map((col) => row[col]));
    samples[ref] = { columns, rows };
  }
  return samples;
}
