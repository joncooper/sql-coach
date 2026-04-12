"use client";

import { useEffect, useMemo, useState } from "react";
import DifficultyBadge from "@/components/DifficultyBadge";
import MasteryIndicator from "@/components/MasteryIndicator";
import GenerateProblem from "@/components/GenerateProblem";
import { useLlmStatus } from "@/hooks/useLlmStatus";
import { SKILL_TREE, sortBySkillTree } from "@/lib/skill-tree";
import {
  loadStats,
  computeMasteryLevel,
  computeStreak,
  getSolvedCount,
  getReviewDueProblems,
  getStarredProblems,
  toggleStar,
} from "@/lib/stats";
import type { StatsStore, MasteryLevel } from "@/types";

interface ProblemSummary {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  tags: string[];
  isGenerated?: boolean;
}

type ViewMode = "skills" | "problems";
type DifficultyFilter = "all" | "easy" | "medium" | "hard";

const DIFFICULTY_FILTERS: { value: DifficultyFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const SKILL_GROUPS: { name: string; categories: string[] }[] = [
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
];

function getSkillLabel(category: string): string {
  const node = SKILL_TREE.find((n) => n.category === category);
  if (node) return node.label;
  return category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Home() {
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("skills");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] =
    useState<DifficultyFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stats, setStats] = useState<StatsStore | null>(null);
  const { available: llmAvailable } = useLlmStatus();

  useEffect(() => {
    fetch("/api/problems")
      .then((r) => r.json())
      .then(setProblems);
    setStats(loadStats());
  }, []);

  const categoryStats = useMemo(() => {
    const m = new Map<string, { total: number; solved: number }>();
    for (const p of problems) {
      const entry = m.get(p.category) ?? { total: 0, solved: 0 };
      entry.total++;
      if (stats?.problems[p.slug]?.solvedAt) entry.solved++;
      m.set(p.category, entry);
    }
    return m;
  }, [problems, stats]);

  const groupsToShow = useMemo(() => {
    const known = new Set(SKILL_GROUPS.flatMap((g) => g.categories));
    const extras = Array.from(categoryStats.keys())
      .filter((c) => !known.has(c))
      .sort();
    const groups = SKILL_GROUPS.map((g) => ({
      ...g,
      categories: g.categories.filter((c) => categoryStats.has(c)),
    })).filter((g) => g.categories.length > 0);
    if (extras.length > 0) groups.push({ name: "Other", categories: extras });
    return groups;
  }, [categoryStats]);

  const problemBySlug = useMemo(() => {
    const m = new Map<string, ProblemSummary>();
    for (const p of problems) m.set(p.slug, p);
    return m;
  }, [problems]);

  const allProblemsSorted = useMemo(
    () => sortBySkillTree(problems),
    [problems]
  );

  const solvedCount = stats ? getSolvedCount(stats) : 0;
  const reviewSlugs = stats ? getReviewDueProblems(stats) : [];
  const starredSlugs = stats ? getStarredProblems(stats) : [];
  const currentStreak = stats ? computeStreak(stats.global.activeDays) : 0;
  const longestStreak = stats?.global.longestStreak ?? 0;
  const hasAnyActivity = stats
    ? Object.keys(stats.problems).length > 0
    : false;

  function getMastery(slug: string): MasteryLevel {
    if (!stats) return "unattempted";
    const p = problemBySlug.get(slug);
    return computeMasteryLevel(stats.problems[slug], p?.difficulty ?? "easy");
  }

  function isStarred(slug: string): boolean {
    return !!stats?.problems[slug]?.starred;
  }

  function handleToggleStar(slug: string) {
    const updated = toggleStar(slug);
    setStats({ ...updated });
  }

  const centerProblems = useMemo(() => {
    if (viewMode !== "problems") return [];
    const base = selectedCategory
      ? problems.filter((p) => p.category === selectedCategory)
      : allProblemsSorted;
    return base.filter((p) => {
      if (difficultyFilter !== "all" && p.difficulty !== difficultyFilter)
        return false;
      if (
        !selectedCategory &&
        categoryFilter !== "all" &&
        p.category !== categoryFilter
      )
        return false;
      return true;
    });
  }, [
    viewMode,
    selectedCategory,
    problems,
    allProblemsSorted,
    difficultyFilter,
    categoryFilter,
  ]);

  const allCategoriesSorted = useMemo(() => {
    const known = SKILL_GROUPS.flatMap((g) => g.categories);
    const present = new Set(categoryStats.keys());
    const ordered = known.filter((c) => present.has(c));
    const extras = Array.from(present)
      .filter((c) => !known.includes(c))
      .sort();
    return [...ordered, ...extras];
  }, [categoryStats]);

  function resetFilters() {
    setDifficultyFilter("all");
    setCategoryFilter("all");
  }

  function showSkills() {
    setViewMode("skills");
    setSelectedCategory(null);
    resetFilters();
  }

  function showAllProblems() {
    setViewMode("problems");
    setSelectedCategory(null);
    resetFilters();
  }

  function selectSkill(cat: string) {
    setViewMode("problems");
    setSelectedCategory(cat);
    resetFilters();
  }

  return (
    <div className="flex h-full">
      {/* LEFT SIDEBAR */}
      <aside className="w-52 shrink-0 overflow-y-auto border-r border-zinc-800 px-4 py-6">
        <nav className="space-y-1">
          <SidebarButton
            active={viewMode === "skills"}
            onClick={showSkills}
            label="Skills"
          />
          <SidebarButton
            active={viewMode === "problems" && selectedCategory === null}
            onClick={showAllProblems}
            label="All problems"
            count={problems.length || undefined}
          />
        </nav>

        {reviewSlugs.length > 0 && (
          <SidebarSection title="Due for review">
            {reviewSlugs.slice(0, 8).map((slug) => {
              const p = problemBySlug.get(slug);
              if (!p) return null;
              return (
                <a
                  key={slug}
                  href={`/problems/${slug}`}
                  className="block truncate py-1 text-xs text-zinc-400 hover:text-zinc-100"
                >
                  {p.title}
                </a>
              );
            })}
            {reviewSlugs.length > 8 && (
              <div className="pt-1 text-[10px] text-zinc-600">
                +{reviewSlugs.length - 8} more
              </div>
            )}
          </SidebarSection>
        )}

        <SidebarSection title="Starred">
          {starredSlugs.length === 0 ? (
            <div className="text-[11px] leading-relaxed text-zinc-600">
              Star a problem to save it for later.
            </div>
          ) : (
            starredSlugs.map((slug) => {
              const p = problemBySlug.get(slug);
              if (!p) return null;
              return (
                <a
                  key={slug}
                  href={`/problems/${slug}`}
                  className="block truncate py-1 text-xs text-zinc-400 hover:text-zinc-100"
                >
                  {p.title}
                </a>
              );
            })
          )}
        </SidebarSection>
      </aside>

      {/* CENTER */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex h-full w-full max-w-xl flex-col px-6">
          <div className="shrink-0 pt-10 pb-6">
            {viewMode === "skills" ? (
              <h1 className="text-lg text-zinc-100">Pick a skill</h1>
            ) : selectedCategory ? (
              <>
                <button
                  onClick={showSkills}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  ← All skills
                </button>
                <h1 className="mt-1 text-lg text-zinc-100">
                  {getSkillLabel(selectedCategory)}
                </h1>
              </>
            ) : (
              <h1 className="text-lg text-zinc-100">All problems</h1>
            )}
          </div>

          {viewMode === "problems" && (
            <ProblemsFilterBar
              difficulty={difficultyFilter}
              onDifficultyChange={setDifficultyFilter}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              categories={allCategoriesSorted}
              showCategoryFilter={selectedCategory === null}
            />
          )}

          <div className="min-h-0 flex-1 pb-10">
            {viewMode === "skills" ? (
              <SkillsList
                groups={groupsToShow}
                categoryStats={categoryStats}
                onSelect={selectSkill}
              />
            ) : (
              <ProblemsList
                problems={centerProblems}
                hasAnyActivity={hasAnyActivity}
                getMastery={getMastery}
                isStarred={isStarred}
                onToggleStar={handleToggleStar}
              />
            )}
          </div>
        </div>
      </main>

      {/* RIGHT SIDEBAR */}
      <aside className="w-60 shrink-0 overflow-y-auto border-l border-zinc-800 px-4 py-6">
        <StreakCard
          current={currentStreak}
          longest={longestStreak}
          activeDays={stats?.global.activeDays ?? []}
          solvedCount={solvedCount}
          totalCount={problems.length}
        />

        {hasAnyActivity && (
          <div className="mt-6 border-t border-zinc-800 pt-5">
            <MasteryLegend />
          </div>
        )}

        {llmAvailable && (
          <div className="mt-6 border-t border-zinc-800 pt-5">
            <GenerateProblem
              onGenerated={(slug) => {
                window.location.href = `/problems/${slug}`;
              }}
            />
          </div>
        )}
      </aside>
    </div>
  );
}

function SidebarButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        active
          ? "bg-zinc-800 text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
      }`}
    >
      <span>{label}</span>
      {count != null && (
        <span className="text-xs text-zinc-600">{count}</span>
      )}
    </button>
  );
}

function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <h2 className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {title}
      </h2>
      <div className="px-2">{children}</div>
    </div>
  );
}

function ProblemsFilterBar({
  difficulty,
  onDifficultyChange,
  categoryFilter,
  onCategoryChange,
  categories,
  showCategoryFilter,
}: {
  difficulty: DifficultyFilter;
  onDifficultyChange: (d: DifficultyFilter) => void;
  categoryFilter: string;
  onCategoryChange: (c: string) => void;
  categories: string[];
  showCategoryFilter: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5">
        {DIFFICULTY_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onDifficultyChange(value)}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              difficulty === value
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showCategoryFilter && (
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 outline-none focus:border-zinc-700"
        >
          <option value="all">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {getSkillLabel(cat)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function SkillsList({
  groups,
  categoryStats,
  onSelect,
}: {
  groups: { name: string; categories: string[] }[];
  categoryStats: Map<string, { total: number; solved: number }>;
  onSelect: (category: string) => void;
}) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.name}>
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            {group.name}
          </h2>
          <ul>
            {group.categories.map((cat) => {
              const cs = categoryStats.get(cat);
              const total = cs?.total ?? 0;
              const solved = cs?.solved ?? 0;
              const done = total > 0 && solved >= total;
              return (
                <li key={cat}>
                  <button
                    onClick={() => onSelect(cat)}
                    className="flex w-full items-baseline justify-between py-1.5 text-left text-sm text-zinc-300 hover:text-zinc-100"
                  >
                    <span>
                      {getSkillLabel(cat)}
                      {done && (
                        <span className="ml-2 text-emerald-500">✓</span>
                      )}
                    </span>
                    <span className="text-xs tabular-nums text-zinc-600">
                      {solved}/{total}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ProblemsList({
  problems,
  hasAnyActivity,
  getMastery,
  isStarred,
  onToggleStar,
}: {
  problems: ProblemSummary[];
  hasAnyActivity: boolean;
  getMastery: (slug: string) => MasteryLevel;
  isStarred: (slug: string) => boolean;
  onToggleStar: (slug: string) => void;
}) {
  if (problems.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">
        No problems yet.
      </div>
    );
  }

  return (
    <ul>
      {problems.map((problem) => {
        const starred = isStarred(problem.slug);
        return (
          <li
            key={problem.slug}
            className="flex items-center gap-2 py-2 text-sm"
          >
            <button
              onClick={() => onToggleStar(problem.slug)}
              aria-label={starred ? "Unstar" : "Star"}
              className={`shrink-0 text-base leading-none transition-colors ${
                starred
                  ? "text-amber-400 hover:text-amber-300"
                  : "text-zinc-700 hover:text-zinc-400"
              }`}
            >
              {starred ? "★" : "☆"}
            </button>
            {hasAnyActivity && (
              <MasteryIndicator level={getMastery(problem.slug)} />
            )}
            <a
              href={`/problems/${problem.slug}`}
              className="min-w-0 flex-1 truncate text-zinc-300 hover:text-zinc-100"
            >
              {problem.title}
              {problem.isGenerated && (
                <span className="ml-1.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                  AI
                </span>
              )}
            </a>
            <DifficultyBadge difficulty={problem.difficulty} />
          </li>
        );
      })}
    </ul>
  );
}

function MasteryLegend() {
  const items: { level: MasteryLevel; label: string; hint: string }[] = [
    { level: "attempted", label: "Attempted", hint: "tried, not solved" },
    { level: "solved", label: "Solved", hint: "passed once" },
    { level: "practiced", label: "Practiced", hint: "solved 2+ times" },
    { level: "mastered", label: "Mastered", hint: "3+ days, no peek" },
  ];
  return (
    <div>
      <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        Mastery
      </h2>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.level} className="flex items-baseline gap-2">
            <span className="w-5 shrink-0 text-center">
              <MasteryIndicator level={item.level} />
            </span>
            <span className="text-[11px] text-zinc-400">{item.label}</span>
            <span className="text-[10px] text-zinc-600">{item.hint}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StreakCard({
  current,
  longest,
  activeDays,
  solvedCount,
  totalCount,
}: {
  current: number;
  longest: number;
  activeDays: string[];
  solvedCount: number;
  totalCount: number;
}) {
  const last7 = useMemo(() => {
    const days: { date: string; active: boolean }[] = [];
    const set = new Set(activeDays);
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, active: set.has(key) });
    }
    return days;
  }, [activeDays]);

  return (
    <div>
      <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        Streak
      </h2>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-medium tabular-nums text-zinc-100">
          {current}
        </span>
        <span className="text-xs text-zinc-500">
          {current === 1 ? "day" : "days"}
        </span>
      </div>
      {longest > 0 && (
        <div className="mt-0.5 text-[11px] text-zinc-600">
          Longest {longest}
        </div>
      )}
      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wider text-zinc-600">
            Last 7 days
          </span>
          <span className="text-[10px] text-zinc-600">
            {last7.filter((d) => d.active).length}/7
          </span>
        </div>
        <div className="flex gap-1">
          {last7.map((d) => (
            <div
              key={d.date}
              title={`${d.date}${d.active ? " — active" : ""}`}
              className={`h-2 flex-1 rounded-sm ${
                d.active ? "bg-emerald-500/70" : "bg-zinc-800"
              }`}
            />
          ))}
        </div>
      </div>

      {totalCount > 0 && (
        <div className="mt-5">
          <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Progress
          </h2>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-zinc-400">
              <span className="text-zinc-200">{solvedCount}</span>
              <span className="text-zinc-600"> / {totalCount}</span>
            </span>
            <span className="text-zinc-600">
              {Math.round((solvedCount / totalCount) * 100)}%
            </span>
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-zinc-400 transition-all"
              style={{
                width: `${(solvedCount / totalCount) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
