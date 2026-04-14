"use client";

import Link from "next/link";

export type HomeMode = "coach" | "catalog";

export default function ModeToggle({ mode }: { mode: HomeMode }) {
  const base =
    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors";
  const active =
    "bg-[color:var(--accent-soft)] text-[color:var(--accent)]";
  const inactive =
    "text-[color:var(--text-muted)] hover:text-[color:var(--text)]";

  return (
    <div
      role="tablist"
      aria-label="Home mode"
      className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1"
    >
      <Link
        role="tab"
        aria-selected={mode === "coach"}
        href="/?mode=coach"
        className={`${base} ${mode === "coach" ? active : inactive}`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden
        >
          <path
            d="M7 1.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-3.5 9a3.5 3.5 0 0 1 7 0v.5a.5.5 0 0 1-.5.5h-6a.5.5 0 0 1-.5-.5v-.5Z"
            fill="currentColor"
          />
        </svg>
        Coach
      </Link>
      <Link
        role="tab"
        aria-selected={mode === "catalog"}
        href="/?mode=catalog"
        className={`${base} ${mode === "catalog" ? active : inactive}`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden
        >
          <path
            d="M2 3.5A1.5 1.5 0 0 1 3.5 2h7A1.5 1.5 0 0 1 12 3.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 2 10.5v-7Zm2 0V5h6V3.5H4Zm0 3V8h6V6.5H4Zm0 3V11h6V9.5H4Z"
            fill="currentColor"
          />
        </svg>
        Catalog
      </Link>
    </div>
  );
}
