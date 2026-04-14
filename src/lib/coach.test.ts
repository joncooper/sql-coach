import { describe, expect, it } from "bun:test";
import type { ProblemSummary, StatsStore, ProblemStats } from "@/types";
import {
  computeCategoryMastery,
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
  difficulty: "easy" | "medium" | "hard" = "easy"
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
// computeCategoryMastery
// --------------------------------------------------------------------

describe("computeCategoryMastery", () => {
  it("returns zero scores for an empty store", () => {
    const mastery = computeCategoryMastery(emptyStore(), CATALOG, CLOCK);
    expect(mastery.length).toBeGreaterThan(0);
    for (const row of mastery) {
      expect(row.score).toBe(0);
      expect(row.solved).toBe(0);
      expect(row.practiced).toBe(0);
      expect(row.mastered).toBe(0);
    }
  });

  it("scores a single solved problem against category total", () => {
    const store = emptyStore();
    store.problems["bs-1"] = stats({
      attempts: 1,
      solvedAt: "2026-04-12T00:00:00Z",
      lastAttemptAt: "2026-04-12T00:00:00Z",
      lastSolvedAt: "2026-04-12T00:00:00Z",
      solveHistory: ["2026-04-12"],
    });

    const mastery = computeCategoryMastery(store, CATALOG, CLOCK);
    const basicSelect = mastery.find((m) => m.category === "basic-select");
    expect(basicSelect).toBeDefined();
    expect(basicSelect!.total).toBe(4);
    expect(basicSelect!.solved).toBe(1);
    // 1 solved (0.4) + 3 unattempted (0) = 0.4 / 4 = 0.1
    expect(basicSelect!.score).toBeCloseTo(0.1);
  });

  it("locks categories whose prerequisites are below threshold", () => {
    const mastery = computeCategoryMastery(emptyStore(), CATALOG, CLOCK);
    const basic = mastery.find((m) => m.category === "basic-select")!;
    const joins = mastery.find((m) => m.category === "joins")!;
    const subqueries = mastery.find((m) => m.category === "subqueries")!;

    expect(basic.unlocked).toBe(true); // no prereqs
    expect(joins.unlocked).toBe(false); // needs basic-select
    expect(subqueries.unlocked).toBe(false); // needs joins + aggregation
  });

  it("unlocks downstream categories once prerequisites cross the threshold", () => {
    const store = emptyStore();
    // Solve all 4 basic-select problems.
    for (const slug of ["bs-1", "bs-2", "bs-3", "bs-4"]) {
      store.problems[slug] = stats({
        attempts: 1,
        solvedAt: "2026-04-12T00:00:00Z",
        lastSolvedAt: "2026-04-12T00:00:00Z",
        lastAttemptAt: "2026-04-12T00:00:00Z",
        solveHistory: ["2026-04-12"],
      });
    }
    const mastery = computeCategoryMastery(store, CATALOG, CLOCK);
    const basic = mastery.find((m) => m.category === "basic-select")!;
    const joins = mastery.find((m) => m.category === "joins")!;
    // basic-select score = 0.4 (all solved once) → meets UNLOCK_THRESHOLD 0.4
    expect(basic.score).toBeCloseTo(0.4);
    expect(joins.unlocked).toBe(true);
  });

  it("sorts mastery rows by tier then skill-tree position", () => {
    const mastery = computeCategoryMastery(emptyStore(), CATALOG, CLOCK);
    // basic-select (tier 0) must come before joins/aggregation (tier 1)
    const basicIdx = mastery.findIndex((m) => m.category === "basic-select");
    const joinsIdx = mastery.findIndex((m) => m.category === "joins");
    const subqIdx = mastery.findIndex((m) => m.category === "subqueries");
    expect(basicIdx).toBeLessThan(joinsIdx);
    expect(joinsIdx).toBeLessThan(subqIdx);
  });

  it("labels unknown categories with title case and flags them unlocked", () => {
    const store = emptyStore();
    const catalog = [...CATALOG, problem("x-1", "secret-sauce", "medium")];
    const mastery = computeCategoryMastery(store, catalog, CLOCK);
    const secret = mastery.find((m) => m.category === "secret-sauce")!;
    expect(secret.label).toBe("Secret Sauce");
    expect(secret.unlocked).toBe(true); // unknown to skill tree = no prereqs
    expect(secret.tier).toBe(99);
  });
});

// --------------------------------------------------------------------
// getReviewQueue
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
      nextReviewAt: "2026-04-10", // 3 days past on 2026-04-13
    });
    store.problems["bs-2"] = stats({
      attempts: 2,
      solvedAt: "2026-04-12T00:00:00Z",
      lastSolvedAt: "2026-04-12T00:00:00Z",
      lastAttemptAt: "2026-04-12T00:00:00Z",
      solveHistory: ["2026-04-12"],
      nextReviewAt: "2026-04-20", // future
    });

    const queue = getReviewQueue(store, CLOCK);
    expect(queue.map((q) => q.slug)).toEqual(["bs-1"]);
    expect(queue[0].daysOverdue).toBe(3);
  });

  it("orders overdue items oldest-first", () => {
    const store = emptyStore();
    store.problems["a"] = stats({
      attempts: 1,
      solvedAt: "2026-04-01T00:00:00Z",
      nextReviewAt: "2026-04-11",
      solveHistory: ["2026-04-01"],
      lastSolvedAt: "2026-04-01T00:00:00Z",
      lastAttemptAt: "2026-04-01T00:00:00Z",
    });
    store.problems["b"] = stats({
      attempts: 1,
      solvedAt: "2026-04-01T00:00:00Z",
      nextReviewAt: "2026-04-08", // more overdue
      solveHistory: ["2026-04-01"],
      lastSolvedAt: "2026-04-01T00:00:00Z",
      lastAttemptAt: "2026-04-01T00:00:00Z",
    });
    const queue = getReviewQueue(store, CLOCK);
    expect(queue.map((q) => q.slug)).toEqual(["b", "a"]);
  });
});

