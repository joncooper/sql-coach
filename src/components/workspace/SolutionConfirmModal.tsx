"use client";

import { useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface SolutionConfirmModalProps {
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Destructive-style confirmation modal for revealing the problem's
 * reference solution. Replaces window.confirm() which broke the
 * Linear × Notion × Raycast register.
 *
 *   Cancel default, destructive on the right, Escape closes,
 *   focus trapped, returns to trigger on close.
 */
export default function SolutionConfirmModal({
  onConfirm,
  onClose,
}: SolutionConfirmModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, true, onClose);

  return (
    <div
      className="absolute inset-0 z-30 flex cursor-pointer items-center justify-center bg-black/15"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="solution-confirm-title"
    >
      <div
        ref={containerRef}
        className="app-panel-strong max-w-md border border-[color:var(--border-strong)] px-7 py-6"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow text-[color:var(--danger)]">Reveal solution</p>
        <h3
          id="solution-confirm-title"
          className="mt-2 text-lg font-semibold text-[color:var(--text)]"
        >
          This problem can never reach Mastered.
        </h3>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
          Viewing the reference solution permanently blocks Mastered status for
          this problem. You&apos;ll still be able to practice it, but the
          coach&apos;s mastery ring won&apos;t fill in.
        </p>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-ghost">
            Keep trying
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="border border-[color:var(--danger)] bg-[color:var(--danger)] px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
          >
            Reveal solution
          </button>
        </div>
      </div>
    </div>
  );
}
