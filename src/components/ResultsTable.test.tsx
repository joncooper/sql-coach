import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import ResultsTable from "./ResultsTable";

describe("ResultsTable", () => {
  describe("isLoading skeleton state", () => {
    test("renders 3 skeleton rows with aria-busy when isLoading is true", () => {
      const { container } = render(
        <ResultsTable
          columns={["name", "revenue", "rank"]}
          rows={[]}
          mode="run"
          isLoading
        />
      );

      const table = container.querySelector("table");
      expect(table).not.toBeNull();
      expect(table!.getAttribute("aria-busy")).toBe("true");

      // 3 skeleton rows.
      const tbodyRows = table!.querySelectorAll("tbody tr");
      expect(tbodyRows.length).toBe(3);

      // Loading footer message instead of "N rows · Xms".
      expect(container.textContent).toContain("Running query…");
    });

    test("falls back to 3-column skeleton when columns are empty", () => {
      const { container } = render(
        <ResultsTable columns={[]} rows={[]} mode="run" isLoading />
      );

      const headers = container.querySelectorAll("thead th");
      // 1 index column + 3 placeholder columns = 4
      expect(headers.length).toBe(4);
    });
  });

  describe("empty state", () => {
    test("run mode shows 'Run a query' hint", () => {
      const { container } = render(
        <ResultsTable columns={[]} rows={[]} mode="run" />
      );
      expect(container.textContent).toContain("Run a query to see results");
    });

    test("submit mode shows 'Your submitted query returned no rows'", () => {
      const { container } = render(
        <ResultsTable columns={[]} rows={[]} mode="submit" />
      );
      expect(container.textContent).toContain(
        "Your submitted query returned no rows"
      );
    });

    test("expected mode shows reference hint", () => {
      const { container } = render(
        <ResultsTable columns={[]} rows={[]} mode="expected" />
      );
      expect(container.textContent).toContain("reference query returns no rows");
    });
  });

  describe("error state", () => {
    test("renders error text in an alert role", () => {
      const { getByRole } = render(
        <ResultsTable
          columns={[]}
          rows={[]}
          mode="run"
          error="relation 'nope' does not exist"
        />
      );
      const alert = getByRole("alert");
      expect(alert.textContent).toContain("relation 'nope' does not exist");
    });

    test("error takes precedence over isLoading", () => {
      const { getByRole, container } = render(
        <ResultsTable
          columns={[]}
          rows={[]}
          mode="run"
          error="boom"
          isLoading
        />
      );
      const alert = getByRole("alert");
      expect(alert.textContent).toContain("boom");
      // Skeleton footer should not appear.
      expect(container.textContent).not.toContain("Running query…");
    });
  });

  describe("data rendering", () => {
    test("renders column headers and rows", () => {
      const { container } = render(
        <ResultsTable
          columns={["name", "revenue"]}
          rows={[
            ["Globex Corp", 48200],
            ["Acme Inc", 42150],
          ]}
          mode="run"
          executionTimeMs={34}
          rowCount={2}
        />
      );

      expect(container.textContent).toContain("name");
      expect(container.textContent).toContain("revenue");
      expect(container.textContent).toContain("Globex Corp");
      expect(container.textContent).toContain("48200");
      expect(container.textContent).toContain("2 rows");
      expect(container.textContent).toContain("34ms");
    });

    test("null cells render as a NULL pill", () => {
      const { container } = render(
        <ResultsTable
          columns={["name", "note"]}
          rows={[["Alice", null]]}
          mode="run"
        />
      );
      expect(container.textContent).toContain("NULL");
    });
  });
});
