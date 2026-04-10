"use client";

import { useRef, useEffect, useState, useCallback } from "react";
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

// Explicit grid positions: [col, row] — creates clear horizontal learning lanes
const GRID: Record<string, [number, number]> = {
  // Col 0: Foundation
  "basic-select":     [0, 2.5],

  // Col 1: Core
  "joins":            [1, 0],
  "aggregation":      [1, 1],
  "conditional-logic":[1, 2],
  "null-handling":    [1, 3],
  "date-functions":   [1, 4],
  "string-functions": [1, 5],

  // Col 2: Intermediate
  "subqueries":       [2, 0],
  "window-functions": [2, 1],
  "advanced-joins":   [2, 2],
  "pivoting":         [2, 3],
  "set-operations":   [2, 4],
  "data-quality":     [2, 5],

  // Col 3: Advanced
  "ctes":             [3, 0],
  "gaps-and-islands": [3, 1],
  "business-analysis":[3, 2],
  "cohort-analysis":  [3, 3],
};

const COL_LABELS = ["Foundation", "Core", "Intermediate", "Advanced"];
const NODE_W = 164; // px
const NODE_H = 72;  // px
const COL_GAP = 56; // px between columns
const ROW_GAP = 12; // px between rows
const HEADER_H = 32; // tier label height

type NodeState = "locked" | "available" | "started" | "completed";

function getNodeState(
  category: string,
  stats: CategoryStats | undefined,
  categoryStats: Map<string, CategoryStats>
): NodeState {
  const node = SKILL_TREE.find((n) => n.category === category);
  if (!node) return "available";

  // Check prerequisites
  const prereqsMet = node.prerequisites.every((prereq) => {
    const ps = categoryStats.get(prereq);
    return ps && ps.solved > 0; // at least 1 solved in prereq
  });

  if (!prereqsMet && node.prerequisites.length > 0) return "locked";
  if (!stats || stats.solved === 0) return "available";
  if (stats.solved >= stats.total) return "completed";
  return "started";
}

function stateStyles(state: NodeState): {
  bg: string;
  border: string;
  text: string;
  extra: string;
} {
  switch (state) {
    case "completed":
      return {
        bg: "bg-emerald-950/80",
        border: "border-emerald-500/50",
        text: "text-emerald-400",
        extra: "shadow-[0_0_12px_rgba(16,185,129,0.12)]",
      };
    case "started":
      return {
        bg: "bg-blue-950/40",
        border: "border-blue-500/30",
        text: "text-blue-400",
        extra: "",
      };
    case "available":
      return {
        bg: "bg-zinc-900",
        border: "border-zinc-600",
        text: "text-zinc-200",
        extra: "",
      };
    case "locked":
      return {
        bg: "bg-zinc-900/50",
        border: "border-zinc-800 border-dashed",
        text: "text-zinc-600",
        extra: "opacity-50",
      };
  }
}

