/**
 * Coach engine — mastery model + next-problem selection.
 *
 * All functions are pure: they take the user's stats (a StatsStore) and the
 * problem catalog, and return recommendations and reasoning. No I/O, no
 * clock reads (a Clock is injected), no side effects — which makes
 * everything trivially testable.
 *
 * Current design (2026-04-16): finish-what-you-started momentum.
 *
 *   1. Compute mastery per skill-tree category (score, unlocked, inProgress).
 *   2. Pick the lowest-tier unlocked category that still has any unsolved
 *      problems. Stay there until every problem has `solvedAt != null`.
 *   3. Within a category, walk problems in skill-tree declared order.
 *   4. Never auto-serve spaced-repetition reviews or reinforcement. The UI
 *      surfaces those via explicit pills — {@link getReviewQueue} and
 *      {@link getReinforcementQueue} remain for that use.
 *
 *   Rationale: the previous design mixed weakest-category reinforcement,
 *   an easy-difficulty bonus, and review-due picks from the start, which
 *   produced an "elementary easy problem carousel" across Tier-1
 *   categories before the user had worked through the skill tree.
 */

import type {
  ProblemSummary,
  StatsStore,
  MasteryLevel,
} from "@/types";
import { computeMasteryLevel } from "@/lib/stats";
import { SKILL_TREE, getSkillNode, sortBySkillTree } from "@/lib/skill-tree";

// --------------------------------------------------------------------
// Public types
// --------------------------------------------------------------------

export interface Clock {
  now?: Date;
  timeZone?: string;
}

/** Per-category mastery — the coach's view of how well the user knows a topic. */
export interface CategoryMastery {
  category: string;
  label: string;
  tier: number;
  total: number;
  solved: number;
  practiced: number;
  mastered: number;
  /** 0.0 (untouched) → 1.0 (fully mastered). Weighted: attempted=0.1, solved=0.4, practiced=0.7, mastered=1.0. */
  score: number;
  /** True if the user has met every prerequisite category with score >= UNLOCK_THRESHOLD. */
  unlocked: boolean;
  /** True if the user has started but not finished this category. */
  inProgress: boolean;
}

export type CandidateStatus =
  | "chosen"
  | "held-for-review"
  | "skipped-recent"
  | "skipped-prereq"
  | "skipped-mastered"
  | "skipped-too-hard"
  | "skipped-solution-viewed";

export interface Candidate {
  problem: ProblemSummary;
  status: CandidateStatus;
  reason: string;
  /** Higher score = more likely to be picked. Only the winner has the highest. */
  score: number;
  /** For display: was this a review item, a reinforcement, or a new step? */
  kind: "review" | "reinforcement" | "new-step" | "new-territory";
}

export interface LearningPathNode {
  category: string;
  label: string;
  tier: number;
  score: number;
  unlocked: boolean;
  /** True if this is where the user is currently focused. */
  current: boolean;
  /** True if this is where the user is headed next. */
  next: boolean;
}

export interface CoachPick {
  /** The winning problem, or null if the user has literally solved everything. */
  problem: ProblemSummary | null;
  /** Which bucket produced the pick — shapes the coach's tone in the why string. */
  kind: Candidate["kind"] | "none";
  /** Top-line one-liner the UI shows in the collapsed Why-I-picked-this teaser. */
  teaser: string;
  /** Multi-bullet reasoning shown in the expanded panel. */
  bullets: string[];
  /** Per-category mastery — drives the mastery bars + heat display. */
  mastery: CategoryMastery[];
  /** The 5-row "candidate pool" the UI renders. Includes chosen + a few rejected. */
  candidatePool: Candidate[];
  /** Condensed skill-tree view: where you are, where you're going. */
  learningPath: LearningPathNode[];
  /** Counts for the right-rail stats pills. */
  reviewDueCount: number;
  overallMasteryPct: number; // 0–100
}

// --------------------------------------------------------------------
// Tunables
// --------------------------------------------------------------------

const MASTERY_WEIGHTS: Record<MasteryLevel, number> = {
  unattempted: 0,
  attempted: 0.1,
  solved: 0.4,
  practiced: 0.7,
  mastered: 1.0,
};

const UNLOCK_THRESHOLD = 0.4; // prerequisites must be at least "solved" on average

