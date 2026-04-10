"use client";

import { SKILL_TREE } from "@/lib/skill-tree";

interface CategoryStats {
  total: number;
  solved: number;
  easy: number;
  medium: number;
  hard: number;
}

interface SkillTreeViewProps {
  categoryStats: Map<string, CategoryStats>;
  onSelectCategory: (category: string) => void;
}

// Learning tracks: named paths of sequential skills
interface Track {
  name: string;
  paths: string[][]; // each sub-array is a left-to-right sequence
}

const TRACKS: Track[] = [
  {
    name: "Fundamentals",
    paths: [
      ["basic-select", "joins", "subqueries", "ctes"],
    ],
  },
  {
    name: "Analytics",
    paths: [
      ["aggregation", "window-functions", "gaps-and-islands"],
      ["cohort-analysis"],
    ],
  },
  {
    name: "Logic & Transformation",
    paths: [
      ["conditional-logic", "pivoting"],
      ["null-handling"],
    ],
  },
  {
    name: "Text & Dates",
    paths: [
      ["date-functions", "string-functions"],
    ],
  },
  {
    name: "Applied",
    paths: [
      ["advanced-joins", "data-quality"],
      ["business-analysis", "set-operations"],
    ],
  },
];

type NodeState = "locked" | "available" | "started" | "completed";

function getNodeState(
  category: string,
  stats: CategoryStats | undefined,
  categoryStats: Map<string, CategoryStats>
): NodeState {
  const node = SKILL_TREE.find((n) => n.category === category);
  if (!node) return "available";

  const prereqsMet = node.prerequisites.every((prereq) => {
    const ps = categoryStats.get(prereq);
    return ps && ps.solved > 0;
  });

  if (!prereqsMet && node.prerequisites.length > 0) return "locked";
  if (!stats || stats.solved === 0) return "available";
  if (stats.solved >= stats.total) return "completed";
  return "started";
}

function NodeCard({
  category,
  stats,
  state,
  onClick,
}: {
  category: string;
  stats: CategoryStats | undefined;
  state: NodeState;
  onClick: () => void;
}) {
  const node = SKILL_TREE.find((n) => n.category === category);
  if (!node) return null;

  const pct = stats && stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0;

  const stateClass = {
    completed: "border-emerald-500/40 bg-emerald-950/60 shadow-[0_0_12px_rgba(16,185,129,0.08)]",
    started: "border-blue-500/30 bg-blue-950/30",
    available: "border-zinc-600 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/80",
    locked: "border-zinc-800 border-dashed bg-zinc-900/40 opacity-45 cursor-not-allowed",
  }[state];

  const textClass = {
    completed: "text-emerald-400",
    started: "text-blue-400",
    available: "text-zinc-200",
    locked: "text-zinc-600",
  }[state];

  return (
    <button
      onClick={() => state !== "locked" && onClick()}
      className={`flex min-w-[140px] flex-col rounded-lg border px-3 py-2 text-left transition-all ${stateClass}`}
    >
      <div className="flex items-center gap-1.5">
        {state === "completed" && <span className="text-[11px] text-emerald-500">&#10003;</span>}
        <span className={`text-[13px] font-medium ${textClass}`}>
          {node.label}
        </span>
        {state === "locked" && <span className="ml-auto text-[10px]">&#128274;</span>}
      </div>

      {stats && state !== "locked" && (
        <div className="mt-1 flex gap-1">
          {stats.easy > 0 && (
            <span className="rounded-full bg-emerald-500/15 px-1.5 text-[9px] text-emerald-500">{stats.easy}E</span>
          )}
          {stats.medium > 0 && (
            <span className="rounded-full bg-amber-400/15 px-1.5 text-[9px] text-amber-400">{stats.medium}M</span>
          )}
          {stats.hard > 0 && (
            <span className="rounded-full bg-red-400/15 px-1.5 text-[9px] text-red-400">{stats.hard}H</span>
          )}
        </div>
      )}

      {stats && stats.total > 0 && state !== "locked" && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all ${
                state === "completed" ? "bg-emerald-500" : "bg-blue-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-zinc-600">{stats.solved}/{stats.total}</span>
        </div>
      )}
    </button>
  );
}

function Arrow({ state }: { state: "active" | "dim" }) {
  return (
    <div className="flex items-center px-1">
      <svg width="20" height="12" viewBox="0 0 20 12" className="shrink-0">
        <path
          d="M 0 6 L 14 6 M 10 2 L 16 6 L 10 10"
          fill="none"
          stroke={state === "active" ? "rgb(59 130 246 / 0.5)" : "rgb(63 63 70 / 0.6)"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function PrereqLabel({ category, categoryStats }: { category: string; categoryStats: Map<string, CategoryStats> }) {
  const node = SKILL_TREE.find((n) => n.category === category);
  if (!node || node.prerequisites.length === 0) return null;

  // Only show cross-track prerequisites (not the previous node in the same path)
  const crossTrackPrereqs = node.prerequisites.filter((prereq) => {
    // Check if prereq is in the same path as this node
    for (const track of TRACKS) {
      for (const path of track.paths) {
        const thisIdx = path.indexOf(category);
        const prereqIdx = path.indexOf(prereq);
        if (thisIdx >= 0 && prereqIdx >= 0 && prereqIdx === thisIdx - 1) {
          return false; // same path, directly preceding — don't show label
        }
      }
    }
    return true;
  });

  if (crossTrackPrereqs.length === 0) return null;

  const met = crossTrackPrereqs.every((p) => {
    const s = categoryStats.get(p);
    return s && s.solved > 0;
  });

  const labels = crossTrackPrereqs.map((p) => {
    const n = SKILL_TREE.find((s) => s.category === p);
    return n?.label ?? p;
  });

  return (
    <div className={`mt-0.5 text-[9px] ${met ? "text-zinc-600" : "text-zinc-700"}`}>
      needs {labels.join(" + ")}
    </div>
  );
}

export default function SkillTreeView({
  categoryStats,
  onSelectCategory,
}: SkillTreeViewProps) {
  return (
    <div className="h-full overflow-auto px-6 py-4" style={{ scrollbarWidth: "thin" }}>
      <div className="space-y-5">
        {TRACKS.map((track) => (
          <div key={track.name}>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              {track.name}
            </div>
            <div className="space-y-2">
              {track.paths.map((path, pathIdx) => (
                <div key={pathIdx} className="flex flex-wrap items-center gap-y-2">
                  {path.map((category, nodeIdx) => {
                    const stats = categoryStats.get(category);
                    const state = getNodeState(category, stats, categoryStats);

                    // Arrow state: active if previous node is completed/started
                    let arrowState: "active" | "dim" = "dim";
                    if (nodeIdx > 0) {
                      const prevStats = categoryStats.get(path[nodeIdx - 1]);
                      const prevState = getNodeState(path[nodeIdx - 1], prevStats, categoryStats);
                      if (prevState === "completed" || prevState === "started") {
                        arrowState = "active";
                      }
                    }

                    return (
                      <div key={category} className="flex items-center">
                        {nodeIdx > 0 && <Arrow state={arrowState} />}
                        <div>
                          <NodeCard
                            category={category}
                            stats={stats}
                            state={state}
                            onClick={() => onSelectCategory(category)}
                          />
                          <PrereqLabel category={category} categoryStats={categoryStats} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
