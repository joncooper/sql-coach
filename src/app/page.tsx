"use client";

/**
 * Home page — two modes selected via ?mode=coach|catalog.
 *
 *   • Coach (default) — Today hero, collapsed Why-I-picked-this, stats,
 *     This week chart. Variant I from the design shotgun.
 *   • Catalog — left skill-tree sidebar, dense sortable table,
 *     right-rail Today's Focus. Variant A from the design shotgun.
 *
 * This component is a thin orchestrator:
 *   1. Fetch the catalog (/api/problems).
 *   2. Load stats from localStorage.
 *   3. Run the coach engine (pure fn) to compute the pick + reasoning.
 *   4. Render the mode-specific view.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import type { ProblemSummary, StatsStore } from "@/types";
import { loadStats, toggleStar } from "@/lib/stats";
import {
  pickNextProblem,
  computeCategoryMastery,
  getReinforcementQueue,
  getReviewQueue,
  type CoachPick,
} from "@/lib/coach";
import CoachMode from "@/components/home/CoachMode";
import CatalogMode from "@/components/home/CatalogMode";

function HomeInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "catalog" ? "catalog" : "coach";

  const [problems, setProblems] = useState<ProblemSummary[] | null>(null);
  const [store, setStore] = useState<StatsStore | null>(null);
  // Session-local skip list. Clicking "Skip" on the Coach hero excludes
  // the current pick from consideration and re-runs the engine. Resets
  // on refresh — skip is a "not right now" signal, not a persistent
  // preference.
  const [skippedSlugs, setSkippedSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/problems")
      .then((r) => r.json())
      .then((list: ProblemSummary[]) => setProblems(list))
      .catch(() => setProblems([]));
    setStore(loadStats());
  }, []);

  const eligibleProblems = useMemo(() => {
    if (!problems) return null;
    if (skippedSlugs.size === 0) return problems;
    return problems.filter((p) => !skippedSlugs.has(p.slug));
  }, [problems, skippedSlugs]);

  // Coach engine is a pure function that can still throw on malformed
  // stats or missing problem metadata. Catch and render a fallback panel
  // rather than blanking the home page silently.
  const pickResult = useMemo<{
    pick: CoachPick | null;
    error: string | null;
  }>(() => {
    if (!eligibleProblems || !store) return { pick: null, error: null };
    try {
      return { pick: pickNextProblem(store, eligibleProblems), error: null };
    } catch (e) {
      return {
        pick: null,
        error: e instanceof Error ? e.message : "Coach engine failed",
      };
    }
  }, [eligibleProblems, store]);
  const pick = pickResult.pick;
  const coachError = pickResult.error;

  const mastery = useMemo(() => {
    if (!problems || !store) return null;
    return computeCategoryMastery(store, problems);
  }, [problems, store]);

  // Review + Reinforce queues are surfaced via explicit pills on the coach
  // card — they never auto-mix into the forward-progress pick. Computed
  // here (not in CoachMode) so the parent owns the stats->ProblemSummary
  // join.
  const reviewProblems = useMemo<ProblemSummary[]>(() => {
    if (!problems || !store) return [];
    const bySlug = new Map(problems.map((p) => [p.slug, p]));
    return getReviewQueue(store)
      .map((item) => bySlug.get(item.slug))
      .filter((p): p is ProblemSummary => !!p);
  }, [problems, store]);

  const reinforceCandidates = useMemo<ProblemSummary[]>(() => {
    if (!problems || !store) return [];
    return getReinforcementQueue(store, problems);
  }, [problems, store]);

  const handleSkipPick = useCallback(() => {
    const current = pick?.problem?.slug;
    if (!current) return;
    setSkippedSlugs((prev) => {
      const next = new Set(prev);
      next.add(current);
      return next;
    });
  }, [pick]);

  const weekDays = useMemo(() => {
    const out: string[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      out.push(`${y}-${m}-${day}`);
    }
    return out;
  }, []);

  const { continueWorking, starredProblems, starredSet } = useMemo(() => {
    if (!problems || !store) {
      return {
        continueWorking: null,
        starredProblems: [],
        starredSet: new Set<string>(),
      };
    }
    const bySlug = new Map(problems.map((p) => [p.slug, p]));

    // Most recently attempted problem, not the coach's pick.
    const recent = Object.entries(store.problems)
      .filter(([, s]) => s.lastAttemptAt)
      .sort((a, b) =>
        (b[1].lastAttemptAt ?? "").localeCompare(a[1].lastAttemptAt ?? "")
      );
    let cw: ProblemSummary | null = null;
    for (const [slug] of recent) {
      if (slug === pick?.problem?.slug) continue;
      const p = bySlug.get(slug);
      if (p) {
        cw = p;
        break;
      }
    }

    const starredSlugs = Object.entries(store.problems)
      .filter(([, s]) => s.starred)
      .map(([slug]) => slug);
    const starred: ProblemSummary[] = [];
    for (const slug of starredSlugs) {
      const p = bySlug.get(slug);
      if (p) starred.push(p);
    }

    return {
      continueWorking: cw,
      starredProblems: starred,
      starredSet: new Set(starredSlugs),
    };
  }, [problems, store, pick]);

  const handleToggleStar = useCallback((slug: string) => {
    const next = toggleStar(slug);
    setStore({ ...next });
  }, []);

  if (coachError) {
    return (
      <div className="mx-auto max-w-[640px] px-6 py-16 text-center">
        <div className="eyebrow">Coach engine hiccupped</div>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
          Something went wrong picking your next problem:
        </p>
        <code className="mt-2 inline-block rounded bg-[color:var(--panel-muted)] px-2 py-1 font-[family-name:var(--font-mono)] text-xs text-[color:var(--danger)]">
          {coachError}
        </code>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link href="/?mode=catalog" className="btn-primary">
            Browse catalog instead
          </Link>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.localStorage.removeItem("sql-coach:stats");
                window.location.reload();
              }
            }}
            className="btn-secondary"
          >
            Reset progress
          </button>
        </div>
      </div>
    );
  }

  if (!problems || !store || !pick || !mastery) {
    return <LoadingState />;
  }

  if (problems.length === 0) {
    return (
      <div className="mx-auto max-w-[640px] px-6 py-16 text-center">
        <div className="eyebrow">No problems loaded</div>
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">
          Run <code className="rounded bg-[color:var(--panel-muted)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs">./scripts/setup.sh</code>{" "}
          to seed the catalog, then refresh.
        </p>
      </div>
    );
  }

  if (mode === "catalog") {
    return (
      <CatalogMode
        problems={problems}
        store={store}
        pick={pick}
        mastery={mastery}
        onToggleStar={handleToggleStar}
        starredSet={starredSet}
      />
    );
  }

  return (
    <CoachMode
      pick={pick}
      problems={problems}
      store={store}
      weekDays={weekDays}
      continueWorking={continueWorking}
      starredProblems={starredProblems}
      reviewProblems={reviewProblems}
      reinforceCandidates={reinforceCandidates}
      onSkip={handleSkipPick}
      canSkip={pick.problem !== null}
    />
  );
}

function LoadingState() {
  return (
    <div className="mx-auto max-w-[640px] px-6 py-16 text-center">
      <div className="eyebrow">Loading</div>
      <p className="mt-3 text-sm text-[color:var(--text-muted)]">
        Reading your progress and computing today's pick...
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingState />}>
      <HomeInner />
    </Suspense>
  );
}
