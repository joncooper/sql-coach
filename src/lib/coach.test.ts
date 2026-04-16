import { describe, expect, it } from "bun:test";
import type { ProblemSummary, StatsStore, ProblemStats } from "@/types";
import {
  computeCategoryMastery,
  getReinforcementQueue,
  getReviewQueue,
  pickNextProblem,
} from "./coach";

// --------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------

const CLOCK = {
  now: new Date("2026-04-13T15:00:00Z"),
  timeZone: "UTC",
} as const;

function problem(
  slug: string,
  category: string,
  difficulty: "easy" | "medium" | "hard" = "easy",
): ProblemSummary {
  return {
    slug,
    title: slug.replace(/-/g, " "),
    difficulty,
    category,
    tags: [],
  };
}

function emptyStore(): StatsStore {
  return {
    version: 2,
    problems: {},
    global: { activeDays: [], longestStreak: 0 },
  };
}

function stats(overrides: Partial<ProblemStats> = {}): ProblemStats {
  return {
    attempts: 0,
    solvedAt: null,
    lastAttemptAt: null,
    lastSolvedAt: null,
    hintsUsed: 0,
    solutionViewed: false,
    bestTimeMs: null,
    solveHistory: [],
    nextReviewAt: null,
    ...overrides,
  };
}

function markSolved(
  store: StatsStore,
  slug: string,
  solvedDate = "2026-04-10",
): void {
  store.problems[slug] = stats({
    attempts: 1,
    solvedAt: `${solvedDate}T00:00:00Z`,
    lastSolvedAt: `${solvedDate}T00:00:00Z`,
    lastAttemptAt: `${solvedDate}T00:00:00Z`,
    solveHistory: [solvedDate],
    nextReviewAt: "2026-06-01", // far future
  });
}

const CATALOG: ProblemSummary[] = [
  // basic-select: tier 0, no prereqs
  problem("bs-1", "basic-select", "easy"),
  problem("bs-2", "basic-select", "easy"),
  problem("bs-3", "basic-select", "medium"),
  problem("bs-4", "basic-select", "hard"),

  // joins: tier 1, requires basic-select
  problem("j-1", "joins", "easy"),
  problem("j-2", "joins", "medium"),
  problem("j-3", "joins", "hard"),

  // aggregation: tier 1, requires basic-select
  problem("agg-1", "aggregation", "easy"),
  problem("agg-2", "aggregation", "medium"),

  // subqueries: tier 2, requires joins + aggregation
  problem("sq-1", "subqueries", "medium"),
  problem("sq-2", "subqueries", "hard"),
];

// --------------------------------------------------------------------
// computeCategoryMastery — unchanged semantics, keep the old assertions.
// --------------------------------------------------------------------

describe("computeCategoryMastery", () => {
  it("returns zero scores for an empty store", () => {
    const mastery = computeCategoryMastery(emptyStore(), CATALOG, CLOCK);
    expect(mastery.length).toBeGreaterThan(0);
    for (const row of mastery) {
      expect(row.score).toBe(0);
    }
  });

  it("scores a single solved problem against category total", () => {
    const store = emptyStore();
    markSolved(store, "bs-1", "2026-04-12");
    const mastery = computeCategoryMastery(store, CATALOG, CLOCK);
    const basic = mastery.find((m) => m.category === "basic-select")!;
    expect(basic.total).toBe(4);
    expect(basic.solved).toBe(1);
    expect(basic.score).toBeCloseTo(0.1);
  });

  it("locks categories whose prerequisites are below threshold", () => {
    const mastery = computeCategoryMastery(emptyStore(), CATALOG, CLOCK);
    expect(mastery.find((m) => m.category === "basic-select")!.unlocked).toBe(
      true,
    );
    expect(mastery.find((m) => m.category === "joins")!.unlocked).toBe(false);
    expect(mastery.find((m) => m.category === "subqueries")!.unlocked).toBe(
      false,
    );
  });

  it("unlocks downstream categories once prerequisites cross the threshold", () => {
    const store = emptyStore();
    for (const slug of ["bs-1", "bs-2", "bs-3", "bs-4"]) {
      markSolved(store, slug, "2026-04-12");
    }
    const mastery = computeCategoryMastery(store, CATALOG, CLOCK);
    expect(mastery.find((m) => m.category === "basic-select")!.score).toBeCloseTo(
      0.4,
    );
    expect(mastery.find((m) => m.category === "joins")!.unlocked).toBe(true);
  });

  it("sorts mastery rows by tier then skill-tree position", () => {
    const mastery = computeCategoryMastery(emptyStore(), CATALOG, CLOCK);
    const basic = mastery.findIndex((m) => m.category === "basic-select");
    const joins = mastery.findIndex((m) => m.category === "joins");
    const sq = mastery.findIndex((m) => m.category === "subqueries");
    expect(basic).toBeLessThan(joins);
    expect(joins).toBeLessThan(sq);
  });
});

