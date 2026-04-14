/**
 * Coach engine — mastery model + spaced repetition + next-problem selection.
 *
 * This is the server-side of Coach mode. All functions are pure: they take
 * the user's stats (a StatsStore) and the problem catalog, and return
 * recommendations and reasoning. No I/O, no clock reads (a Clock is
 * injected), no side effects — which makes everything trivially testable.
 *
 * The coach's job:
 *   1. Score the user's mastery per skill tree category.
 *   2. Maintain a spaced-repetition queue of previously-solved problems.
 *   3. Pick the next problem by balancing: review-due items,
 *      weakest-category reinforcement, and forward progress through
 *      the learning path (respecting prerequisites).
 *   4. Explain the pick — which candidates were considered, why this
 *      one won, which were held or skipped.
 */

import type {
  ProblemStats,
  ProblemSummary,
  StatsStore,
  MasteryLevel,
} from "@/types";
import { computeMasteryLevel, isReviewDue } from "@/lib/stats";
import { SKILL_TREE, getSkillNode } from "@/lib/skill-tree";

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

// Scoring weights — every candidate problem accumulates a score.
// Higher score = more likely to be picked.
const SCORE = {
  reviewDue: 100, // review-overdue problems always win
  reviewDueAge: 4, // bonus per day past review date
  weakCategory: 40, // reinforcing the weakest unlocked category
  currentCategory: 15, // continuing the in-progress category
  unlockedCategory: 8, // any unlocked category still has headroom
  difficultyEasyBias: 6, // prefer easier problems within the winning category
  difficultyMediumBias: 3,
  difficultyHardBias: 0,
  recentAttemptPenalty: -25, // don't repeat a problem the user just tried
  solutionViewedPenalty: -15, // if they've peeked, don't re-serve until a break
  masteredPenalty: -50, // already mastered → skip unless review-due
};

const RECENT_ATTEMPT_DAYS = 1;

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
// Next-problem selection
// --------------------------------------------------------------------

interface ScoredCandidate extends Candidate {
  /** Internal: the raw priority before the winner is chosen. */
  rawScore: number;
}

function scoreCandidate(
  p: ProblemSummary,
  stats: ProblemStats | undefined,
  mastery: CategoryMastery[],
  reviewQueue: ReviewItem[],
  weakestUnlocked: CategoryMastery | null,
  currentInProgress: CategoryMastery | null,
  clock?: Clock
): ScoredCandidate {
  const today = todayStr(clock);
  const catRow = mastery.find((m) => m.category === p.category);
  const reviewItem = reviewQueue.find((r) => r.slug === p.slug);

  let score = 0;
  let kind: Candidate["kind"] = "new-territory";
  let status: CandidateStatus = "chosen"; // placeholder; re-assigned below
  let reason = "";

  // 1. Review-due takes absolute priority.
  if (reviewItem) {
    score += SCORE.reviewDue + reviewItem.daysOverdue * SCORE.reviewDueAge;
    kind = "review";
    reason = reviewItem.daysOverdue > 0
      ? `Review overdue by ${reviewItem.daysOverdue} day${reviewItem.daysOverdue === 1 ? "" : "s"}`
      : "Review due today";
  } else if (!catRow?.unlocked) {
    // Prerequisites not met — skip entirely.
    return {
      problem: p,
      status: "skipped-prereq",
      reason: "Prerequisite category not yet unlocked",
      score: -Infinity,
      rawScore: -Infinity,
      kind: "new-step",
    };
  } else {
    // 2. Weakest unlocked category bias.
    if (weakestUnlocked && p.category === weakestUnlocked.category) {
      score += SCORE.weakCategory;
      kind = weakestUnlocked.score > 0 ? "reinforcement" : "new-territory";
      reason =
        weakestUnlocked.score > 0
          ? `Reinforces ${weakestUnlocked.label}, your weakest category`
          : `Starts ${weakestUnlocked.label}, a category you haven't touched yet`;
    }

    // 3. Current-in-progress bias (keep momentum).
    if (currentInProgress && p.category === currentInProgress.category) {
      score += SCORE.currentCategory;
      if (!reason) {
        kind = "new-step";
        reason = `Continues ${currentInProgress.label}, your current category`;
      }
    }

    // 4. Otherwise, any unlocked category gets a baseline bias.
    if (score === 0) {
      score += SCORE.unlockedCategory;
      kind = "new-step";
      reason = `Builds forward progress in ${catRow?.label ?? p.category}`;
    }
  }

  // 5. Difficulty bias — prefer easier problems for the winning category.
  if (p.difficulty === "easy") score += SCORE.difficultyEasyBias;
  else if (p.difficulty === "medium") score += SCORE.difficultyMediumBias;
  else score += SCORE.difficultyHardBias;

  // 6. Penalties.
  if (stats?.lastAttemptAt) {
    const attemptDay = stats.lastAttemptAt.slice(0, 10);
    const daysSince = daysBetween(attemptDay, today);
    if (daysSince <= RECENT_ATTEMPT_DAYS && !reviewItem) {
      score += SCORE.recentAttemptPenalty;
      status = "skipped-recent";
      reason = `Attempted in the last ${RECENT_ATTEMPT_DAYS} day${RECENT_ATTEMPT_DAYS === 1 ? "" : "s"}`;
    }
  }
  if (stats?.solutionViewed && !reviewItem) {
    score += SCORE.solutionViewedPenalty;
    if (status === "chosen") {
      status = "skipped-solution-viewed";
      reason = "Solution already revealed";
    }
  }
  const level = computeMasteryLevel(stats, p.difficulty, clock);
  if (level === "mastered" && !reviewItem) {
    score += SCORE.masteredPenalty;
    status = "skipped-mastered";
    reason = "Already mastered";
  }

  return {
    problem: p,
    status,
    reason,
    score,
    rawScore: score,
    kind,
  };
}

