"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { SKILL_TREE, type SkillNode } from "@/lib/skill-tree";

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

const TIER_LABELS = ["Foundation", "Core", "Intermediate", "Advanced"];

function nodeColor(stats: CategoryStats | undefined): {
  bg: string;
  border: string;
  text: string;
  glow: string;
} {
  if (!stats || stats.total === 0) {
    return { bg: "bg-zinc-900", border: "border-zinc-700", text: "text-zinc-500", glow: "" };
  }
  const pct = stats.solved / stats.total;
  if (pct >= 1) {
    return { bg: "bg-emerald-950", border: "border-emerald-500/50", text: "text-emerald-400", glow: "shadow-[0_0_8px_rgba(16,185,129,0.15)]" };
  }
  if (pct > 0) {
    return { bg: "bg-blue-950/50", border: "border-blue-500/30", text: "text-blue-400", glow: "" };
  }
  return { bg: "bg-zinc-900", border: "border-zinc-700", text: "text-zinc-400", glow: "" };
}

function ProgressBar({ stats }: { stats: CategoryStats | undefined }) {
  if (!stats || stats.total === 0) return null;
  const pct = Math.round((stats.solved / stats.total) * 100);
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="h-1 flex-1 rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-600">{stats.solved}/{stats.total}</span>
    </div>
  );
}

function DifficultyDots({ stats }: { stats: CategoryStats | undefined }) {
  if (!stats) return null;
  return (
    <div className="mt-1 flex gap-1">
      {stats.easy > 0 && (
        <span className="rounded-full bg-emerald-500/15 px-1.5 py-0 text-[9px] text-emerald-500">
          {stats.easy}E
        </span>
      )}
      {stats.medium > 0 && (
        <span className="rounded-full bg-amber-400/15 px-1.5 py-0 text-[9px] text-amber-400">
          {stats.medium}M
        </span>
      )}
      {stats.hard > 0 && (
        <span className="rounded-full bg-red-400/15 px-1.5 py-0 text-[9px] text-red-400">
          {stats.hard}H
        </span>
      )}
    </div>
  );
}

export default function SkillTreeView({
  categoryStats,
  onSelectCategory,
}: SkillTreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [lines, setLines] = useState<
    Array<{ x1: number; y1: number; x2: number; y2: number }>
  >([]);

  const tiers: SkillNode[][] = [[], [], [], []];
  for (const node of SKILL_TREE) {
    tiers[node.tier].push(node);
  }

  const computeLines = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const newLines: typeof lines = [];
    for (const node of SKILL_TREE) {
      const toEl = nodeRefs.current.get(node.category);
      if (!toEl) continue;
      const toRect = toEl.getBoundingClientRect();

      for (const prereq of node.prerequisites) {
        const fromEl = nodeRefs.current.get(prereq);
        if (!fromEl) continue;
        const fromRect = fromEl.getBoundingClientRect();

        newLines.push({
          x1: fromRect.right - containerRect.left,
          y1: fromRect.top + fromRect.height / 2 - containerRect.top,
          x2: toRect.left - containerRect.left,
          y2: toRect.top + toRect.height / 2 - containerRect.top,
        });
      }
    }
    setLines(newLines);
  }, []);

  useEffect(() => {
    // Compute after layout
    const timer = setTimeout(computeLines, 50);
    window.addEventListener("resize", computeLines);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", computeLines);
    };
  }, [computeLines]);

  return (
    <div ref={containerRef} className="relative h-full overflow-auto p-6">
      {/* SVG connection lines */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {lines.map((line, i) => (
          <path
            key={i}
            d={`M ${line.x1} ${line.y1} C ${line.x1 + 40} ${line.y1}, ${line.x2 - 40} ${line.y2}, ${line.x2} ${line.y2}`}
            fill="none"
            stroke="rgb(63 63 70)" // zinc-700
            strokeWidth="1.5"
          />
        ))}
      </svg>

      {/* Tier columns */}
      <div className="relative flex items-start gap-8">
        {tiers.map((tier, tierIdx) => (
          <div key={tierIdx} className="flex flex-col items-center gap-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              {TIER_LABELS[tierIdx]}
            </div>
            {tier.map((node) => {
              const stats = categoryStats.get(node.category);
              const colors = nodeColor(stats);
              return (
                <div
                  key={node.category}
                  ref={(el) => {
                    if (el) nodeRefs.current.set(node.category, el);
                  }}
                >
                  <button
                    onClick={() => onSelectCategory(node.category)}
                    className={`w-44 rounded-lg border px-3 py-2.5 text-left transition-all hover:scale-[1.02] hover:brightness-110 ${colors.bg} ${colors.border} ${colors.glow}`}
                  >
                    <div className={`text-sm font-medium ${colors.text}`}>
                      {node.label}
                    </div>
                    <DifficultyDots stats={stats} />
                    <ProgressBar stats={stats} />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