// --------------------------------------------------------------------
// getReviewQueue — unchanged; still used for the explicit Review pill.
// --------------------------------------------------------------------

describe("getReviewQueue", () => {
  it("returns nothing when no problems are solved", () => {
    expect(getReviewQueue(emptyStore(), CLOCK)).toEqual([]);
  });

  it("includes problems whose nextReviewAt is today or earlier", () => {
    const store = emptyStore();
    store.problems["bs-1"] = stats({
      attempts: 2,
      solvedAt: "2026-04-05T00:00:00Z",
      lastSolvedAt: "2026-04-05T00:00:00Z",
      lastAttemptAt: "2026-04-05T00:00:00Z",
      solveHistory: ["2026-04-05"],
      nextReviewAt: "2026-04-10", // 3 days overdue
    });
    const queue = getReviewQueue(store, CLOCK);
    expect(queue.map((q) => q.slug)).toEqual(["bs-1"]);
    expect(queue[0].daysOverdue).toBe(3);
  });
});

// --------------------------------------------------------------------
// getReinforcementQueue — new; problems solved once but not yet practiced.
// --------------------------------------------------------------------

describe("getReinforcementQueue", () => {
  it("returns empty for an empty store", () => {
    expect(getReinforcementQueue(emptyStore(), CATALOG, CLOCK)).toEqual([]);
  });

  it("includes problems at mastery level 'solved' but not 'practiced' or beyond", () => {
    const store = emptyStore();
    // Solved once (level = "solved").
    markSolved(store, "bs-1", "2026-04-10");
    // Solved 3 times on 3 different days, within 30 days → "practiced".
    store.problems["bs-2"] = stats({
      attempts: 3,
      solvedAt: "2026-03-15T00:00:00Z",
      lastSolvedAt: "2026-04-10T00:00:00Z",
      lastAttemptAt: "2026-04-10T00:00:00Z",
      solveHistory: ["2026-03-15", "2026-04-01", "2026-04-10"],
      nextReviewAt: "2026-06-01",
    });

    const queue = getReinforcementQueue(store, CATALOG, CLOCK);
    const slugs = queue.map((p) => p.slug);
    expect(slugs).toContain("bs-1");
    expect(slugs).not.toContain("bs-2");
  });

  it("orders by oldest last-solve first", () => {
    const store = emptyStore();
    markSolved(store, "bs-1", "2026-04-10");
    markSolved(store, "bs-2", "2026-04-01");
    const queue = getReinforcementQueue(store, CATALOG, CLOCK);
    expect(queue.map((p) => p.slug)).toEqual(["bs-2", "bs-1"]);
  });
});

// --------------------------------------------------------------------
// pickNextProblem — the rewrite is the point.
// --------------------------------------------------------------------