export function pickNextProblem(
  store: StatsStore,
  problems: ProblemSummary[],
  clock?: Clock
): CoachPick {
  const mastery = computeCategoryMastery(store, problems, clock);
  const reviewQueue = getReviewQueue(store, clock);

  // Identify the weakest unlocked category (lowest non-complete score).
  const unlockedWithHeadroom = mastery.filter(
    (m) => m.unlocked && m.score < 1 && m.total > 0
  );
  unlockedWithHeadroom.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.tier - b.tier;
  });
  const weakestUnlocked = unlockedWithHeadroom[0] ?? null;

  // In-progress = the user has touched but not finished it.
  const inProgressUnlocked = mastery.filter(
    (m) => m.unlocked && m.inProgress
  );
  inProgressUnlocked.sort((a, b) => a.tier - b.tier);
  const currentInProgress = inProgressUnlocked[0] ?? null;

  // Score every problem.
  const scored: ScoredCandidate[] = problems.map((p) =>
    scoreCandidate(
      p,
      store.problems[p.slug],
      mastery,
      reviewQueue,
      weakestUnlocked,
      currentInProgress,
      clock
    )
  );

  // Winner = highest non-negative score that isn't skipped.
  const eligible = scored.filter(
    (c) => c.status === "chosen" && c.score > -Infinity
  );
  eligible.sort((a, b) => b.score - a.score);
  const winner = eligible[0] ?? null;

  // Candidate pool for display = winner + up to 4 notable rejects.
  const pool: Candidate[] = [];
  if (winner) {
    pool.push({
      problem: winner.problem,
      status: "chosen",
      reason: winner.reason,
      score: winner.score,
      kind: winner.kind,
    });
  }

  // Runners-up: next-highest-scored "chosen" in a different category (for variety).
  const runnersUp = eligible
    .slice(1)
    .filter((c) => winner && c.problem.category !== winner.problem.category)
    .slice(0, 1);
  for (const r of runnersUp) {
    pool.push({
      problem: r.problem,
      status: "held-for-review",
      reason: `Held for a later session: ${r.reason}`,
      score: r.score,
      kind: r.kind,
    });
  }

  // A recently-attempted reject, if we have one.
  const recentReject = scored.find((c) => c.status === "skipped-recent");
  if (recentReject) {
    pool.push({
      problem: recentReject.problem,
      status: "skipped-recent",
      reason: recentReject.reason,
      score: recentReject.score,
      kind: recentReject.kind,
    });
  }

  // A prereq-blocked reject, if we have one.
  const prereqReject = scored.find((c) => c.status === "skipped-prereq");
  if (prereqReject) {
    pool.push({
      problem: prereqReject.problem,
      status: "skipped-prereq",
      reason: prereqReject.reason,
      score: prereqReject.score,
      kind: prereqReject.kind,
    });
  }

  // An already-mastered reject, if we have one.
  const masteredReject = scored.find((c) => c.status === "skipped-mastered");
  if (masteredReject) {
    pool.push({
      problem: masteredReject.problem,
      status: "skipped-mastered",
      reason: masteredReject.reason,
      score: masteredReject.score,
      kind: masteredReject.kind,
    });
  }

  // Teaser + bullets for the UI.
  const { teaser, bullets } = buildReasoning(
    winner,
    reviewQueue,
    weakestUnlocked,
    currentInProgress
  );

  // Learning path view — unlocked rows with the current + next marked.
  const learningPath = buildLearningPath(
    mastery,
    winner?.problem.category ?? currentInProgress?.category ?? null
  );

  // Overall mastery is average score over categories the user has any
  // problems in.
  const nonEmpty = mastery.filter((m) => m.total > 0);
  const overall =
    nonEmpty.length === 0
      ? 0
      : nonEmpty.reduce((a, m) => a + m.score, 0) / nonEmpty.length;

  return {
    problem: winner?.problem ?? null,
    kind: winner?.kind ?? "none",
    teaser,
    bullets,
    mastery,
    candidatePool: pool.slice(0, 5),
    learningPath,
    reviewDueCount: reviewQueue.length,
    overallMasteryPct: Math.round(overall * 100),
  };
}

