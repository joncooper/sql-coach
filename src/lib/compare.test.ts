import { describe, expect, it } from "bun:test";
import { compareResults } from "./compare";

describe("compareResults — row equality", () => {
  it("treats string whitespace as significant", () => {
    const result = compareResults(
      { columns: ["name"], rows: [["Alice "]] },
      { columns: ["name"], rows: [["Alice"]] },
      { orderMatters: false, expectedColumns: ["name"] }
    );

    expect(result.pass).toBe(false);
    expect(result.diff).toHaveLength(2);
  });

  it("does not round numeric differences during comparison", () => {
    const result = compareResults(
      { columns: ["ratio"], rows: [[1.23445]] },
      { columns: ["ratio"], rows: [[1.23444]] },
      { orderMatters: false, expectedColumns: ["ratio"] }
    );

    expect(result.pass).toBe(false);
    expect(result.diff).toHaveLength(2);
  });
});

// --------------------------------------------------------------------
// generateCoaching — the yellow banner text.
// These tests exercise the heuristics that choose which coaching
// message to show for a given diff.
// --------------------------------------------------------------------

describe("compareResults — coaching text", () => {
  const cols = ["employee_id", "bonus"];
  const EXPECTED_COLS = ["employee_id", "bonus"];

  it("says 'wrong order' only when missing and extra are the same multiset of rows", () => {
    // Expected: [(1, 100), (2, 200), (3, 300)] in order.
    // User returned the same rows in a different order.
    const result = compareResults(
      { columns: cols, rows: [[1, 100], [2, 200], [3, 300]] },
      { columns: cols, rows: [[3, 300], [1, 100], [2, 200]] },
      { orderMatters: true, expectedColumns: EXPECTED_COLS }
    );

    expect(result.pass).toBe(false);
    expect(result.coaching).toMatch(/wrong order/i);
    expect(result.coaching).toMatch(/ORDER BY/);
  });

  it("does NOT say 'wrong order' when row counts match but values differ (Calculate Special Bonus bug)", () => {
    // This is the real-world case: user forgot the CASE expression
    // for Special Bonus. Three employees, three wrong bonus values.
    // missing === extra === 3, but the rows are genuinely different.
    const result = compareResults(
      {
        columns: cols,
        rows: [
          [1, 100],
          [2, 200],
          [3, 0], // employee 3's correct bonus
        ],
      },
      {
        columns: cols,
        rows: [
          [1, 0], // wrong — user's CASE flipped
          [2, 0],
          [3, 300],
        ],
      },
      { orderMatters: true, expectedColumns: EXPECTED_COLS }
    );

    expect(result.pass).toBe(false);
    expect(result.coaching).not.toMatch(/wrong order/i);
    expect(result.coaching).not.toMatch(/ORDER BY/);
    expect(result.coaching).toMatch(/different values/i);
    expect(result.coaching).toMatch(/CASE|calculations|column expressions/i);
  });

  it("does NOT say 'wrong order' when orderMatters is false and counts happen to match", () => {
    const result = compareResults(
      { columns: cols, rows: [[1, 100], [2, 200]] },
      { columns: cols, rows: [[1, 999], [2, 888]] },
      { orderMatters: false, expectedColumns: EXPECTED_COLS }
    );

    expect(result.pass).toBe(false);
    expect(result.coaching).not.toMatch(/wrong order/i);
    expect(result.coaching).toMatch(/different values/i);
  });

  it("reports missing-only rows as 'WHERE too restrictive'", () => {
    const result = compareResults(
      {
        columns: cols,
        rows: [
          [1, 100],
          [2, 200],
          [3, 300],
        ],
      },
      { columns: cols, rows: [[1, 100]] },
      { orderMatters: false, expectedColumns: EXPECTED_COLS }
    );

    expect(result.pass).toBe(false);
    expect(result.coaching).toMatch(/missing 2 expected rows/i);
    expect(result.coaching).toMatch(/WHERE clause or JOIN/i);
  });

  it("reports extra-only rows as 'tighten WHERE or add DISTINCT'", () => {
    const result = compareResults(
      { columns: cols, rows: [[1, 100]] },
      {
        columns: cols,
        rows: [
          [1, 100],
          [2, 200],
          [3, 300],
        ],
      },
      { orderMatters: false, expectedColumns: EXPECTED_COLS }
    );

    expect(result.pass).toBe(false);
    expect(result.coaching).toMatch(/2 extra rows/i);
    expect(result.coaching).toMatch(/tighten your WHERE|DISTINCT/i);
  });

  it("reports asymmetric mismatches with specific counts", () => {
    // 3 missing, 1 extra — not a reorder, not a pure subset/superset.
    const result = compareResults(
      {
        columns: cols,
        rows: [
          [1, 100],
          [2, 200],
          [3, 300],
          [4, 400],
        ],
      },
      {
        columns: cols,
        rows: [
          [1, 100],
          [9, 999],
        ],
      },
      { orderMatters: false, expectedColumns: EXPECTED_COLS }
    );

    expect(result.pass).toBe(false);
    expect(result.coaching).toMatch(/3 expected rows are missing/i);
    expect(result.coaching).toMatch(/1 unexpected row appeared/i);
  });

  it("singularizes messages for a single missing row", () => {
    const result = compareResults(
      { columns: cols, rows: [[1, 100]] },
      { columns: cols, rows: [] },
      { orderMatters: false, expectedColumns: EXPECTED_COLS }
    );

    expect(result.coaching).toMatch(/missing 1 expected row\b/);
    expect(result.coaching).not.toMatch(/rows/);
  });

  it("singularizes messages for a single row with different values", () => {
    const result = compareResults(
      { columns: cols, rows: [[1, 100]] },
      { columns: cols, rows: [[1, 999]] },
      { orderMatters: true, expectedColumns: EXPECTED_COLS }
    );

    expect(result.coaching).toMatch(/1 row has different values/i);
  });

  it("returns an empty coaching string when the query is accepted", () => {
    const result = compareResults(
      { columns: cols, rows: [[1, 100]] },
      { columns: cols, rows: [[1, 100]] },
      { orderMatters: true, expectedColumns: EXPECTED_COLS }
    );

    expect(result.pass).toBe(true);
    expect(result.coaching).toBe("");
  });
});
