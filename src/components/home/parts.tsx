"use client";

/**
 * Shared primitives for Coach + Catalog home modes.
 * All visual tokens live in /DESIGN.md and /src/app/globals.css.
 */

import type { CSSProperties, ReactNode } from "react";

// --------------------------------------------------------------------
// Difficulty pill
// --------------------------------------------------------------------

export function DifficultyPill({
  difficulty,
}: {
  difficulty: "easy" | "medium" | "hard";
}) {
  return <span className={`pill pill-${difficulty}`}>{difficulty}</span>;
}

// --------------------------------------------------------------------
// Category tag
// --------------------------------------------------------------------

export function CategoryTag({
  label,
  children,
}: {
  label?: string;
  children?: ReactNode;
}) {
  return <span className="tag">{children ?? label}</span>;
}

// --------------------------------------------------------------------
// Mastery ring — circular progress, 0–1 value.
// --------------------------------------------------------------------

export function MasteryRing({
  value,
  size = 36,
  label,
  stroke = 4,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = size / 2 - stroke / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * clamped;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div
      className="inline-flex flex-col items-center justify-center gap-0.5"
      style={{ width: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-label={label ?? `${Math.round(clamped * 100)}% mastered`}
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 400ms ease" }}
        />
      </svg>
    </div>
  );
}

// --------------------------------------------------------------------
// Mastery bar — horizontal, 0–1.
// --------------------------------------------------------------------

export function MasteryBar({
  value,
  width = "100%",
}: {
  value: number;
  width?: string | number;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const style: CSSProperties = { width };
  return (
    <div className="mastery-bar" style={style}>
      <span style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

// --------------------------------------------------------------------
// Small review-due dot
// --------------------------------------------------------------------

export function ReviewDot({ title }: { title?: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: "var(--review-due)" }}
      title={title}
    />
  );
}

// --------------------------------------------------------------------
// Eyebrow label
// --------------------------------------------------------------------

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}