export default function SkillTreeView({
  categoryStats,
  onSelectCategory,
}: SkillTreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [lines, setLines] = useState<
    Array<{
      x1: number; y1: number; x2: number; y2: number;
      state: "completed" | "active" | "locked";
    }>
  >([]);

  const computeLines = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    const newLines: typeof lines = [];
    for (const node of SKILL_TREE) {
      const toEl = nodeRefs.current.get(node.category);
      if (!toEl) continue;
      const toRect = toEl.getBoundingClientRect();

      const toState = getNodeState(node.category, categoryStats.get(node.category), categoryStats);

      for (const prereq of node.prerequisites) {
        const fromEl = nodeRefs.current.get(prereq);
        if (!fromEl) continue;
        const fromRect = fromEl.getBoundingClientRect();

        const fromState = getNodeState(prereq, categoryStats.get(prereq), categoryStats);

        let lineState: "completed" | "active" | "locked" = "locked";
        if (fromState === "completed" && (toState === "completed" || toState === "started")) {
          lineState = "completed";
        } else if (fromState === "completed" || fromState === "started") {
          lineState = "active";
        }

        newLines.push({
          x1: fromRect.right - rect.left + scrollLeft,
          y1: fromRect.top + fromRect.height / 2 - rect.top + scrollTop,
          x2: toRect.left - rect.left + scrollLeft,
          y2: toRect.top + toRect.height / 2 - rect.top + scrollTop,
          state: lineState,
        });
      }
    }
    setLines(newLines);
  }, [categoryStats]);

  useEffect(() => {
    const timer = setTimeout(computeLines, 80);
    window.addEventListener("resize", computeLines);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", computeLines);
    };
  }, [computeLines]);

  // Compute total grid dimensions
  const maxRow = Math.max(...Object.values(GRID).map(([, r]) => r));
  const totalW = 4 * (NODE_W + COL_GAP);
  const totalH = HEADER_H + (maxRow + 1) * (NODE_H + ROW_GAP);

  function lineColor(state: "completed" | "active" | "locked"): string {
    if (state === "completed") return "rgb(16 185 129 / 0.5)";   // emerald
    if (state === "active") return "rgb(59 130 246 / 0.35)";      // blue
    return "rgb(63 63 70 / 0.5)";                                 // zinc-700
  }

  function lineWidth(state: "completed" | "active" | "locked"): number {
    return state === "locked" ? 1 : 2;
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-auto"
      style={{ scrollbarWidth: "thin" }}
    >
      <div
        className="relative mx-auto"
        style={{
          width: totalW + 48,
          minHeight: totalH + 48,
          padding: 24,
        }}
      >
        {/* SVG connection lines */}
        <svg
          className="pointer-events-none absolute inset-0"
          style={{ width: totalW + 48, height: totalH + 48 }}
        >
          <defs>
            <marker id="arrow-active" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
              <path d="M 0 0 L 6 2 L 0 4" fill="rgb(59 130 246 / 0.5)" />
            </marker>
            <marker id="arrow-complete" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
              <path d="M 0 0 L 6 2 L 0 4" fill="rgb(16 185 129 / 0.5)" />
            </marker>
          </defs>
          {lines.map((line, i) => {
            const dx = line.x2 - line.x1;
            return (
              <path
                key={i}
                d={`M ${line.x1} ${line.y1} C ${line.x1 + dx * 0.4} ${line.y1}, ${line.x2 - dx * 0.4} ${line.y2}, ${line.x2} ${line.y2}`}
                fill="none"
                stroke={lineColor(line.state)}
                strokeWidth={lineWidth(line.state)}
                strokeDasharray={line.state === "locked" ? "4 4" : undefined}
                markerEnd={
                  line.state === "completed"
                    ? "url(#arrow-complete)"
                    : line.state === "active"
                      ? "url(#arrow-active)"
                      : undefined
                }
              />
            );
          })}
        </svg>

        {/* Column headers */}
        {COL_LABELS.map((label, col) => (
          <div
            key={label}
            className="absolute text-[10px] font-semibold uppercase tracking-widest text-zinc-600"
            style={{
              left: 24 + col * (NODE_W + COL_GAP) + NODE_W / 2,
              top: 24,
              transform: "translateX(-50%)",
            }}
          >
            {label}
          </div>
        ))}

        {/* Nodes */}
        {SKILL_TREE.map((node) => {
          const pos = GRID[node.category];
          if (!pos) return null;
          const [col, row] = pos;
          const stats = categoryStats.get(node.category);
          const state = getNodeState(node.category, stats, categoryStats);
          const styles = stateStyles(state);

          const left = 24 + col * (NODE_W + COL_GAP);
          const top = 24 + HEADER_H + row * (NODE_H + ROW_GAP);

          const pct = stats && stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0;

          return (
            <div
              key={node.category}
              ref={(el) => { if (el) nodeRefs.current.set(node.category, el); }}
              className="absolute"
              style={{ left, top, width: NODE_W, height: NODE_H }}
            >
              <button
                onClick={() => state !== "locked" && onSelectCategory(node.category)}
                className={`h-full w-full rounded-lg border px-3 py-2 text-left transition-all ${styles.bg} ${styles.border} ${styles.extra} ${
                  state === "locked"
                    ? "cursor-not-allowed"
                    : "hover:scale-[1.03] hover:brightness-110"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${styles.text}`}>
                    {node.label}
                  </span>
                  {state === "completed" && (
                    <span className="text-xs text-emerald-500">&#10003;</span>
                  )}
                  {state === "locked" && (
                    <span className="text-[10px] text-zinc-700">&#128274;</span>
                  )}
                </div>

                {/* Difficulty counts */}
                {stats && (
                  <div className="mt-1 flex gap-1">
                    {stats.easy > 0 && (
                      <span className="rounded-full bg-emerald-500/15 px-1.5 text-[9px] text-emerald-500">
                        {stats.easy}E
                      </span>
                    )}
                    {stats.medium > 0 && (
                      <span className="rounded-full bg-amber-400/15 px-1.5 text-[9px] text-amber-400">
                        {stats.medium}M
                      </span>
                    )}
                    {stats.hard > 0 && (
                      <span className="rounded-full bg-red-400/15 px-1.5 text-[9px] text-red-400">
                        {stats.hard}H
                      </span>
                    )}
                  </div>
                )}

                {/* Progress bar */}
                {stats && stats.total > 0 && (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all ${
                          state === "completed" ? "bg-emerald-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-600">
                      {stats.solved}/{stats.total}
                    </span>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
