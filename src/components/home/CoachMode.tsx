"use client";

/**
 * Coach mode home — variant I from the design shotgun (2026-04-13).
 *
 * Layout:
 *   TODAY section
 *     └─ Hero card: category + difficulty + title + italic coach note
 *        + Start / Skip / Pick different, with inline stats cluster on the right
 *   WHY I PICKED THIS — collapsed row with teaser, expands into the full panel
 *     (mastery bars + candidate pool + learning path)
 *   THIS WEEK section — 7-day activity chart + Continue/Starred cards
 *   "Browse all N problems →" link
 */

import Link from "next/link";
import { useState } from "react";
import type { ProblemSummary, StatsStore } from "@/types";
import type { CoachPick, Candidate, LearningPathNode } from "@/lib/coach";
import {
  CategoryTag,
  DifficultyPill,
  Eyebrow,
  MasteryBar,
  MasteryRing,
  ReviewDot,
} from "./parts";

// --------------------------------------------------------------------
// Props
// --------------------------------------------------------------------

interface CoachModeProps {
  pick: CoachPick;
  problems: ProblemSummary[];
  store: StatsStore;
  /** ISO date strings for the last 7 days, oldest-first. */
  weekDays: string[];
  continueWorking: ProblemSummary | null;
  starredProblems: ProblemSummary[];
  /** Exclude the current pick from consideration and re-run the engine. */
  onSkip: () => void;
  /** Disables Skip when there is no pick to skip (catalog exhausted). */
  canSkip: boolean;
}

// --------------------------------------------------------------------
// Coach mode
// --------------------------------------------------------------------

