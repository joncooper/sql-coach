"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "sql-coach:narrow-viewport-dismissed";
const MIN_WIDTH = 1280;

/**
 * One-time full-screen notice for users on viewports below the desktop
 * target (1280px). CLAUDE.md says desktop-only; this surfaces the
 * non-support honestly rather than silently breaking the layout.
 * Dismissal is remembered in localStorage.
 */
export default function NarrowViewportNotice() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    if (dismissed) return;
    if (window.innerWidth < MIN_WIDTH) {
      setShouldShow(true);
    }
  }, []);

  if (!shouldShow) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[color:var(--bg)]/90 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="narrow-viewport-title"
    >
      <div className="app-panel-strong max-w-[440px] px-7 py-6">
        <p className="eyebrow">Desktop optimized</p>
        <h2
          id="narrow-viewport-title"
          className="mt-2 text-lg font-semibold text-[color:var(--text)]"
        >
          SQL Coach is designed for 1280px+ displays
        </h2>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
          The split-pane editor needs width to breathe. Open SQL Coach on a
          wider screen for the intended experience.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem(DISMISS_KEY, "1");
              setShouldShow(false);
            }}
            className="btn-secondary"
          >
            Continue anyway
          </button>
        </div>
      </div>
    </div>
  );
}
