"use client";

/**
 * Catalog mode home — variant A from the design shotgun (2026-04-13).
 *
 * Layout:
 *   ┌────────────┬──────────────────────────────┬──────────────┐
 *   │ Skill tree │ Dense sortable problem table │ Today's Focus│
 *   │ (240px)    │ (flex)                       │ (280px)      │
 *   └────────────┴──────────────────────────────┴──────────────┘
 *
 * The skill tree sidebar lists categories grouped by domain (Fundamentals,
 * Analytics, Logic & Transformation, Text & Dates, Applied) with per-category
 * progress bars. Clicking a group filters the table.
 *
 * The table is sortable by every column. Rows show #, title, difficulty,
 * category tag, mastery ring, and a star toggle.
 *
 * The right rail shows the same Coach pick as Coach mode would have chosen,
 * plus compact stats (Solved/Attempted/Review counts). A "Switch to Coach"
 * call-to-action lives at the bottom.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MasteryLevel, ProblemSummary, StatsStore } from "@/types";

type Difficulty = ProblemSummary["difficulty"];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
import type { CoachPick, CategoryMastery } from "@/lib/coach";
import { computeMasteryLevel, getSolvedCount } from "@/lib/stats";
import { CategoryTag, DifficultyPill, Eyebrow } from "./parts";

const LEVEL_ORDER: Record<MasteryLevel, number> = {
  unattempted: 0,
  attempted: 1,
  solved: 2,
  practiced: 3,
  mastered: 4,
};

const LEVEL_LABELS: Record<MasteryLevel, string> = {
  unattempted: "—",
  attempted: "Attempted",
  solved: "Solved",
  practiced: "Practiced",
  mastered: "Mastered",
};

interface CatalogModeProps {
  problems: ProblemSummary[];
  store: StatsStore;
  pick: CoachPick;
  mastery: CategoryMastery[];
  onToggleStar: (slug: string) => void;
  starredSet: Set<string>;
}

type SortKey = "num" | "title" | "difficulty" | "category" | "status";
type SortDir = "asc" | "desc";

const DIFF_ORDER = { easy: 0, medium: 1, hard: 2 } as const;

// --------------------------------------------------------------------
// Skill tree grouping (matches the Fundamentals/Analytics/... structure
// but driven by coach mastery rows).
// --------------------------------------------------------------------

const SKILL_GROUPS = [
  {
    name: "Fundamentals",
    categories: ["basic-select", "joins", "subqueries", "ctes"],
  },
  {
    name: "Analytics",
    categories: [
      "aggregation",
      "window-functions",
      "gaps-and-islands",
      "cohort-analysis",
    ],
  },
  {
    name: "Logic & Transformation",
    categories: ["conditional-logic", "null-handling", "pivoting"],
  },
  {
    name: "Text & Dates",
    categories: ["date-functions", "string-functions"],
  },
  {
    name: "Applied",
    categories: [
      "advanced-joins",
      "data-quality",
      "set-operations",
      "business-analysis",
    ],
  },
] as const;

// --------------------------------------------------------------------
// Catalog mode
// --------------------------------------------------------------------

export default function CatalogMode({
  problems,
  store,
  pick,
  mastery,
  onToggleStar,
  starredSet,
}: CatalogModeProps) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<Set<Difficulty>>(
    () => new Set()
  );
  const [sortKey, setSortKey] = useState<SortKey>("num");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleDifficulty = (d: Difficulty) => {
    setDifficultyFilter((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  const masteryByCategory = useMemo(() => {
    const map = new Map<string, CategoryMastery>();
    for (const m of mastery) map.set(m.category, m);
    return map;
  }, [mastery]);

  const levelByProblem = useMemo(() => {
    const map = new Map<string, MasteryLevel>();
    for (const p of problems) {
      map.set(
        p.slug,
        computeMasteryLevel(store.problems[p.slug], p.difficulty)
      );
    }
    return map;
  }, [problems, store]);

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (difficultyFilter.size > 0 && !difficultyFilter.has(p.difficulty))
        return false;
      return true;
    });
  }, [problems, categoryFilter, difficultyFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "num":
          return 0; // numbering matches filtered-array order
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "difficulty":
          return (DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]) * dir;
        case "category":
          return a.category.localeCompare(b.category) * dir;
        case "status": {
          const la = LEVEL_ORDER[levelByProblem.get(a.slug) ?? "unattempted"];
          const lb = LEVEL_ORDER[levelByProblem.get(b.slug) ?? "unattempted"];
          return (la - lb) * dir;
        }
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir, levelByProblem]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const solved = getSolvedCount(store);
  const attempted = Object.values(store.problems).filter(
    (s) => s.attempts > 0
  ).length;

  return (
    <div className="flex min-h-0 flex-1 gap-4 px-4 py-4">
      {/* Skill tree sidebar */}
      <aside className="w-[240px] shrink-0">
        <div className="app-panel p-4">
          <Eyebrow>Skill tree</Eyebrow>
          <div className="mt-3 flex flex-col gap-5">
            <CategoryButton
              active={categoryFilter === null}
              onClick={() => setCategoryFilter(null)}
              label="All problems"
              count={problems.length}
            />
            {SKILL_GROUPS.map((group) => {
              const visibleCats = group.categories.filter(
                (c) => masteryByCategory.get(c)?.total
              );
              if (visibleCats.length === 0) return null;
              return (
                <div key={group.name} className="flex flex-col gap-1.5">
                  <div className="eyebrow text-[10px]">{group.name}</div>
                  {visibleCats.map((c) => {
                    const m = masteryByCategory.get(c)!;
                    return (
                      <CategoryButton
                        key={c}
                        active={categoryFilter === c}
                        onClick={() =>
                          setCategoryFilter(categoryFilter === c ? null : c)
                        }
                        label={m.label}
                        count={m.total}
                        solvedCount={m.solved + m.practiced + m.mastered}
                        unlocked={m.unlocked}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Problems table */}
      <main className="app-panel min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-[color:var(--border)] px-5 py-3">
          <div>
            <div className="text-base font-semibold text-[color:var(--text)]">
              {categoryFilter
                ? masteryByCategory.get(categoryFilter)?.label ?? "Problems"
                : "All problems"}
            </div>
            <div className="text-xs text-[color:var(--text-muted)]">
              {sorted.length} problem{sorted.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {DIFFICULTIES.map((d) => {
              const active = difficultyFilter.has(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDifficulty(d)}
                  aria-pressed={active}
                  className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                    active
                      ? d === "easy"
                        ? "border-[color:var(--positive)] bg-[color:var(--positive-soft)] text-[color:var(--positive)]"
                        : d === "medium"
                          ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                          : "border-[color:var(--review-due)] bg-[color:var(--review-due-soft,var(--panel-muted))] text-[color:var(--review-due)]"
                      : "border-[color:var(--border)] bg-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
                  }`}
                >
                  {d}
                </button>
              );
            })}
            {difficultyFilter.size > 0 && (
              <button
                type="button"
                onClick={() => setDifficultyFilter(new Set())}
                className="ml-1 text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="max-h-[calc(100vh-220px)] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[color:var(--surface)]">
              <tr className="border-b border-[color:var(--border)] text-left">
                <HeaderCell
                  label="#"
                  active={sortKey === "num"}
                  dir={sortDir}
                  onClick={() => toggleSort("num")}
                  className="w-12 text-center"
                />
                <HeaderCell
                  label="Title"
                  active={sortKey === "title"}
                  dir={sortDir}
                  onClick={() => toggleSort("title")}
                />
                <HeaderCell
                  label="Difficulty"
                  active={sortKey === "difficulty"}
                  dir={sortDir}
                  onClick={() => toggleSort("difficulty")}
                  className="w-28"
                />
                <HeaderCell
                  label="Category"
                  active={sortKey === "category"}
                  dir={sortDir}
                  onClick={() => toggleSort("category")}
                  className="w-48"
                />
                <HeaderCell
                  label="Status"
                  active={sortKey === "status"}
                  dir={sortDir}
                  onClick={() => toggleSort("status")}
                  className="w-28 text-center"
                />
                <th className="w-10 px-3 py-2.5" aria-label="Star"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const level = levelByProblem.get(p.slug) ?? "unattempted";
                const isStarred = starredSet.has(p.slug);
                return (
                  <tr
                    key={p.slug}
                    className="border-b border-[color:var(--border-subtle)] transition-colors hover:bg-[color:var(--panel-muted)]"
                  >
                    <td className="num px-3 py-2.5 text-center text-xs text-[color:var(--text-muted)]">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/problems/${p.slug}`}
                        className="font-medium text-[color:var(--text)] hover:text-[color:var(--accent)]"
                      >
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <DifficultyPill difficulty={p.difficulty} />
                    </td>
                    <td className="px-3 py-2.5">
                      <CategoryTag>
                        {labelFor(p.category)}
                      </CategoryTag>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <StatusPill level={level} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => onToggleStar(p.slug)}
                        aria-label={isStarred ? "Unstar" : "Star"}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--panel-muted)]"
                      >
                        {isStarred ? "★" : "☆"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {/* Right rail — Today's Focus */}
      <aside className="w-[280px] shrink-0">
        <div className="app-panel p-5">
          <Eyebrow>Today's focus</Eyebrow>
          {pick.problem ? (
            <>
              <div className="mt-2 text-xs text-[color:var(--text-muted)]">
                Your next problem
              </div>
              <div className="mt-1 text-base font-semibold leading-tight text-[color:var(--text)]">
                {pick.problem.title}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <DifficultyPill difficulty={pick.problem.difficulty} />
                <CategoryTag>{labelFor(pick.problem.category)}</CategoryTag>
              </div>
              <Link
                href={`/problems/${pick.problem.slug}`}
                className="btn-primary mt-4 w-full"
              >
                Open workspace
              </Link>
            </>
          ) : (
            <div className="mt-2 text-sm text-[color:var(--text-muted)]">
              {pick.teaser}
            </div>
          )}
        </div>

        <div className="app-panel mt-3 p-5">
          <Eyebrow>At a glance</Eyebrow>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <StatRow label="Solved" value={`${solved} / ${problems.length}`} />
            <StatRow label="Attempted" value={attempted.toString()} />
            <StatRow
              label="Review due"
              value={pick.reviewDueCount.toString()}
              highlight={pick.reviewDueCount > 0}
            />
            <StatRow
              label="Mastery"
              value={`${pick.overallMasteryPct}%`}
            />
          </dl>
        </div>

        <div className="app-panel mt-3 p-5">
          <Eyebrow>Coach mode</Eyebrow>
          <p className="mt-2 text-xs text-[color:var(--text-muted)]">
            Let the AI pick your next problem and explain why.
          </p>
          <Link
            href="/?mode=coach"
            className="btn-secondary mt-3 w-full"
          >
            Switch to Coach
          </Link>
        </div>
      </aside>
    </div>
  );
}

// --------------------------------------------------------------------
// Small subcomponents
// --------------------------------------------------------------------

function HeaderCell({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`px-3 py-2.5 font-medium ${className ?? ""}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${
          active
            ? "text-[color:var(--text)]"
            : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
        }`}
      >
        {label}
        {active && (
          <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </button>
    </th>
  );
}

function StatusPill({ level }: { level: MasteryLevel }) {
  if (level === "unattempted") {
    return (
      <span className="text-xs text-[color:var(--text-muted)]">—</span>
    );
  }
  const toneClass: Record<Exclude<MasteryLevel, "unattempted">, string> = {
    attempted:
      "border-[color:var(--border)] bg-[color:var(--panel-muted)] text-[color:var(--text-muted)]",
    solved:
      "border-[color:var(--positive-soft)] bg-[color:var(--positive-soft)] text-[color:var(--positive)]",
    practiced:
      "border-[color:var(--positive-soft)] bg-[color:var(--positive-soft)] text-[color:var(--positive)]",
    mastered:
      "border-[color:var(--accent-soft)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]",
  };
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${toneClass[level]}`}
    >
      {LEVEL_LABELS[level]}
      {level === "mastered" ? " ★" : ""}
    </span>
  );
}

function CategoryButton({
  active,
  onClick,
  label,
  count,
  solvedCount,
  unlocked = true,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  solvedCount?: number;
  unlocked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        active
          ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
          : "text-[color:var(--text-soft)] hover:bg-[color:var(--panel-muted)]"
      }`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
        {!unlocked && (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <path
              d="M3 5V3a2 2 0 0 1 4 0v2m-4 0h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        )}
        <span className="truncate">{label}</span>
      </span>
      <span className="num shrink-0 text-xs text-[color:var(--text-muted)]">
        {solvedCount !== undefined
          ? `${solvedCount}/${count}`
          : count}
      </span>
    </button>
  );
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[color:var(--text-muted)]">{label}</dt>
      <dd
        className={`num font-semibold ${
          highlight
            ? "text-[color:var(--review-due)]"
            : "text-[color:var(--text)]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function labelFor(category: string): string {
  return category
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
