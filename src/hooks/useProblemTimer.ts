"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Problem-workspace timer.
 *
 *   events the workspace triggers:
 *
 *     click Timer button             → toggle()
 *     user begins typing (code)      → beginTicking()
 *     user submits successfully      → stopTicking()   (preserve elapsed for modal)
 *     user hits Reset code           → reset()         (clear elapsed, stay armed)
 *     user confirms inline reset     → confirmReset()  (full disable)
 *     user cancels inline reset      → cancelReset()
 *
 *   state transitions:
 *     disabled ──toggle──▶ armed ──beginTicking──▶ ticking ──stopTicking──▶ armed
 *        ▲                                              │
 *        │                                              │ toggle() + elapsed>0
 *        │                                              ▼
 *        │                                        confirmingReset
 *        │                                              │
 *        └──────────────confirmReset──────────────────────
 *
 *   Interval pauses automatically when the tab is hidden.
 */
export interface ProblemTimer {
  enabled: boolean;
  started: boolean;
  elapsedMs: number;
  confirmingReset: boolean;
  /** Click handler for the Timer button — toggles enable or opens reset confirm. */
  toggle: () => void;
  /** Start the tick. Safe to call repeatedly; guards on enabled + not-started. */
  beginTicking: () => void;
  /** Stop the tick without clearing elapsed. Used on successful submit. */
  stopTicking: () => void;
  /** Clear elapsed + stop ticking. Stays armed. Used by Reset-code. */
  reset: () => void;
  /** Full disable from the inline reset-confirmation UI. */
  confirmReset: () => void;
  /** Dismiss the inline reset-confirmation UI. */
  cancelReset: () => void;
}

export function useProblemTimer(): ProblemTimer {
  const [enabled, setEnabled] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);

  // Pause the tick when the tab is hidden.
  useEffect(() => {
    const handler = () => {
      pausedRef.current = document.hidden;
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // Run the tick while started + enabled. The cleanup guarantees the
  // interval is cleared when either flag flips, or on unmount.
  useEffect(() => {
    if (started && enabled) {
      intervalRef.current = setInterval(() => {
        if (!pausedRef.current) {
          setElapsedMs((prev) => prev + 1000);
        }
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [started, enabled]);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      // Turning on — fresh armed state, not ticking yet.
      if (!current) {
        setStarted(false);
        setElapsedMs(0);
        return true;
      }
      // Turning off with elapsed time — open confirm. Stay enabled.
      if (started && elapsedMs > 0) {
        setConfirmingReset(true);
        return current;
      }
      // Turning off with no elapsed — just disable.
      setStarted(false);
      setElapsedMs(0);
      return false;
    });
  }, [started, elapsedMs]);

  const beginTicking = useCallback(() => {
    if (!enabled || started) return;
    setStarted(true);
  }, [enabled, started]);

  const stopTicking = useCallback(() => {
    setStarted(false);
  }, []);

  const reset = useCallback(() => {
    setStarted(false);
    setElapsedMs(0);
  }, []);

  const confirmReset = useCallback(() => {
    setConfirmingReset(false);
    setEnabled(false);
    setStarted(false);
    setElapsedMs(0);
  }, []);

  const cancelReset = useCallback(() => {
    setConfirmingReset(false);
  }, []);

  return {
    enabled,
    started,
    elapsedMs,
    confirmingReset,
    toggle,
    beginTicking,
    stopTicking,
    reset,
    confirmReset,
    cancelReset,
  };
}