// Upper bound on the reinforcement queue. Problems in "solved" level (solved
// once but not yet practiced) beyond this cap are still tracked, just not
// surfaced in the default Reinforce picker list.
const REINFORCEMENT_QUEUE_CAP = 20;

// --------------------------------------------------------------------
// Mastery scoring
// --------------------------------------------------------------------

function todayStr(clock?: Clock): string {
  const d = clock?.now ?? new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: clock?.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${y}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.slice(0, 10).split("-").map(Number);
  const [by, bm, bd] = b.slice(0, 10).split("-").map(Number);
  const da = Date.UTC(ay, am - 1, ad);
  const db = Date.UTC(by, bm - 1, bd);
  return Math.round(Math.abs(db - da) / (1000 * 60 * 60 * 24));
}

export function computeCategoryMastery(
  store: StatsStore,
  problems: ProblemSummary[],
  clock?: Clock
): CategoryMastery[] {
  // Group problems by category so we can score each.
  const byCategory = new Map<string, ProblemSummary[]>();
  for (const p of problems) {
    const bucket = byCategory.get(p.category) ?? [];
    bucket.push(p);
    byCategory.set(p.category, bucket);
  }

  // Build one row per known skill-tree category (plus any unknown
  // categories that show up in generated problems).
  const categories = new Set<string>(byCategory.keys());
  for (const node of SKILL_TREE) categories.add(node.category);

  const rows: CategoryMastery[] = [];
  for (const category of categories) {
    const node = getSkillNode(category);
    const label =
      node?.label ??
      category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const tier = node?.tier ?? 99;
    const catProblems = byCategory.get(category) ?? [];

    let total = 0;
    let solved = 0;
    let practiced = 0;
    let mastered = 0;
    let weightSum = 0;

    for (const p of catProblems) {
      total++;
      const level = computeMasteryLevel(
        store.problems[p.slug],
        p.difficulty,
        clock
      );
      weightSum += MASTERY_WEIGHTS[level];
      if (level === "mastered") mastered++;
      else if (level === "practiced") practiced++;
      else if (level === "solved") solved++;
    }

    const score = total === 0 ? 0 : weightSum / total;
    const inProgress = score > 0 && score < 1;

    rows.push({
      category,
      label,
      tier,
      total,
      solved,
      practiced,
      mastered,
      score,
      unlocked: false, // computed in a second pass below
      inProgress,
    });
  }

  // Second pass: compute prerequisite unlocks.
  const byCat = new Map(rows.map((r) => [r.category, r]));
  for (const row of rows) {
    const node = getSkillNode(row.category);
    if (!node) {
      row.unlocked = true;
      continue;
    }
    if (node.prerequisites.length === 0) {
      row.unlocked = true;
      continue;
    }
    const prereqScores = node.prerequisites.map(
      (c) => byCat.get(c)?.score ?? 0
    );
    const avg =
      prereqScores.reduce((a, b) => a + b, 0) / prereqScores.length;
    row.unlocked = avg >= UNLOCK_THRESHOLD;
  }

  // Sort: tier first, then by position in SKILL_TREE so display order
  // matches the learning path.
  const tierIndex = new Map(
    SKILL_TREE.map((n, i) => [n.category, i] as const)
  );
  rows.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return (tierIndex.get(a.category) ?? 999) - (tierIndex.get(b.category) ?? 999);
  });

  return rows;
}

// --------------------------------------------------------------------
// Review queue
// --------------------------------------------------------------------

export interface ReviewItem {
  slug: string;
  nextReviewAt: string;
  daysOverdue: number;
}

export function getReviewQueue(
  store: StatsStore,
  clock?: Clock
): ReviewItem[] {
  const today = todayStr(clock);
  const items: ReviewItem[] = [];
  for (const [slug, stats] of Object.entries(store.problems)) {
    if (!stats.solvedAt || !stats.nextReviewAt) continue;
    if (stats.nextReviewAt > today) continue;
    items.push({
      slug,
      nextReviewAt: stats.nextReviewAt,
      daysOverdue: daysBetween(stats.nextReviewAt, today),
    });
  }
  // Oldest-overdue first.
  items.sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt));
  return items;
}