describe("pickNextProblem", () => {
  it("picks the first unsolved problem in the lowest-tier unlocked category for a fresh store", () => {
    const pick = pickNextProblem(emptyStore(), CATALOG, CLOCK);
    expect(pick.problem?.slug).toBe("bs-1");
    expect(pick.problem?.category).toBe("basic-select");
    expect(pick.kind).toBe("new-territory");
  });

  it("never picks a problem whose prerequisites are not met", () => {
    const pick = pickNextProblem(emptyStore(), CATALOG, CLOCK);
    expect(pick.problem!.category).not.toBe("joins");
    expect(pick.problem!.category).not.toBe("aggregation");
    expect(pick.problem!.category).not.toBe("subqueries");
  });

  it("sticks with the current category until every problem is solved at least once", () => {
    const store = emptyStore();
    // Solve 2 of 4 basic-select problems. Expect the 3rd.
    markSolved(store, "bs-1");
    markSolved(store, "bs-2");
    const pick = pickNextProblem(store, CATALOG, CLOCK);
    expect(pick.problem?.slug).toBe("bs-3");
    expect(pick.problem?.category).toBe("basic-select");
    // Kind is "new-step" because the category has non-zero progress.
    expect(pick.kind).toBe("new-step");
  });

  it("advances to the next category only after every problem in the current one is solved", () => {
    const store = emptyStore();
    for (const slug of ["bs-1", "bs-2", "bs-3", "bs-4"]) markSolved(store, slug);
    const pick = pickNextProblem(store, CATALOG, CLOCK);
    // basic-select is done (even though score is only 0.4, every problem has solvedAt set).
    // Next lowest-tier unlocked category is joins.
    expect(pick.problem?.category).toBe("joins");
    expect(pick.problem?.slug).toBe("j-1");
  });

  it("follows skill-tree declared order within a category (easy→medium→hard by default)", () => {
    const store = emptyStore();
    // Solve the easy and medium basic-select problems, leave bs-4 (hard).
    markSolved(store, "bs-1");
    markSolved(store, "bs-2");
    markSolved(store, "bs-3");
    const pick = pickNextProblem(store, CATALOG, CLOCK);
    expect(pick.problem?.slug).toBe("bs-4");
  });

  it("does NOT auto-serve review-due problems (reviews are explicit now)", () => {
    const store = emptyStore();
    // Clear basic-select completely and make one review-due.
    for (const slug of ["bs-1", "bs-2", "bs-3", "bs-4"]) markSolved(store, slug);
    store.problems["bs-3"].nextReviewAt = "2026-04-09"; // overdue

    const pick = pickNextProblem(store, CATALOG, CLOCK);
    // Forward progress wins; we're now in joins.
    expect(pick.problem?.category).toBe("joins");
    expect(pick.kind).not.toBe("review");
    // Review count is still surfaced for the Review pill.
    expect(pick.reviewDueCount).toBe(1);
  });

  it("does NOT apply a recent-attempt penalty (penalties are gone)", () => {
    const store = emptyStore();
    // Start bs-1 today but don't solve it — it's still the current pick.
    store.problems["bs-1"] = stats({
      attempts: 1,
      lastAttemptAt: "2026-04-13T12:00:00Z",
    });
    const pick = pickNextProblem(store, CATALOG, CLOCK);
    // Finish-what-you-started: bs-1 is the first unsolved problem in
    // basic-select regardless of yesterday's attempt.
    expect(pick.problem?.slug).toBe("bs-1");
  });

  it("returns null problem with a review-mode hint when every unlocked category is fully solved", () => {
    const store = emptyStore();
    const catalog: ProblemSummary[] = [problem("only-one", "basic-select", "easy")];
    markSolved(store, "only-one", "2026-04-12");
    const pick = pickNextProblem(store, catalog, CLOCK);
    expect(pick.problem).toBeNull();
    expect(pick.kind).toBe("none");
    expect(pick.teaser.toLowerCase()).toContain("cleared");
    expect(pick.bullets.length).toBeGreaterThan(0);
  });

  it("puts the current pick on the learning path as 'current'", () => {
    const pick = pickNextProblem(emptyStore(), CATALOG, CLOCK);
    const current = pick.learningPath.find((n) => n.current);
    expect(current?.category).toBe("basic-select");
  });

  it("exposes reviewDueCount matching getReviewQueue", () => {
    const store = emptyStore();
    markSolved(store, "bs-1", "2026-04-01");
    store.problems["bs-1"].nextReviewAt = "2026-04-10"; // overdue
    const pick = pickNextProblem(store, CATALOG, CLOCK);
    expect(pick.reviewDueCount).toBe(1);
  });

  it("builds a candidate pool with the chosen + upcoming same-category problems", () => {
    const pick = pickNextProblem(emptyStore(), CATALOG, CLOCK);
    expect(pick.candidatePool.length).toBeGreaterThan(0);
    const chosen = pick.candidatePool[0];
    expect(chosen.status).toBe("chosen");
    expect(chosen.problem.slug).toBe(pick.problem!.slug);
    // At least one "held" upcoming problem in the same category.
    const held = pick.candidatePool.find(
      (c) => c.status === "held-for-review" && c.problem.category === "basic-select",
    );
    expect(held).toBeDefined();
  });

  it("surfaces a prereq-blocked reject in the candidate pool", () => {
    const pick = pickNextProblem(emptyStore(), CATALOG, CLOCK);
    const prereqReject = pick.candidatePool.find(
      (c) => c.status === "skipped-prereq",
    );
    expect(prereqReject).toBeDefined();
    expect(prereqReject!.reason.toLowerCase()).toContain("prerequisite");
  });

  it("computes overallMasteryPct as the mean of non-empty categories", () => {
    const store = emptyStore();
    for (const slug of ["bs-1", "bs-2", "bs-3", "bs-4"]) markSolved(store, slug);
    const pick = pickNextProblem(store, CATALOG, CLOCK);
    // basic-select 0.4, joins 0, aggregation 0, subqueries 0 → mean 0.1 = 10%
    expect(pick.overallMasteryPct).toBe(10);
  });
});
