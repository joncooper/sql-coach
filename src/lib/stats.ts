import type {
  StatsStore,
  ProblemStats,
  MasteryLevel,
} from "@/types";

const STATS_KEY = "sql-coach:stats";
const LEGACY_KEY = "sql-coach:completed";

interface Clock {
  now?: Date;
  timeZone?: string;
}

function emptyProblemStats(): ProblemStats {
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
  };
}

function emptyStore(): StatsStore {
  return {
    version: 2,
    problems: {},
    global: { activeDays: [], longestStreak: 0 },
  };
}

function formatDateKey(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Could not format date key");
  }

  return `${year}-${month}-${day}`;
}

function dateKeyToUtcDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function utcDateToKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayStr(clock?: Clock): string {
  return formatDateKey(clock?.now ?? new Date(), clock?.timeZone);
}

// --- Migration ---

function migrateFromLegacy(): StatsStore | null {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return null;

  // Don't overwrite if new stats already exist
  if (localStorage.getItem(STATS_KEY)) {
    localStorage.removeItem(LEGACY_KEY);
    return null;
  }

  const legacy = JSON.parse(raw) as Record<
    string,
    { completedAt?: string; attempts?: number }
  >;
  const store = emptyStore();

  for (const [slug, data] of Object.entries(legacy)) {
    const stats = emptyProblemStats();
    if (data.completedAt) {
      stats.solvedAt = data.completedAt;
      stats.lastSolvedAt = data.completedAt;
      stats.solveHistory = [data.completedAt.slice(0, 10)];
    }
    stats.attempts = data.attempts ?? (data.completedAt ? 1 : 0);
    stats.lastAttemptAt = data.completedAt ?? null;
    store.problems[slug] = stats;
  }

  localStorage.setItem(STATS_KEY, JSON.stringify(store));
  localStorage.removeItem(LEGACY_KEY);
  return store;
}

// --- Load / Save ---

export function loadStats(): StatsStore {
  const migrated = migrateFromLegacy();
  if (migrated) return migrated;

  const raw = localStorage.getItem(STATS_KEY);
  if (!raw) return emptyStore();

  return JSON.parse(raw) as StatsStore;
}

export function saveStats(store: StatsStore): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(store));
}

function getOrCreate(store: StatsStore, slug: string): ProblemStats {
  if (!store.problems[slug]) {
    store.problems[slug] = emptyProblemStats();
  }
  return store.problems[slug];
}

// --- Recording ---

export function recordAttempt(
  slug: string,
  passed: boolean,
  timeMs?: number,
  clock?: Clock
): StatsStore {
  const store = loadStats();
  const stats = getOrCreate(store, slug);
  const now = clock?.now ?? new Date();
  const nowIso = now.toISOString();
  const today = todayStr(clock);

  stats.attempts++;
  stats.lastAttemptAt = nowIso;

  if (passed) {
    if (!stats.solvedAt) stats.solvedAt = nowIso;
    stats.lastSolvedAt = nowIso;

    // Append to solve history (cap at 10)
    stats.solveHistory.push(today);
    if (stats.solveHistory.length > 10) {
      stats.solveHistory = stats.solveHistory.slice(-10);
    }

    // Track best time
    if (timeMs != null && (stats.bestTimeMs === null || timeMs < stats.bestTimeMs)) {
      stats.bestTimeMs = timeMs;
    }

    // Schedule next review
    stats.nextReviewAt = computeNextReview(stats.solveHistory, clock);
  } else if (stats.solvedAt && stats.nextReviewAt && stats.nextReviewAt <= today) {
    // Failed a review-due problem — reset to short interval
    stats.nextReviewAt = addDays(today, 3);
  }

  recordActivityInStore(store, clock);
  saveStats(store);
  return store;
}

export function recordHintReveal(slug: string, count: number): StatsStore {
  const store = loadStats();
  const stats = getOrCreate(store, slug);
  if (count > stats.hintsUsed) {
    stats.hintsUsed = count;
  }
  saveStats(store);
  return store;
}

export function recordSolutionViewed(slug: string): StatsStore {
  const store = loadStats();
  const stats = getOrCreate(store, slug);
  stats.solutionViewed = true;
  saveStats(store);
  return store;
}

function recordActivityInStore(store: StatsStore, clock?: Clock): void {
  const today = todayStr(clock);
  const days = store.global.activeDays;

  if (days[days.length - 1] !== today) {
    days.push(today);
    // Cap at 365 days
    if (days.length > 365) {
      store.global.activeDays = days.slice(-365);
    }
  }

  const streak = computeStreak(store.global.activeDays, clock);
  if (streak > store.global.longestStreak) {
    store.global.longestStreak = streak;
  }
}

