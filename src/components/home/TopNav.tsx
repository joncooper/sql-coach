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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:border focus:border-[color:var(--border-strong)] focus:bg-[color:var(--surface)] focus:px-3 focus:py-1.5 focus:text-sm focus:font-medium focus:text-[color:var(--text)]"
      >
        Skip to content
      </a>
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

        {/* Pending pill + streak + solo indicator */}
        <div className="flex items-center gap-3">
          <PendingAnalysesPill />
          <StreakBadge />
          <span
            className="rounded-md border border-[color:var(--border)] bg-[color:var(--panel-muted)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]"
            title="Your progress lives in this browser's local storage"
          >
            solo
          </span>
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