// --------------------------------------------------------------------
// Reinforcement queue
// --------------------------------------------------------------------

/**
 * Problems the user has solved once but hasn't practiced to repeat-and-stick
 * level yet. Surfaces explicitly via the "Reinforce" pill on the coach card —
 * never auto-picked.
 *
 * Ordered by longest-since-last-solve first (oldest-first) so the user sees
 * the most at-risk items at the top of the list.
 */
export function getReinforcementQueue(
  store: StatsStore,
  problems: ProblemSummary[],
  clock?: Clock,
): ProblemSummary[] {
  const bySlug = new Map(problems.map((p) => [p.slug, p]));
  const items: { problem: ProblemSummary; lastSolvedAt: string }[] = [];
  for (const [slug, stats] of Object.entries(store.problems)) {
    const problem = bySlug.get(slug);
    if (!problem) continue;
    if (!stats.solvedAt) continue;
    const level = computeMasteryLevel(stats, problem.difficulty, clock);
    if (level !== "solved") continue; // practiced/mastered don't need reinforcement
    items.push({
      problem,
      lastSolvedAt: stats.lastSolvedAt ?? stats.solvedAt,
    });
  }
  items.sort((a, b) => a.lastSolvedAt.localeCompare(b.lastSolvedAt));
  return items.slice(0, REINFORCEMENT_QUEUE_CAP).map((i) => i.problem);
}

// --------------------------------------------------------------------
// Next-problem selection
// --------------------------------------------------------------------

function findCurrentCategory(
  mastery: CategoryMastery[],
  sortedByCategory: Map<string, ProblemSummary[]>,
  store: StatsStore,
): { category: CategoryMastery; winner: ProblemSummary } | null {
  // mastery is already ordered by tier then SKILL_TREE position, so the
  // first unlocked category with any unsolved problem wins.
  for (const m of mastery) {
    if (!m.unlocked || m.total === 0) continue;
    const catProblems = sortedByCategory.get(m.category) ?? [];
    const winner = catProblems.find(
      (p) => !store.problems[p.slug]?.solvedAt,
    );
    if (winner) return { category: m, winner };
  }
  return null;
}

function buildCandidatePool(
  winner: ProblemSummary | null,
  winnerKind: Candidate["kind"],
  currentCategory: CategoryMastery | null,
  sortedByCategory: Map<string, ProblemSummary[]>,
  mastery: CategoryMastery[],
  store: StatsStore,
): Candidate[] {
  const pool: Candidate[] = [];
  if (!winner || !currentCategory) return pool;

  pool.push({
    problem: winner,
    status: "chosen",
    reason:
      currentCategory.score === 0
        ? `Starts ${currentCategory.label}, new ground in your skill tree`
        : `Continues ${currentCategory.label} — ${currentCategory.solved}/${currentCategory.total} solved so far`,
    score: 0,
    kind: winnerKind,
  });

  // Next few unsolved problems in the same category — "you'll get to these next".
  const catProblems = sortedByCategory.get(currentCategory.category) ?? [];
  const upcoming = catProblems.filter(
    (p) => p.slug !== winner.slug && !store.problems[p.slug]?.solvedAt,
  );
  for (const p of upcoming.slice(0, 2)) {
    pool.push({
      problem: p,
      status: "held-for-review",
      reason: `Up next in ${currentCategory.label}`,
      score: 0,
      kind: winnerKind,
    });
  }

  // One prereq-blocked reject to make the skill tree visible.
  for (const m of mastery) {
    if (m.unlocked || m.total === 0) continue;
    const firstLocked = (sortedByCategory.get(m.category) ?? [])[0];
    if (!firstLocked) continue;
    pool.push({
      problem: firstLocked,
      status: "skipped-prereq",
      reason: `Prerequisite for ${m.label} not yet unlocked`,
      score: -1,
      kind: "new-step",
    });
    break;
  }

  return pool.slice(0, 5);
}

