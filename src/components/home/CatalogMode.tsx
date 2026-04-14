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
import type { ProblemSummary, StatsStore } from "@/types";
import type { CoachPick, CategoryMastery } from "@/lib/coach";
import { getSolvedCount } from "@/lib/stats";
import { CategoryTag, DifficultyPill, Eyebrow, MasteryRing } from "./parts";

interface CatalogModeProps {
  problems: ProblemSummary[];
  store: StatsStore;
  pick: CoachPick;
  mastery: CategoryMastery[];
  onToggleStar: (slug: string) => void;
  starredSet: Set<string>;
}

type SortKey = "num" | "title" | "difficulty" | "category" | "mastery";
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
  const [sortKey, setSortKey] = useState<SortKey>("num");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const masteryByCategory = useMemo(() => {
    const map = new Map<string, CategoryMastery>();
    for (const m of mastery) map.set(m.category, m);
    return map;
  }, [mastery]);

  const masteryByProblem = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of problems) {
      const stats = store.problems[p.slug];
      let score = 0;
      if (stats?.solvedAt) {
        const uniqueDays = new Set(stats.solveHistory).size;
        score = Math.min(1, uniqueDays / 3);
      } else if (stats?.attempts) {
        score = 0.1;
      }
      map.set(p.slug, score);
    }
    return map;
  }, [problems, store]);

  const filtered = useMemo(() => {
    if (!categoryFilter) return problems;
    return problems.filter((p) => p.category === categoryFilter);
  }, [problems, categoryFilter]);

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
        case "mastery": {
          const ma = masteryByProblem.get(a.slug) ?? 0;
          const mb = masteryByProblem.get(b.slug) ?? 0;
          return (ma - mb) * dir;
        }
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir, masteryByProblem]);

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
                        mastery={m.score}
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
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-3">
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
                  label="Mastery"
                  active={sortKey === "mastery"}
                  dir={sortDir}
                  onClick={() => toggleSort("mastery")}
                  className="w-24 text-center"
                />
                <th className="w-10 px-3 py-2.5" aria-label="Star"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => {
                const score = masteryByProblem.get(p.slug) ?? 0;
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
                      <div className="inline-flex items-center justify-center">
                        <MasteryRing value={score} size={24} stroke={3} />
                      </div>
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

function CategoryButton({
  active,
  onClick,
  label,
  count,
  mastery,
  unlocked = true,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  mastery?: number;
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
        {mastery !== undefined
          ? `${Math.round(mastery * count)}/${count}`
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