// --------------------------------------------------------------------
// pickNextProblem — the main integration test
// --------------------------------------------------------------------

describe("pickNextProblem", () => {
  it("picks an unlocked starting problem when the store is empty", () => {
    const pick = pickNextProblem(emptyStore(), CATALOG, CLOCK);
    expect(pick.problem).not.toBeNull();
    // Must be in basic-select (the only tier-0 category).
    expect(pick.problem!.category).toBe("basic-select");
    // Must prefer easy difficulty within the winning category.
    expect(pick.problem!.difficulty).toBe("easy");
    // Kind is "new-territory" because no category has score > 0.
    expect(pick.kind).toBe("new-territory");
  });

  it("never picks a problem whose prerequisites are not met", () => {
    const pick = pickNextProblem(emptyStore(), CATALOG, CLOCK);
    expect(pick.problem).not.toBeNull();
    expect(pick.problem!.category).not.toBe("joins");
    expect(pick.problem!.category).not.toBe("subqueries");
  });

  it("prioritizes review-due problems over forward progress", () => {
    const store = emptyStore();
    // Solve a couple of basic-select problems to unlock joins.
    for (const slug of ["bs-1", "bs-2", "bs-3", "bs-4"]) {
      store.problems[slug] = stats({
        attempts: 1,
        solvedAt: "2026-04-05T00:00:00Z",
        lastSolvedAt: "2026-04-05T00:00:00Z",
        lastAttemptAt: "2026-04-05T00:00:00Z",
        solveHistory: ["2026-04-05"],
        nextReviewAt: "2026-04-20", // not due
      });
    }
    // Make bs-3 overdue.
    store.problems["bs-3"].nextReviewAt = "2026-04-09";

    const pick = pickNextProblem(store, CATALOG, CLOCK);
    expect(pick.problem?.slug).toBe("bs-3");
    expect(pick.kind).toBe("review");
    expect(pick.teaser.toLowerCase()).toContain("review");
  });

  it("reinforces the weakest unlocked category after basic-select is done", () => {
    const store = emptyStore();
    // Master basic-select.
    for (const slug of ["bs-1", "bs-2", "bs-3", "bs-4"]) {
      store.problems[slug] = stats({
        attempts: 3,
        solvedAt: "2026-03-01T00:00:00Z",
        lastSolvedAt: "2026-04-10T00:00:00Z",
        lastAttemptAt: "2026-04-10T00:00:00Z",
        solveHistory: ["2026-03-01", "2026-03-15", "2026-04-10"],
        nextReviewAt: "2026-05-01",
      });
    }
    // Solve one aggregation problem (category partially learned).
    store.problems["agg-1"] = stats({
      attempts: 1,
      solvedAt: "2026-04-10T00:00:00Z",
      lastSolvedAt: "2026-04-10T00:00:00Z",
      lastAttemptAt: "2026-04-10T00:00:00Z",
      solveHistory: ["2026-04-10"],
      nextReviewAt: "2026-04-30",
    });

    const pick = pickNextProblem(store, CATALOG, CLOCK);
    // joins is 0.0 (weakest unlocked), aggregation is partially learned,
    // basic-select is strongest. Pick should be in joins.
    expect(pick.problem?.category).toBe("joins");
    expect(pick.kind).toBe("new-territory");
  });

  it("avoids a problem attempted in the last day", () => {
    const store = emptyStore();
    // Two easy problems in basic-select. Attempted one today.
    store.problems["bs-1"] = stats({
      attempts: 1,
      lastAttemptAt: "2026-04-13T12:00:00Z", // today
    });
    const pick = pickNextProblem(store, CATALOG, CLOCK);
    expect(pick.problem?.slug).not.toBe("bs-1");
  });

  it("lists the winning problem as CHOSEN in the candidate pool", () => {
    const pick = pickNextProblem(emptyStore(), CATALOG, CLOCK);
    expect(pick.candidatePool.length).toBeGreaterThan(0);
    expect(pick.candidatePool[0].status).toBe("chosen");
    expect(pick.candidatePool[0].problem.slug).toBe(pick.problem!.slug);
  });

  it("surfaces prereq-blocked problems in the candidate pool explanation", () => {
    const pick = pickNextProblem(emptyStore(), CATALOG, CLOCK);
    const prereqEntry = pick.candidatePool.find(
      (c) => c.status === "skipped-prereq"
    );
    expect(prereqEntry).toBeDefined();
    expect(prereqEntry!.reason.toLowerCase()).toContain("prerequisite");
  });

  it("returns null problem + explanatory bullets when the catalog is exhausted", () => {
    const store = emptyStore();
    const catalog: ProblemSummary[] = [problem("only-one", "basic-select", "easy")];
    // Mastered: 3 solves on 3 different days, recent, no solution viewed.
    store.problems["only-one"] = stats({
      attempts: 3,
      solvedAt: "2026-04-01T00:00:00Z",
      lastSolvedAt: "2026-04-12T00:00:00Z",
      lastAttemptAt: "2026-04-12T00:00:00Z",
      solveHistory: ["2026-04-01", "2026-04-07", "2026-04-12"],
      nextReviewAt: "2026-05-15", // not due
    });
    const pick = pickNextProblem(store, catalog, CLOCK);
    expect(pick.problem).toBeNull();
    expect(pick.bullets.length).toBeGreaterThan(0);
    expect(pick.teaser.toLowerCase()).toContain("mastered");
  });

  it("computes overallMasteryPct as the mean of non-empty categories", () => {
    const store = emptyStore();
    // 4 basic-select problems, all solved once = 0.4 score. joins+aggregation=0.
    for (const slug of ["bs-1", "bs-2", "bs-3", "bs-4"]) {
      store.problems[slug] = stats({
        attempts: 1,
        solvedAt: "2026-04-12T00:00:00Z",
        lastSolvedAt: "2026-04-12T00:00:00Z",
        lastAttemptAt: "2026-04-12T00:00:00Z",
        solveHistory: ["2026-04-12"],
      });
    }
    const pick = pickNextProblem(store, CATALOG, CLOCK);
    // 4 categories with problems: basic-select(0.4), joins(0), aggregation(0), subqueries(0) → mean 0.1 = 10%
    expect(pick.overallMasteryPct).toBe(10);
  });

  it("puts the user's current focus category on the learning path", () => {
    const pick = pickNextProblem(emptyStore(), CATALOG, CLOCK);
    const current = pick.learningPath.find((n) => n.current);
    expect(current).toBeDefined();
    expect(current!.category).toBe("basic-select");
  });

  it("exposes a reviewDueCount that matches getReviewQueue", () => {
    const store = emptyStore();
    store.problems["bs-1"] = stats({
      attempts: 1,
      solvedAt: "2026-04-01T00:00:00Z",
      lastSolvedAt: "2026-04-01T00:00:00Z",
      lastAttemptAt: "2026-04-01T00:00:00Z",
      solveHistory: ["2026-04-01"],
      nextReviewAt: "2026-04-10",
    });
    const pick = pickNextProblem(store, CATALOG, CLOCK);
    expect(pick.reviewDueCount).toBe(1);
  });
});
