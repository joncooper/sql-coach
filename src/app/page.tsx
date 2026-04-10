"use client";

import { useEffect, useState } from "react";
import DifficultyBadge from "@/components/DifficultyBadge";
import MasteryIndicator from "@/components/MasteryIndicator";
import {
  loadStats,
  computeMasteryLevel,
  getSolvedCount,
  getReviewDueProblems,
  getCategoryProgress,
  computeStreak,
} from "@/lib/stats";
import type { StatsStore, MasteryLevel } from "@/types";

function formatCategory(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ProblemSummary {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  tags: string[];
}

type Difficulty = "all" | "easy" | "medium" | "hard";

const difficultyPills: { value: Difficulty; label: string }[] = [
  { value: "all", label: "All" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export default function Home() {
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<StatsStore | null>(null);

  useEffect(() => {
    fetch("/api/problems")
      .then((r) => r.json())
      .then(setProblems);

    setStats(loadStats());
  }, []);

  const categories = Array.from(new Set(problems.map((p) => p.category))).sort();

  const filtered = problems.filter((p) => {
    if (difficultyFilter !== "all" && p.difficulty !== difficultyFilter)
      return false;
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
    if (
      search &&
      !p.title.toLowerCase().includes(search.toLowerCase()) &&
      !p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    )
      return false;
    return true;
  });

  const solvedCount = stats ? getSolvedCount(stats) : 0;
  const streak = stats ? computeStreak(stats.global.activeDays) : 0;
  const categoryProgress = stats && problems.length > 0
    ? getCategoryProgress(stats, problems)
    : [];
  const reviewSlugs = stats ? getReviewDueProblems(stats) : [];
  const reviewProblems = problems.filter((p) => reviewSlugs.includes(p.slug));

  function getMastery(slug: string): MasteryLevel {
    if (!stats) return "unattempted";
    const p = problems.find((pr) => pr.slug === slug);
    return computeMasteryLevel(stats.problems[slug], p?.difficulty ?? "easy");
  }

  const hasAnyActivity = stats
    ? Object.keys(stats.problems).length > 0
    : false;

  // Difficulty counts
  const easySolved = problems.filter(
    (p) => p.difficulty === "easy" && stats?.problems[p.slug]?.solvedAt
  ).length;
  const easyTotal = problems.filter((p) => p.difficulty === "easy").length;
  const medSolved = problems.filter(
    (p) => p.difficulty === "medium" && stats?.problems[p.slug]?.solvedAt
  ).length;
  const medTotal = problems.filter((p) => p.difficulty === "medium").length;
  const hardSolved = problems.filter(
    (p) => p.difficulty === "hard" && stats?.problems[p.slug]?.solvedAt
  ).length;
  const hardTotal = problems.filter((p) => p.difficulty === "hard").length;

  return (
    <div className="flex h-full">
      {/* LEFT SIDEBAR — Categories */}
      <div className="w-52 shrink-0 overflow-y-auto border-r border-zinc-800 px-3 py-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Categories
        </h2>
        <div className="space-y-0.5">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              categoryFilter === "all"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            }`}
          >
            <span>All Problems</span>
            <span className="text-xs text-zinc-600">{problems.length}</span>
          </button>
          {categories.map((cat) => {
            const cp = categoryProgress.find((c) => c.category === cat);
            const done = cp ? cp.solved + cp.practiced + cp.mastered : 0;
            const total = cp?.total ?? 0;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat === categoryFilter ? "all" : cat)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  categoryFilter === cat
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                <span className="truncate">{formatCategory(cat)}</span>
                <span className="ml-1 shrink-0 text-xs text-zinc-600">
                  {done > 0 ? (
                    <span>
                      <span className="text-emerald-500">{done}</span>/{total}
                    </span>
                  ) : (
                    total
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* CENTER — Problem list */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Filters bar */}
        <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
              {difficultyPills.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDifficultyFilter(value)}
                  className={`rounded-md px-3 py-1 text-sm transition-colors ${
                    difficultyFilter === value
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search problems..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 pr-7 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-700"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300"
                  aria-label="Clear search"
                >
                  &times;
                </button>
              )}
            </div>
            <span className="text-xs text-zinc-600">
              {filtered.length !== problems.length
                ? `${filtered.length} of ${problems.length}`
                : problems.length}
            </span>
          </div>
        </div>

        {/* Scrollable table */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-zinc-800 bg-zinc-950">
                <th className="w-10 px-3 py-2 text-center text-xs font-medium text-zinc-500">
                  #
                </th>
                {hasAnyActivity && (
                  <th className="w-8 px-2 py-2 text-center text-zinc-500"></th>
                )}
                <th className="px-3 py-2 text-left font-medium text-zinc-400">
                  Title
                </th>
                <th className="w-20 px-3 py-2 text-left font-medium text-zinc-400">
                  Difficulty
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((problem, i) => (
                <tr
                  key={problem.slug}
                  className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-900/50"
                >
                  <td className="px-3 py-2 text-center text-xs text-zinc-600">
                    {i + 1}
                  </td>
                  {hasAnyActivity && (
                    <td className="px-2 py-2 text-center">
                      <MasteryIndicator level={getMastery(problem.slug)} />
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <a
                      href={`/problems/${problem.slug}`}
                      className="font-medium text-zinc-200 hover:text-blue-400"
                    >
                      {problem.title}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <DifficultyBadge difficulty={problem.difficulty} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT SIDEBAR — Progress & Stats */}
      <div className="w-56 shrink-0 overflow-y-auto border-l border-zinc-800 px-4 py-4">
        {/* Progress */}
        <div className="mb-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Progress
          </h2>
          <div className="space-y-2">
            <ProgressRing
              label="Easy"
              solved={easySolved}
              total={easyTotal}
              color="text-emerald-500"
              bg="bg-emerald-500"
            />
            <ProgressRing
              label="Medium"
              solved={medSolved}
              total={medTotal}
              color="text-amber-400"
              bg="bg-amber-400"
            />
            <ProgressRing
              label="Hard"
              solved={hardSolved}
              total={hardTotal}
              color="text-red-400"
              bg="bg-red-400"
            />
          </div>
        </div>

        {/* Streak */}
        {streak > 0 && (
          <div className="mb-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Streak
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-2xl">&#128293;</span>
              <div>
                <div className="text-lg font-bold text-amber-400">
                  {streak} day{streak !== 1 ? "s" : ""}
                </div>
                {stats && stats.global.longestStreak > streak && (
                  <div className="text-xs text-zinc-600">
                    Best: {stats.global.longestStreak}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Due for Review */}
        {reviewProblems.length > 0 && (
          <div className="mb-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Due for Review
            </h2>
            <div className="space-y-1">
              {reviewProblems.slice(0, 5).map((p) => (
                <a
                  key={p.slug}
                  href={`/problems/${p.slug}`}
                  className="block truncate text-sm text-zinc-400 hover:text-blue-400"
                >
                  {p.title}
                </a>
              ))}
              {reviewProblems.length > 5 && (
                <span className="text-xs text-zinc-600">
                  +{reviewProblems.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Weak Areas */}
        {categoryProgress.length > 0 && (() => {
          const attempted = categoryProgress.filter(
            (c) => c.attempted > 0 || c.solved > 0
          );
          const weak = attempted
            .map((c) => ({
              ...c,
              pct: (c.solved + c.practiced + c.mastered) / c.total,
            }))
            .filter((c) => c.pct < 0.5 && c.pct > 0)
            .sort((a, b) => a.pct - b.pct)
            .slice(0, 3);
          if (weak.length === 0) return null;
          return (
            <div className="mb-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Needs Work
              </h2>
              <div className="space-y-1.5">
                {weak.map((c) => (
                  <button
                    key={c.category}
                    onClick={() => setCategoryFilter(c.category)}
                    className="block w-full text-left"
                  >
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="truncate text-zinc-400 hover:text-blue-400">
                        {formatCategory(c.category)}
                      </span>
                      <span className="ml-1 shrink-0 text-xs text-zinc-600">
                        {Math.round(c.pct * 100)}%
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function ProgressRing({
  label,
  solved,
  total,
  color,
  bg,
}: {
  label: string;
  solved: number;
  total: number;
  color: string;
  bg: string;
}) {
  const pct = total > 0 ? (solved / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-16 rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${bg} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-medium ${color}`}>{label}</span>
      <span className="ml-auto text-xs text-zinc-600">
        {solved}/{total}
      </span>
    </div>
  );
}
