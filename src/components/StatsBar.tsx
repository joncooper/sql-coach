"use client";

import type { StatsStore } from "@/types";
import {
  getSolvedCount,
  computeStreak,
  getCategoryProgress,
  getReviewDueProblems,
} from "@/lib/stats";

function formatCategory(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StatsBarProps {
  problems: { slug: string; category: string; difficulty: "easy" | "medium" | "hard" }[];
  stats: StatsStore;
}

export default function StatsBar({ problems, stats }: StatsBarProps) {
  const solved = getSolvedCount(stats);
  if (solved === 0) return null;

  const total = problems.length;
  const streak = computeStreak(stats.global.activeDays);
  const reviewDue = getReviewDueProblems(stats).length;
  const categories = getCategoryProgress(stats, problems);
  const pct = Math.round((solved / total) * 100);

  return (
    <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
      {/* Summary row */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-200">
            {solved}/{total} solved
          </span>
          <div className="h-1.5 w-24 rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-zinc-600">{pct}%</span>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 text-amber-400">
            <span className="text-base">&#128293;</span>
            <span className="font-medium">{streak}-day streak</span>
            {stats.global.longestStreak > streak && (
              <span className="text-xs text-zinc-600">
                (best: {stats.global.longestStreak})
              </span>
            )}
          </div>
        )}
        {reviewDue > 0 && (
          <div className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
            {reviewDue} due for review
          </div>
        )}
      </div>

      {/* Category grid */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {categories.map((cat) => {
          const done = cat.solved + cat.practiced + cat.mastered;
          const barPct = cat.total > 0 ? (done / cat.total) * 100 : 0;
          return (
            <div
              key={cat.category}
              className="rounded-md bg-zinc-800/40 px-2.5 py-1.5"
            >
              <div className="flex items-baseline justify-between gap-1">
                <span className="truncate text-xs text-zinc-400">
                  {formatCategory(cat.category)}
                </span>
                <span className="shrink-0 text-[10px] text-zinc-600">
                  {done}/{cat.total}
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-zinc-700">
                <div
                  className="h-full rounded-full bg-emerald-500/70 transition-all"
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
