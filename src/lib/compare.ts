import type { RowDiff } from "@/types";

interface CompareOptions {
  orderMatters: boolean;
  expectedColumns: string[];
}

interface CompareResult {
  pass: boolean;
  message: string;
  coaching: string;
  diff: RowDiff[];
}

function normalize(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function rowKey(row: unknown[]): string {
  return JSON.stringify(row.map(normalize));
}

function generateCoaching(diff: RowDiff[], orderMatters: boolean): string {
  const missingRows = diff.filter((d) => d.type === "missing").map((d) => d.row);
  const extraRows = diff.filter((d) => d.type === "extra").map((d) => d.row);
  const missing = missingRows.length;
  const extra = extraRows.length;

  // "Wrong order" only if the missing and extra rows are the *same*
  // multiset of rows — i.e. the right answers are all present, just in
  // the wrong positions. Equal counts alone are not enough: three rows
  // with wrong bonus values will show as 3 missing + 3 extra but
  // aren't a reorder bug.
  if (orderMatters && missing > 0 && extra > 0 && sameMultiset(missingRows, extraRows)) {
    return "The right rows are present but in the wrong order. Check your ORDER BY clause.";
  }

  // Same row count, different content → the values in one or more
  // columns are wrong. This is the common shape for "forgot a CASE",
  // "wrong aggregation", "wrong calculation" bugs.
  if (missing > 0 && extra > 0 && missing === extra) {
    return `Row count matches, but ${missing} row${missing > 1 ? "s have" : " has"} different values than expected. Check your column expressions, CASE statements, calculations, or aggregations.`;
  }

  if (missing > 0 && extra === 0) {
    return `Your query is missing ${missing} expected row${missing > 1 ? "s" : ""}. Your WHERE clause or JOIN might be too restrictive.`;
  }
  if (extra > 0 && missing === 0) {
    return `Your query returns ${extra} extra row${extra > 1 ? "s" : ""}. Tighten your WHERE clause or add DISTINCT.`;
  }
  return `${missing} expected row${missing > 1 ? "s are" : " is"} missing and ${extra} unexpected row${extra > 1 ? "s" : ""} appeared. Check your JOIN conditions, WHERE filters, and the values in your SELECT clause.`;
}

function sameMultiset(a: unknown[][], b: unknown[][]): boolean {
  if (a.length !== b.length) return false;
  const counts = new Map<string, number>();
  for (const row of a) {
    const key = rowKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const row of b) {
    const key = rowKey(row);
    const current = counts.get(key) ?? 0;
    if (current === 0) return false;
    counts.set(key, current - 1);
  }
  return true;
}

export function compareResults(
  expected: { columns: string[]; rows: unknown[][] },
  actual: { columns: string[]; rows: unknown[][] },
  options: CompareOptions
): CompareResult {
  // Check column names
  const expectedCols = options.expectedColumns.map((c) => c.toLowerCase());
  const actualCols = actual.columns.map((c) => c.toLowerCase());

  if (expectedCols.length !== actualCols.length) {
    return {
      pass: false,
      message: `Expected ${expectedCols.length} columns (${expectedCols.join(", ")}), got ${actualCols.length} (${actualCols.join(", ")})`,
      coaching: `Your query returns ${actualCols.length} column${actualCols.length === 1 ? "" : "s"} but ${expectedCols.length} ${expectedCols.length === 1 ? "is" : "are"} expected. Check your SELECT clause.`,
      diff: [],
    };
  }

  for (let i = 0; i < expectedCols.length; i++) {
    if (expectedCols[i] !== actualCols[i]) {
      return {
        pass: false,
        message: `Column ${i + 1}: expected "${expectedCols[i]}", got "${actualCols[i]}"`,
        coaching: `Column ${i + 1} should be "${expectedCols[i]}" but got "${actualCols[i]}". Check your column aliases (AS).`,
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
      return { pass: true, message: "Accepted", coaching: "", diff: [] };
    }
    return {
      pass: false,
      message: `${diff.length} row difference(s) found`,
      coaching: generateCoaching(diff, true),
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
    return { pass: true, message: "Accepted", coaching: "", diff: [] };
  }

  return {
    pass: false,
    message: `${diff.length} row difference(s) found`,
    coaching: generateCoaching(diff, false),
    diff,
  };
}
