import { describe, expect, test } from "bun:test";
import type { ProblemSummary } from "@/types";
import { computeNext, sortCatalog } from "./problem-navigation";
import type { CatalogContext } from "./catalog-context";

function p(
  slug: string,
  category: string,
  difficulty: ProblemSummary["difficulty"] = "easy",
  title?: string,
): ProblemSummary {
  return {
    slug,
    title: title ?? slug.replace(/-/g, " "),
    difficulty,
    category,
    tags: [],
  };
}

// Matches src/lib/coach.test.ts CATALOG for consistency.
const CATALOG: ProblemSummary[] = [
  p("bs-1", "basic-select", "easy"),
  p("bs-2", "basic-select", "easy"),
  p("bs-3", "basic-select", "medium"),
  p("bs-4", "basic-select", "hard"),
  p("j-1", "joins", "easy"),
  p("j-2", "joins", "medium"),
  p("j-3", "joins", "hard"),
  p("agg-1", "aggregation", "easy"),
  p("agg-2", "aggregation", "medium"),
  p("sq-1", "subqueries", "medium"),
  p("sq-2", "subqueries", "hard"),
];

function ctx(overrides: Partial<CatalogContext> = {}): CatalogContext {
  return {
    difficulty: [],
    category: null,
    sortKey: "num",
    sortDir: "asc",
    updatedAt: "2026-04-16T00:00:00Z",
    ...overrides,
  };
}

describe("sortCatalog", () => {
  test("num asc preserves skill-tree order", () => {
    const out = sortCatalog(CATALOG, "num", "asc");
    expect(out.map((x) => x.slug)).toEqual([
      "bs-1",
      "bs-2",
      "bs-3",
      "bs-4",
      "j-1",
      "j-2",
      "j-3",
      "agg-1",
      "agg-2",
      "sq-1",
      "sq-2",
    ]);
  });

  test("num desc reverses skill-tree order", () => {
    const out = sortCatalog(CATALOG, "num", "desc");
    expect(out[0].slug).toBe("sq-2");
    expect(out[out.length - 1].slug).toBe("bs-1");
  });

  test("title asc sorts alphabetically", () => {
    const out = sortCatalog(CATALOG, "title", "asc");
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].title.localeCompare(out[i].title)).toBeLessThanOrEqual(0);
    }
  });

  test("difficulty asc groups easy→medium→hard", () => {
    const out = sortCatalog(CATALOG, "difficulty", "asc");
    const firstHardIdx = out.findIndex((x) => x.difficulty === "hard");
    const lastEasyIdx = out.map((x) => x.difficulty).lastIndexOf("easy");
    expect(lastEasyIdx).toBeLessThan(firstHardIdx);
  });
});

describe("computeNext without catalog context", () => {
  test("advances in skill-tree order", () => {
    const result = computeNext("bs-2", CATALOG, null);
    expect(result.kind).toBe("next");
    expect(result.slug).toBe("bs-3");
  });

  test("returns end-of-catalog at the last problem", () => {
    const result = computeNext("sq-2", CATALOG, null);
    expect(result.kind).toBe("end-of-catalog");
    expect(result.slug).toBeNull();
  });

  test("returns end-of-catalog for an unknown slug", () => {
    const result = computeNext("does-not-exist", CATALOG, null);
    expect(result.kind).toBe("end-of-catalog");
    expect(result.slug).toBeNull();
  });
});

describe("computeNext with category + difficulty filter", () => {
  test("advances inside the filter slice", () => {
    // Medium joins filter: only j-2 matches → from j-2 we've cleared the slice.
    // So test advancement via a category-only filter with multiple matches.
    const result = computeNext(
      "j-1",
      CATALOG,
      ctx({ category: "joins" }),
    );
    expect(result.kind).toBe("next");
    expect(result.slug).toBe("j-2");
  });

  test("end-of-filter with next section when category exhausted at a difficulty", () => {
    // Difficulty=medium, category=joins → only j-2 matches → next section
    // at medium is aggregation (agg-2).
    const result = computeNext(
      "j-2",
      CATALOG,
      ctx({ category: "joins", difficulty: ["medium"] }),
    );
    expect(result.kind).toBe("end-of-filter");
    expect(result.slug).toBeNull();
    expect(result.nextSectionSlug).toBe("agg-2");
    expect(result.nextSectionLabel).toBe("Aggregation");
    expect(result.filterLabel).toContain("Medium");
    expect(result.filterLabel).toContain("Joins");
  });

  test("end-of-filter with no next section when no later category matches", () => {
    // Category=subqueries, difficulty=hard → only sq-2 matches. No later
    // category has a hard problem, so nextSectionSlug is null.
    const result = computeNext(
      "sq-2",
      CATALOG,
      ctx({ category: "subqueries", difficulty: ["hard"] }),
    );
    expect(result.kind).toBe("end-of-filter");
    expect(result.nextSectionSlug).toBeNull();
    expect(result.nextSectionLabel).toBeNull();
  });

  test("end-of-filter finds the next section even when the immediately-next one doesn't match", () => {
    // basic-select has easy problems, so does joins. But medium-only filter
    // in basic-select: bs-3 is the only one. Next section at medium should
    // be joins (j-2), not aggregation.
    const result = computeNext(
      "bs-3",
      CATALOG,
      ctx({ category: "basic-select", difficulty: ["medium"] }),
    );
    expect(result.kind).toBe("end-of-filter");
    expect(result.nextSectionSlug).toBe("j-2");
    expect(result.nextSectionLabel).toBe("Joins");
  });
});

describe("computeNext with difficulty-only filter", () => {
  test("advances through the difficulty slice across categories", () => {
    // Easy-only: bs-1, bs-2, j-1, agg-1. From bs-2 → j-1.
    const result = computeNext(
      "bs-2",
      CATALOG,
      ctx({ difficulty: ["easy"] }),
    );
    expect(result.kind).toBe("next");
    expect(result.slug).toBe("j-1");
  });

  test("end-of-filter with no next section when pure-difficulty filter is exhausted", () => {
    // Easy-only from the last easy (agg-1) → end-of-filter.
    const result = computeNext(
      "agg-1",
      CATALOG,
      ctx({ difficulty: ["easy"] }),
    );
    expect(result.kind).toBe("end-of-filter");
    expect(result.slug).toBeNull();
    // No category was pinned → no next section.
    expect(result.nextSectionSlug).toBeNull();
    expect(result.filterLabel).toContain("Easy");
  });
});

describe("computeNext with category-only filter", () => {
  test("stays inside the category", () => {
    const result = computeNext(
      "bs-1",
      CATALOG,
      ctx({ category: "basic-select" }),
    );
    expect(result.kind).toBe("next");
    expect(result.slug).toBe("bs-2");
  });

  test("exhausts into next section when category runs out", () => {
    // Category=basic-select, last problem bs-4 → next section joins (j-1).
    const result = computeNext(
      "bs-4",
      CATALOG,
      ctx({ category: "basic-select" }),
    );
    expect(result.kind).toBe("end-of-filter");
    expect(result.nextSectionSlug).toBe("j-1");
    expect(result.nextSectionLabel).toBe("Joins");
  });
});

describe("computeNext fallback behavior", () => {
  test("falls back to skill-tree order when the current slug doesn't match the filter", () => {
    // Filter says category=joins but we're on bs-2 (basic-select). The
    // filtered slice doesn't contain bs-2, so fall back to tree adjacency.
    const result = computeNext(
      "bs-2",
      CATALOG,
      ctx({ category: "joins" }),
    );
    expect(result.kind).toBe("next");
    expect(result.slug).toBe("bs-3");
  });
});
