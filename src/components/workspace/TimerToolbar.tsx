"use client";

import type { ProblemTimer } from "@/hooks/useProblemTimer";
import { formatElapsed } from "@/lib/formatTime";

interface TimerToolbarProps {
  timer: ProblemTimer;
}

/**
 * Timer toggle with inline reset confirmation.
 *
 *   default state:          [ Timer ]           (muted ghost)
 *   enabled, not ticking:   [ Timer ]           (amber-bg)
 *   enabled, ticking:       [ Timer 02:34 ]     (amber-bg, mono)
 *   confirming reset:       [ Reset 02:34?  Yes  No ]   (amber-bg form)
 */
export default function TimerToolbar({ timer }: TimerToolbarProps) {
  if (timer.confirmingReset) {
    return (
      <div
        role="group"
        aria-label="Confirm timer reset"
        className="flex items-center gap-2 border border-[color:var(--warning-soft)] bg-[color:var(--warning-soft)] px-3 py-1.5 text-sm"
      >
        <span className="font-medium text-[color:var(--text-soft)]">
          Reset {formatElapsed(timer.elapsedMs)}?
        </span>
        <button
          type="button"
          onClick={timer.confirmReset}
          className="rounded border border-[color:var(--danger)] bg-[color:var(--danger)] px-2 py-0.5 text-xs font-semibold text-white hover:brightness-105"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={timer.cancelReset}
          className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-0.5 text-xs font-medium text-[color:var(--text-soft)] hover:border-[color:var(--border-strong)]"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={timer.toggle}
      className={`border px-3 py-2 text-sm font-medium ${
        timer.enabled
          ? "border-[color:var(--warning-soft)] bg-[color:var(--warning-soft)] text-[color:var(--warning-text)]"
          : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:bg-[color:var(--panel-muted)] hover:text-[color:var(--text)]"
      }`}
      title={timer.enabled ? "Disable timer" : "Enable timer"}
    >
      Timer
      {timer.enabled && (
        <span className="ml-2 font-[family-name:var(--font-mono)]">
          {formatElapsed(timer.elapsedMs)}
        </span>
      )}
    </button>
  );
}