// --- Streak ---

export function computeStreak(activeDays: string[], clock?: Clock): number {
  if (activeDays.length === 0) return 0;

  const today = todayStr(clock);
  const sorted = [...activeDays].sort();
  const last = sorted[sorted.length - 1];

  // If last activity is not today or yesterday, streak is 0
  const lastDate = dateKeyToUtcDate(last);
  const todayDate = dateKeyToUtcDate(today);
  const diffMs = todayDate.getTime() - lastDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > 1) return 0;

  // Walk backward counting consecutive days
  let streak = 1;
  const daySet = new Set(sorted);

  let cursor = new Date(lastDate);
  while (true) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const key = utcDateToKey(cursor);
    if (daySet.has(key)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// --- Mastery ---

export function computeMasteryLevel(
  stats: ProblemStats | undefined,
  _difficulty: "easy" | "medium" | "hard",
  clock?: Clock
): MasteryLevel {
  if (!stats || stats.attempts === 0) return "unattempted";
  if (!stats.solvedAt) return "attempted";

  // Mastered: solved 3+ times on 3+ different days, no solution viewed, recent
  const uniqueDays = new Set(stats.solveHistory);
  const daysSinceLastSolve = stats.lastSolvedAt
    ? daysBetween(stats.lastSolvedAt.slice(0, 10), todayStr(clock))
    : Infinity;

  if (
    stats.solveHistory.length >= 3 &&
    uniqueDays.size >= 3 &&
    !stats.solutionViewed &&
    daysSinceLastSolve <= 14
  ) {
    return "mastered";
  }

  // Practiced: solved 2+ times, recent
  if (stats.solveHistory.length >= 2 && daysSinceLastSolve <= 30) {
    return "practiced";
  }

  return "solved";
}

function daysBetween(a: string, b: string): number {
  const da = dateKeyToUtcDate(a);
  const db = dateKeyToUtcDate(b);
  return Math.round(Math.abs(db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

// --- Spaced Repetition ---

function addDays(dateStr: string, days: number): string {
  const d = dateKeyToUtcDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return utcDateToKey(d);
}

function computeNextReview(solveHistory: string[], clock?: Clock): string {
  const today = todayStr(clock);
  const BASE_INTERVAL = 5; // days
  const MAX_INTERVAL = 60;

  // Each consecutive solve doubles the interval
  const solveCount = solveHistory.length;
  const interval = Math.min(BASE_INTERVAL * Math.pow(2, solveCount - 1), MAX_INTERVAL);

  return addDays(today, Math.round(interval));
}

export function isReviewDue(stats: ProblemStats, clock?: Clock): boolean {
  if (!stats.solvedAt || !stats.nextReviewAt) return false;
  return stats.nextReviewAt <= todayStr(clock);
}

// --- Query helpers ---

export function getSolvedCount(store: StatsStore): number {
  return Object.values(store.problems).filter((s) => s.solvedAt).length;
}

export interface CategoryProgress {
  category: string;
  total: number;
  solved: number;
  attempted: number;
  practiced: number;
  mastered: number;
}

export function getCategoryProgress(
  store: StatsStore,
  problems: { slug: string; category: string; difficulty: "easy" | "medium" | "hard" }[]
): CategoryProgress[] {
  const map = new Map<string, CategoryProgress>();

  for (const p of problems) {
    if (!map.has(p.category)) {
      map.set(p.category, {
        category: p.category,
        total: 0,
        solved: 0,
        attempted: 0,
        practiced: 0,
        mastered: 0,
      });
    }
    const cat = map.get(p.category)!;
    cat.total++;
    const level = computeMasteryLevel(store.problems[p.slug], p.difficulty);
    if (level === "mastered") cat.mastered++;
    else if (level === "practiced") cat.practiced++;
    else if (level === "solved") cat.solved++;
    else if (level === "attempted") cat.attempted++;
  }

  return Array.from(map.values()).sort(
    (a, b) => (b.solved + b.practiced + b.mastered) / b.total - (a.solved + a.practiced + a.mastered) / a.total
  );
}

export function toggleStar(slug: string): StatsStore {
  const store = loadStats();
  const stats = getOrCreate(store, slug);
  stats.starred = !stats.starred;
  saveStats(store);
  return store;
}

export function getStarredProblems(store: StatsStore): string[] {
  return Object.entries(store.problems)
    .filter(([, s]) => s.starred)
    .map(([slug]) => slug);
}

export function getReviewDueProblems(store: StatsStore): string[] {
  const today = todayStr();
  return Object.entries(store.problems)
    .filter(
      ([, s]) => s.solvedAt && s.nextReviewAt && s.nextReviewAt <= today
    )
    .map(([slug]) => slug);
}
