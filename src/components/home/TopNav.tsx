"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import StreakBadge from "@/components/StreakBadge";
import PendingAnalysesPill from "@/components/PendingAnalysesPill";
import ModeToggle, { type HomeMode } from "./ModeToggle";

function TopNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isHome = pathname === "/";
  const mode = (searchParams.get("mode") === "catalog"
    ? "catalog"
    : "coach") as HomeMode;

  return (
    <nav className="sticky top-0 z-40 shrink-0 border-b border-[color:var(--border)] bg-[color:var(--surface)]/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[color:var(--accent)] text-xs font-bold text-white">
            SQL
          </div>
          <div className="text-[15px] font-semibold tracking-tight text-[color:var(--text)]">
            SQL Coach
          </div>
        </Link>

        {/* Mode toggle — home only */}
        {isHome && (
          <div className="flex-1">
            <div className="mx-auto flex w-fit">
              <ModeToggle mode={mode} />
            </div>
          </div>
        )}
        {!isHome && <div className="flex-1" />}

        {/* Search (stub) */}
        <div className="hidden items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--panel-muted)] px-3 py-1.5 text-sm text-[color:var(--text-muted)] md:flex md:w-56">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <circle
              cx="6"
              cy="6"
              r="4.25"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="m12 12-2.5-2.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <span className="flex-1">Search</span>
          <kbd className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[10px] text-[color:var(--text-muted)]">
            ⌘K
          </kbd>
        </div>

        {/* Pending pill + streak */}
        <div className="flex items-center gap-3">
          <PendingAnalysesPill />
          <StreakBadge />
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--panel-muted)] text-xs font-semibold text-[color:var(--text-muted)]"
            aria-label="Profile"
          >
            YC
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function TopNav() {
  // useSearchParams requires a Suspense boundary for static render.
  return (
    <Suspense fallback={<div className="h-14 border-b border-[color:var(--border)]" />}>
      <TopNavInner />
    </Suspense>
  );
}