// --------------------------------------------------------------------
// Reasoning strings
// --------------------------------------------------------------------

function buildReasoning(
  winner: ScoredCandidate | null,
  reviewQueue: ReviewItem[],
  weakestUnlocked: CategoryMastery | null,
  currentInProgress: CategoryMastery | null
): { teaser: string; bullets: string[] } {
  if (!winner) {
    return {
      teaser: "No unblocked problems left — you've mastered the catalog",
      bullets: [
        "Every category you've unlocked is fully mastered.",
        "Generate new problems, or come back when a review is due.",
      ],
    };
  }

  const { problem, kind, reason } = winner;
  const bullets: string[] = [];

  switch (kind) {
    case "review": {
      bullets.push(
        reason + " — spaced repetition is how skills stick after the first solve."
      );
      if (reviewQueue.length > 1) {
        bullets.push(
          `${reviewQueue.length} problems overdue total; oldest is ${reviewQueue[0].daysOverdue} day${reviewQueue[0].daysOverdue === 1 ? "" : "s"} past due.`
        );
      }
      if (weakestUnlocked) {
        bullets.push(
          `After this, I'll pivot toward ${weakestUnlocked.label} — it's your weakest unlocked category.`
        );
      }
      break;
    }
    case "reinforcement": {
      bullets.push(reason + ".");
      if (weakestUnlocked) {
        bullets.push(
          `${weakestUnlocked.label} is at ${Math.round(weakestUnlocked.score * 100)}% mastery — below every other unlocked category.`
        );
      }
      bullets.push(
        `Starting with an ${problem.difficulty} problem in this category to build confidence before pushing harder.`
      );
      break;
    }
    case "new-step": {
      bullets.push(reason + ".");
      if (currentInProgress) {
        bullets.push(
          `You're ${Math.round(currentInProgress.score * 100)}% through ${currentInProgress.label}; staying here keeps momentum.`
        );
      }
      break;
    }
    case "new-territory": {
      bullets.push(reason + ".");
      bullets.push(
        "Prerequisites are met, so this is the next step forward in the skill tree."
      );
      break;
    }
  }

  const teaser =
    kind === "review"
      ? `Review due: ${problem.title}`
      : reason;

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
