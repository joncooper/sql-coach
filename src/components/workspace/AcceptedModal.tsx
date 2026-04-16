"use client";

import { useRef } from "react";
import type { MasteryLevel } from "@/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { NextResult } from "@/lib/problem-navigation";

interface AcceptedModalProps {
  executionTimeMs: number;
  elapsedLabel: string | null;
  attemptCount: number;
  masteryTransition: { from: MasteryLevel; to: MasteryLevel } | null;
  totalSolved: number;
  /**
   * Next-problem navigation, computed on the problem page. Honors catalog
   * filter context when present, otherwise falls back to skill-tree order.
   */
  nextResult: NextResult;
  onClose: () => void;
}

const masteryLabels: Record<MasteryLevel, string> = {
  unattempted: "Unattempted",
  attempted: "Attempted",
  solved: "Solved",
  practiced: "Practiced",
  mastered: "Mastered ★",
};

/**
 * First-pass celebration modal. Shown only when the user just moved
 * from unattempted/attempted → solved. Subsequent solves get the
 * inline celebration banner instead (see page.tsx).
 *
 *   focus flow:
 *     previously-focused element → modal primary button → (on close) previously-focused
 *     Tab / Shift+Tab loop within the modal (useFocusTrap)
 *     Escape closes
 */
export default function AcceptedModal({
  executionTimeMs,
  elapsedLabel,
  attemptCount,
  masteryTransition,
  totalSolved,
  nextResult,
  onClose,
}: AcceptedModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, true, onClose);

  return (
    <div
      className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-black/10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="accepted-eyebrow"
    >
      <div
        ref={containerRef}
        className="app-panel-strong animate-in max-w-lg border border-[color:var(--border-strong)] px-8 py-7 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <p id="accepted-eyebrow" className="eyebrow">
          Accepted
        </p>
        <div className="mt-3 text-2xl font-semibold leading-none text-[color:var(--positive)]">
          Clean pass.
        </div>
        <div className="mt-4 text-sm leading-6 text-[color:var(--text-soft)]">
          Runtime {executionTimeMs}ms
          {elapsedLabel && <span className="ml-3">Time {elapsedLabel}</span>}
        </div>
        {attemptCount > 1 && (
          <div className="mt-2 text-sm text-[color:var(--text-muted)]">
            Solved in {attemptCount} attempts
          </div>
        )}
        {masteryTransition && (
          <div className="mt-2 text-sm text-[color:var(--accent-strong)]">
            {masteryTransition.from === "unattempted" ||
            masteryTransition.from === "attempted"
              ? null
              : `${masteryLabels[masteryTransition.from]} → `}
            {masteryLabels[masteryTransition.to]}
          </div>
        )}
        {totalSolved > 0 && (
          <div className="mt-2 text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
            {totalSolved} total solved
          </div>
        )}

        <EndOfSectionBanner nextResult={nextResult} />

        <div className="mt-6 flex items-center justify-center gap-3">
          <PrimaryNextButton nextResult={nextResult} />
          <a
            href="/"
            className="border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--text-soft)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]"
          >
            Return to Coach
          </a>
          <button
            type="button"
            onClick={onClose}
            className="border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--text-soft)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]"
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Message rendered between the stats and the button row when the user has
 * exhausted a catalog filter. Silent in the common "next in filter" case.
 */
function EndOfSectionBanner({ nextResult }: { nextResult: NextResult }) {
  if (nextResult.kind !== "end-of-filter") return null;
  const label = nextResult.filterLabel;
  return (
    <div className="mt-4 border border-[color:var(--accent-soft)] bg-[color:var(--accent-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--accent-strong)]">
      {label
        ? `You've cleared ${label}.`
        : "You've cleared this filter."}
      {nextResult.nextSectionLabel && (
        <div className="mt-1 text-xs text-[color:var(--text-soft)]">
          Continue to {nextResult.nextSectionLabel}?
        </div>
      )}
    </div>
  );
}

function PrimaryNextButton({ nextResult }: { nextResult: NextResult }) {
  // Plain "next inside the filter" or "next in skill-tree order" — same UI.
  if (nextResult.kind === "next" && nextResult.slug) {
    return (
      <a
        href={`/problems/${nextResult.slug}`}
        className="border border-[color:var(--positive)] bg-[color:var(--positive)] px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
      >
        Next problem
      </a>
    );
  }

  // Filter exhausted with a section highlighted — offer the next section.
  if (nextResult.kind === "end-of-filter" && nextResult.nextSectionSlug) {
    return (
      <a
        href={`/problems/${nextResult.nextSectionSlug}`}
        className="border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
      >
        Continue to next section
      </a>
    );
  }

  // Catalog exhausted, or filter exhausted with no next section — only
  // secondary actions remain (Return to Coach, Keep editing).
  return null;
}
