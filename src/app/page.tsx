"use client";

import { useEffect, useState } from "react";
import DifficultyBadge from "@/components/DifficultyBadge";
import MasteryIndicator from "@/components/MasteryIndicator";
import StatsBar from "@/components/StatsBar";
import { loadStats, computeMasteryLevel, getSolvedCount, getReviewDueProblems } from "@/lib/stats";
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

  function getMastery(slug: string): MasteryLevel {
    if (!stats) return "unattempted";
    const p = problems.find((pr) => pr.slug === slug);
    return computeMasteryLevel(stats.problems[slug], p?.difficulty ?? "easy");
  }

  const hasAnyActivity = stats
    ? Object.keys(stats.problems).length > 0
    : false;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Problems</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {filtered.length !== problems.length
            ? `Showing ${filtered.length} of ${problems.length} problems`
            : `${problems.length} problems`}{" "}
          &middot; {solvedCount} solved
        </p>
      </div>

      {stats && problems.length > 0 && (
        <StatsBar problems={problems} stats={stats} />
      )}

      {/* Due for Review */}
      {stats && (() => {
        const reviewSlugs = getReviewDueProblems(stats);
        const reviewProblems = problems.filter((p) => reviewSlugs.includes(p.slug));
        if (reviewProblems.length === 0) return null;
        return (
          <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <h2 className="mb-2 text-sm font-semibold text-amber-400">
              Due for Review ({reviewProblems.length})
            </h2>
            <div className="space-y-1">
              {reviewProblems.map((p) => (
                <div key={p.slug} className="flex items-center gap-3 text-sm">
                  <a
                    href={`/problems/${p.slug}`}
                    className="font-medium text-zinc-300 hover:text-blue-400"
                  >
                    {p.title}
                  </a>
                  <DifficultyBadge difficulty={p.difficulty} />
                  <span className="text-xs text-zinc-600">
                    {formatCategory(p.category)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="mb-4 flex flex-wrap items-center gap-2">
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

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 outline-none"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {formatCategory(c)}
            </option>
          ))}
        </select>

        <div className="relative">
          <input
            type="text"
            placeholder="Search problems..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 pr-7 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-700"
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
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              <th className="w-10 px-3 py-2.5 text-center text-xs font-medium text-zinc-500">
                #
              </th>
              {hasAnyActivity && (
                <th className="w-10 px-3 py-2.5 text-center text-zinc-500"></th>
              )}
              <th className="px-3 py-2.5 text-left font-medium text-zinc-400">
                Title
              </th>
              <th className="px-3 py-2.5 text-left font-medium text-zinc-400">
                Difficulty
              </th>
              <th className="px-3 py-2.5 text-left font-medium text-zinc-400">
                Category
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((problem, i) => (
              <tr
                key={problem.slug}
                className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-900/50"
              >
                <td className="px-3 py-2.5 text-center text-xs text-zinc-600">
                  {i + 1}
                </td>
                {hasAnyActivity && (
                  <td className="px-3 py-2.5 text-center">
                    <MasteryIndicator level={getMastery(problem.slug)} />
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <a
                    href={`/problems/${problem.slug}`}
                    className="font-medium text-zinc-200 hover:text-blue-400"
                  >
                    {problem.title}
                  </a>
                </td>
                <td className="px-3 py-2.5">
                  <DifficultyBadge difficulty={problem.difficulty} />
                </td>
                <td className="px-3 py-2.5 text-zinc-500">
                  {formatCategory(problem.category)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