export default function CoachMode({
  pick,
  problems,
  store,
  weekDays,
  continueWorking,
  starredProblems,
  onSkip,
  canSkip,
}: CoachModeProps) {
  const [expanded, setExpanded] = useState(false);
  const { problem, teaser, bullets, mastery, candidatePool, learningPath } =
    pick;

  const overallPct = pick.overallMasteryPct;
  const reviewDue = pick.reviewDueCount;

  return (
    <div className="mx-auto max-w-[1040px] px-6 py-10">
      {/* TODAY hero */}
      <Eyebrow>Today</Eyebrow>
      <div className="app-panel mt-3 flex items-start gap-6 p-6">
        <div className="min-w-0 flex-1">
          {problem ? (
            <>
              <div className="flex items-center gap-2">
                <CategoryTag>{labelFor(problem.category)}</CategoryTag>
                <DifficultyPill difficulty={problem.difficulty} />
              </div>
              <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-[color:var(--text)]">
                {problem.title}
              </h1>
              <p className="mt-2 text-sm italic text-[color:var(--text-muted)]">
                {shortCoachNote(pick)}
              </p>
              <div className="mt-5 flex items-center gap-3">
                <Link
                  href={`/problems/${problem.slug}`}
                  className="btn-primary"
                >
                  Start problem
                </Link>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={onSkip}
                  disabled={!canSkip}
                  title="Exclude this one and let the coach pick another"
                >
                  Skip
                </button>
                <Link href="/?mode=catalog" className="btn-ghost">
                  Pick different
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-[24px] font-semibold text-[color:var(--text)]">
                You've cleared the board
              </h1>
              <p className="mt-2 text-sm italic text-[color:var(--text-muted)]">
                {teaser}
              </p>
              <div className="mt-5">
                <Link href="/?mode=catalog" className="btn-primary">
                  Browse catalog
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Inline stats cluster */}
        <div className="flex shrink-0 items-center gap-5 border-l border-[color:var(--border)] pl-6">
          <div className="flex flex-col items-center">
            <MasteryRing value={overallPct / 100} size={48} stroke={5} />
            <div className="mt-1 text-xs font-medium text-[color:var(--text-muted)]">
              Mastery
            </div>
            <div className="num text-sm font-semibold text-[color:var(--text)]">
              {overallPct}%
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--border)]">
              <span className="num text-lg font-semibold text-[color:var(--text)]">
                {reviewDue}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-[color:var(--text-muted)]">
              {reviewDue > 0 && <ReviewDot title="Review due" />}
              Due for review
            </div>
          </div>
        </div>
      </div>

      {/* WHY I PICKED THIS — collapsible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="mt-3 flex w-full items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-3 text-left transition-colors hover:bg-[color:var(--panel-muted)]"
      >
        <div className="flex items-center gap-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <path
              d="M8 1.333a6.667 6.667 0 1 0 0 13.334A6.667 6.667 0 0 0 8 1.333Zm0 3.334a.667.667 0 1 1 0 1.333.667.667 0 0 1 0-1.333ZM8 7.333a.667.667 0 0 1 .667.667v3.333a.667.667 0 1 1-1.334 0V8c0-.368.299-.667.667-.667Z"
              fill="var(--accent)"
            />
          </svg>
          <div className="flex flex-col">
            <span className="eyebrow">Why I picked this</span>
            <span className="mt-0.5 text-sm italic text-[color:var(--text-muted)]">
              {teaser}
            </span>
          </div>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
          style={{
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 200ms ease",
          }}
        >
          <path
            d="M6 4l4 4-4 4"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {expanded && (
        <div className="animate-reveal mt-3">
          <WhyPanel
            bullets={bullets}
            mastery={mastery}
            candidatePool={candidatePool}
            learningPath={learningPath}
          />
        </div>
      )}

      {/* THIS WEEK */}
      <div className="mt-8">
        <Eyebrow>This week</Eyebrow>
        <div className="mt-3 grid grid-cols-12 gap-3">
          <div className="app-panel col-span-5 p-4">
            <ThisWeekChart weekDays={weekDays} store={store} />
          </div>
          <div className="app-panel col-span-7 flex flex-col gap-3 p-4">
            <div>
              <div className="eyebrow">Continue working</div>
              {continueWorking ? (
                <Link
                  href={`/problems/${continueWorking.slug}`}
                  className="mt-2 flex items-center justify-between rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--panel-muted)] px-3 py-2 text-sm hover:border-[color:var(--border)]"
                >
                  <span className="truncate text-[color:var(--text)]">
                    {continueWorking.title}
                  </span>
                  <DifficultyPill difficulty={continueWorking.difficulty} />
                </Link>
              ) : (
                <p className="mt-2 text-xs text-[color:var(--text-muted)]">
                  No recent work yet.
                </p>
              )}
            </div>
            <div>
              <div className="eyebrow">Starred</div>
              {starredProblems.length === 0 ? (
                <p className="mt-2 text-xs text-[color:var(--text-muted)]">
                  Star a problem to save it here.
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-1.5">
                  {starredProblems.slice(0, 3).map((p) => (
                    <Link
                      key={p.slug}
                      href={`/problems/${p.slug}`}
                      className="flex items-center justify-between rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--panel-muted)] px-3 py-2 text-sm hover:border-[color:var(--border)]"
                    >
                      <span className="truncate text-[color:var(--text)]">
                        {p.title}
                      </span>
                      <DifficultyPill difficulty={p.difficulty} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link href="/?mode=catalog" className="soft-link text-sm">
          Browse all {problems.length} problems →
        </Link>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Why-panel (expanded reasoning)
// --------------------------------------------------------------------

function WhyPanel({
  bullets,
  mastery,
  candidatePool,
  learningPath,
}: {
  bullets: string[];
  mastery: CoachPick["mastery"];
  candidatePool: Candidate[];
  learningPath: LearningPathNode[];
}) {
  // Show the 4 lowest-scored categories that are either unlocked or in-progress.
  const masteryRows = mastery
    .filter((m) => m.total > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);

  return (
    <div className="app-panel flex flex-col gap-6 p-5">
      {/* Bullet reasoning */}
      <ul className="flex flex-col gap-2 border-b border-[color:var(--border-subtle)] pb-5 text-sm text-[color:var(--text-soft)]">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 block h-1 w-1 shrink-0 rounded-full bg-[color:var(--accent)]" />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {/* Mastery scores */}
      <div>
        <Eyebrow>Mastery scores</Eyebrow>
        <div className="mt-3 flex flex-col gap-2">
          {masteryRows.map((row) => {
            const pct = Math.round(row.score * 100);
            const tag = pct < 10 ? "weakest" : pct < 25 ? "weak" : null;
            return (
              <div
                key={row.category}
                className="flex items-center gap-3"
              >
                <div className="min-w-0 flex-1 truncate text-sm text-[color:var(--text-soft)]">
                  {row.label}
                  {tag && (
                    <span className="ml-2 rounded bg-[color:var(--panel-muted)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
                      {tag}
                    </span>
                  )}
                </div>
                <div className="w-28">
                  <MasteryBar value={row.score} />
                </div>
                <div className="num w-10 text-right text-xs text-[color:var(--text-muted)]">
                  {pct.toString().padStart(2, "0")}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Candidate pool */}
      <div>
        <Eyebrow>Candidate pool</Eyebrow>
        <div className="mt-3 flex flex-col gap-1 font-[family-name:var(--font-mono)] text-xs">
          {candidatePool.map((c, i) => (
            <div
              key={`${c.problem.slug}-${i}`}
              className="flex items-center gap-2"
            >
              <div className="min-w-0 flex-1 truncate text-[color:var(--text-soft)]">
                {c.problem.title}
              </div>
              <span
                className={
                  c.status === "chosen"
                    ? "font-semibold text-[color:var(--accent)]"
                    : "text-[color:var(--text-muted)]"
                }
              >
                {statusLabel(c.status)}
              </span>
              <div className="min-w-0 max-w-[260px] truncate text-[color:var(--text-muted)]">
                {c.reason}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Learning path */}
      <div>
        <Eyebrow>Learning path</Eyebrow>
        <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
          {learningPath.map((n, i) => (
            <div key={n.category} className="flex items-center gap-1">
              {i > 0 && (
                <svg width="14" height="8" viewBox="0 0 14 8" aria-hidden>
                  <path
                    d="M0 4 H13 M10 1 L13 4 L10 7"
                    stroke="var(--border-strong)"
                    strokeWidth="1"
                    fill="none"
                  />
                </svg>
              )}
              <div
                className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${
                  n.current
                    ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                    : n.unlocked
                      ? "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-soft)]"
                      : "border-[color:var(--border-subtle)] bg-[color:var(--panel-muted)] text-[color:var(--text-muted)]"
                }`}
              >
                <span>{n.label}</span>
                <span className="num text-[10px] text-[color:var(--text-muted)]">
                  {Math.round(n.score * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// This-week chart — horizontal bars for 7 days of activity
// --------------------------------------------------------------------

function ThisWeekChart({
  weekDays,
  store,
}: {
  weekDays: string[];
  store: StatsStore;
}) {
  // Count activity days in the provided week.
  const activeSet = new Set(store.global.activeDays);
  const labels = ["S", "M", "T", "W", "T", "F", "S"];
  // Find max height for scaling — solves per day.
  const counts = weekDays.map((day) => {
    let count = 0;
    for (const stats of Object.values(store.problems)) {
      if (stats.solveHistory.includes(day)) count++;
    }
    return count;
  });
  const max = Math.max(1, ...counts);

  return (
    <div>
      <Eyebrow>Activity</Eyebrow>
      <div className="mt-3 flex h-16 items-end gap-1.5">
        {weekDays.map((day, i) => {
          const count = counts[i];
          const h = Math.max(4, (count / max) * 52);
          const active = activeSet.has(day);
          return (
            <div
              key={day}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${day}: ${count} solved`}
            >
              <div
                className="w-full rounded-sm"
                style={{
                  height: `${h}px`,
                  background: active
                    ? "var(--accent)"
                    : "var(--border)",
                  // Non-color differentiation for active days (a11y):
                  // a 2px indigo top border makes the signal survive colorblind modes.
                  borderTop: active ? "2px solid var(--accent-strong)" : undefined,
                }}
              />
              <div className="text-[10px] text-[color:var(--text-muted)]">
                {labels[new Date(day + "T00:00:00Z").getUTCDay()]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------

function labelFor(category: string): string {
  return category
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusLabel(status: Candidate["status"]): string {
  switch (status) {
    case "chosen":
      return "CHOSEN";
    case "held-for-review":
      return "HELD";
    case "skipped-recent":
      return "SKIPPED";
    case "skipped-prereq":
      return "LOCKED";
    case "skipped-mastered":
      return "DONE";
    case "skipped-too-hard":
      return "SKIPPED";
    case "skipped-solution-viewed":
      return "SKIPPED";
  }
}

function shortCoachNote(pick: CoachPick): string {
  // Prefer the first bullet if it reads well; otherwise fall back to teaser.
  if (pick.bullets.length > 0) return pick.bullets[0];
  return pick.teaser;
}
