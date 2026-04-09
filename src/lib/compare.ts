import type { RowDiff } from "@/types";

interface CompareOptions {
  orderMatters: boolean;
  expectedColumns: string[];
}

function normalize(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(4);
  }
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function rowKey(row: unknown[]): string {
  return row.map(normalize).join("|||");
}

export function compareResults(
  expected: { columns: string[]; rows: unknown[][] },
  actual: { columns: string[]; rows: unknown[][] },
  options: CompareOptions
): { pass: boolean; message: string; diff: RowDiff[] } {
  // Check column names
  const expectedCols = options.expectedColumns.map((c) => c.toLowerCase());
  const actualCols = actual.columns.map((c) => c.toLowerCase());

  if (expectedCols.length !== actualCols.length) {
    return {
      pass: false,
      message: `Expected ${expectedCols.length} columns (${expectedCols.join(", ")}), got ${actualCols.length} (${actualCols.join(", ")})`,
      diff: [],
    };
  }

  for (let i = 0; i < expectedCols.length; i++) {
    if (expectedCols[i] !== actualCols[i]) {
      return {
        pass: false,
        message: `Column ${i + 1}: expected "${expectedCols[i]}", got "${actualCols[i]}"`,
        diff: [],
      };
    }
  }

  // Check rows
  const expectedRows = expected.rows;
  const actualRows = actual.rows;

  if (options.orderMatters) {
    const diff: RowDiff[] = [];
    const maxLen = Math.max(expectedRows.length, actualRows.length);

    for (let i = 0; i < maxLen; i++) {
      const eKey = i < expectedRows.length ? rowKey(expectedRows[i]) : null;
      const aKey = i < actualRows.length ? rowKey(actualRows[i]) : null;

      if (eKey !== aKey) {
        if (i >= actualRows.length) {
          diff.push({ type: "missing", row: expectedRows[i] });
        } else if (i >= expectedRows.length) {
          diff.push({ type: "extra", row: actualRows[i] });
        } else {
          diff.push({ type: "missing", row: expectedRows[i] });
          diff.push({ type: "extra", row: actualRows[i] });
        }
      }
    }

    if (diff.length === 0) {
      return { pass: true, message: "Accepted", diff: [] };
    }
    return {
      pass: false,
      message: `${diff.length} row difference(s) found`,
      diff,
    };
  }

  // Order doesn't matter: compare as multisets
  const expectedMap = new Map<string, number>();
  for (const row of expectedRows) {
    const key = rowKey(row);
    expectedMap.set(key, (expectedMap.get(key) ?? 0) + 1);
  }

  const actualMap = new Map<string, number>();
  for (const row of actualRows) {
    const key = rowKey(row);
    actualMap.set(key, (actualMap.get(key) ?? 0) + 1);
  }

  const diff: RowDiff[] = [];

  // Find missing rows (in expected but not actual)
  for (const row of expectedRows) {
    const key = rowKey(row);
    const expectedCount = expectedMap.get(key) ?? 0;
    const actualCount = actualMap.get(key) ?? 0;
    if (actualCount < expectedCount) {
      diff.push({ type: "missing", row });
      // Adjust to avoid duplicate reporting
      expectedMap.set(key, expectedCount - 1);
      actualMap.set(key, actualCount > 0 ? actualCount - 1 : 0);
    }
  }

  // Find extra rows (in actual but not expected)
  // Reset maps
  const expectedMap2 = new Map<string, number>();
  for (const row of expectedRows) {
    const key = rowKey(row);
    expectedMap2.set(key, (expectedMap2.get(key) ?? 0) + 1);
  }

  for (const row of actualRows) {
    const key = rowKey(row);
    const remaining = expectedMap2.get(key) ?? 0;
    if (remaining > 0) {
      expectedMap2.set(key, remaining - 1);
    } else {
      diff.push({ type: "extra", row });
    }
  }

  if (diff.length === 0) {
    return { pass: true, message: "Accepted", diff: [] };
  }

  return {
    pass: false,
    message: `${diff.length} row difference(s) found`,
    diff,
  };
}