export function pickNextProblem(
  store: StatsStore,
  problems: ProblemSummary[],
  clock?: Clock,
): CoachPick {
  const mastery = computeCategoryMastery(store, problems, clock);
  const reviewQueue = getReviewQueue(store, clock);

  // Canonical problem order within each category: skill-tree declared order.
  const sortedByCategory = new Map<string, ProblemSummary[]>();
  for (const p of sortBySkillTree(problems)) {
    const bucket = sortedByCategory.get(p.category) ?? [];
    bucket.push(p);
    sortedByCategory.set(p.category, bucket);
  }

  const choice = findCurrentCategory(mastery, sortedByCategory, store);
  const currentCategory = choice?.category ?? null;
  const winner = choice?.winner ?? null;

  const winnerKind: Candidate["kind"] =
    currentCategory && currentCategory.score === 0 ? "new-territory" : "new-step";

  const candidatePool = buildCandidatePool(
    winner,
    winnerKind,
    currentCategory,
    sortedByCategory,
    mastery,
    store,
  );

  const { teaser, bullets } = buildReasoning(
    winner,
    winnerKind,
    currentCategory,
    reviewQueue.length,
  );

  const learningPath = buildLearningPath(
    mastery,
    winner?.category ?? currentCategory?.category ?? null,
  );

  // Overall mastery = mean of non-empty category scores.
  const nonEmpty = mastery.filter((m) => m.total > 0);
  const overall =
    nonEmpty.length === 0
      ? 0
      : nonEmpty.reduce((a, m) => a + m.score, 0) / nonEmpty.length;

  return {
    problem: winner,
    kind: winner ? winnerKind : "none",
    teaser,
    bullets,
    mastery,
    candidatePool,
    learningPath,
    reviewDueCount: reviewQueue.length,
    overallMasteryPct: Math.round(overall * 100),
  };
}

// --------------------------------------------------------------------
// Reasoning strings
// --------------------------------------------------------------------

function buildReasoning(
  winner: ProblemSummary | null,
  winnerKind: Candidate["kind"],
  currentCategory: CategoryMastery | null,
  reviewDueCount: number,
): { teaser: string; bullets: string[] } {
  if (!winner || !currentCategory) {
    const hint =
      reviewDueCount > 0
        ? `${reviewDueCount} problem${reviewDueCount === 1 ? "" : "s"} are due for review — use the Review pill to work through them.`
        : "Use the Reinforce pill to deepen problems you've only solved once, or generate new problems.";
    return {
      teaser:
        "You've cleared every unlocked category at least once — nice work.",
      bullets: [
        "Every problem in every unlocked category has been solved.",
        hint,
      ],
    };
  }

  const bullets: string[] = [];
  const remaining = currentCategory.total - currentCategory.solved;

  if (winnerKind === "new-territory") {
    bullets.push(
      `Starting ${currentCategory.label} — your next skill tree category.`,
    );
    bullets.push(
      `Working through problems in ${currentCategory.label} in order; ${currentCategory.total} problem${currentCategory.total === 1 ? "" : "s"} in this section.`,
    );
  } else {
    bullets.push(
      `Continues ${currentCategory.label} — ${currentCategory.solved} solved, ${remaining} to go.`,
    );
    bullets.push(
      "Finishing every problem in this category before moving on — no intermittent reinforcement from elsewhere.",
    );
  }

  if (reviewDueCount > 0) {
    bullets.push(
      `Aside: ${reviewDueCount} review${reviewDueCount === 1 ? "" : "s"} due — surface them with the Review pill when you want.`,
    );
  }

  const teaser =
    winnerKind === "new-territory"
      ? `Starts ${currentCategory.label}`
      : `Continues ${currentCategory.label} (${currentCategory.solved}/${currentCategory.total} done)`;

  return { teaser, bullets };
}

// --------------------------------------------------------------------
// Learning path
// --------------------------------------------------------------------

function buildLearningPath(
  mastery: CategoryMastery[],
  focusCategory: string | null
): LearningPathNode[] {
  // Show the top 6 categories in tier+order, marking current + next.
  const rows = mastery
    .filter((m) => m.total > 0 || getSkillNode(m.category))
    .slice(0, 6);

  const focusIdx = focusCategory
    ? rows.findIndex((r) => r.category === focusCategory)
    : -1;

  return rows.map((r, i) => ({
    category: r.category,
    label: r.label,
    tier: r.tier,
    score: r.score,
    unlocked: r.unlocked,
    current: i === focusIdx,
    next: i === focusIdx + 1,
  }));
}
