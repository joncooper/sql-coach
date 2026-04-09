"use client";

import { useEffect, useState } from "react";
import DifficultyBadge from "@/components/DifficultyBadge";

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

export default function Home() {
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/problems")
      .then((r) => r.json())
      .then(setProblems);

    const stored = localStorage.getItem("sql-coach:completed");
    if (stored) {
      const parsed = JSON.parse(stored);
      const map: Record<string, boolean> = {};
      for (const key of Object.keys(parsed)) map[key] = true;
      setCompleted(map);
    }
  }, []);

  const categories = Array.from(new Set(problems.map((p) => p.category))).sort();

  const filtered = problems.filter((p) => {
    if (filter !== "all" && p.difficulty !== filter && p.category !== filter)
      return false;
    if (
      search &&
      !p.title.toLowerCase().includes(search.toLowerCase()) &&
      !p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    )
      return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Problems</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {filtered.length !== problems.length
            ? `Showing ${filtered.length} of ${problems.length} problems`
            : `${problems.length} problems`}{" "}
          &middot; {Object.keys(completed).length} completed
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
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
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 outline-none"
        >
          <option value="all">All</option>
          <optgroup label="Difficulty">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </optgroup>
          <optgroup label="Category">
            {categories.map((c) => (
              <option key={c} value={c}>
                {formatCategory(c)}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/50">
              {Object.keys(completed).length > 0 && (
                <th className="w-8 px-3 py-2.5 text-left text-zinc-500"></th>
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
            {filtered.map((problem) => (
              <tr
                key={problem.slug}
                className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-900/50"
              >
                {Object.keys(completed).length > 0 && (
                  <td className="px-3 py-2.5 text-center text-zinc-500">
                    {completed[problem.slug] ? (
                      <span className="text-emerald-500">&#10003;</span>
                    ) : null}
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
                <td className="px-3 py-2.5 text-zinc-500">{formatCategory(problem.category)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
