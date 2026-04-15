"use client";

import { useEffect, type RefObject } from "react";

/**
 * Focus trap for modal dialogs.
 *
 *   on open:
 *     ┌────────────────────────────────────────┐
 *     │ remember previously focused element    │
 *     │ focus first tabbable in container      │
 *     └─────────────────┬──────────────────────┘
 *                       │
 *                       ▼
 *     ┌────────────────────────────────────────┐
 *     │ intercept Tab / Shift+Tab              │
 *     │   → loop within container              │
 *     │ intercept Escape                        │
 *     │   → call onEscape()                     │
 *     └─────────────────┬──────────────────────┘
 *                       │
 *                       ▼
 *   on close:
 *     ┌────────────────────────────────────────┐
 *     │ restore focus to prior element          │
 *     └────────────────────────────────────────┘
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onEscape?: () => void
) {
  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus the first tabbable element inside the container.
    const focusable = getTabbable(container);
    if (focusable.length > 0) {
      // Small delay so the modal is mounted and layout is stable.
      const id = window.setTimeout(() => focusable[0].focus(), 10);
      // We clear the timer in cleanup just to be safe.
      return () => window.clearTimeout(id);
    }
  }, [isOpen, containerRef]);

  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscape?.();
        return;
      }
      if (e.key !== "Tab") return;
      const tabbable = getTabbable(container);
      if (tabbable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = tabbable[0];
      const last = tabbable[tabbable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, containerRef, onEscape]);

  useEffect(() => {
    if (isOpen) return;
    // Closed — no-op. The return-focus path is handled below.
  }, [isOpen]);

  // Return focus to the element that was focused before the modal opened.
  // Split into its own effect so it runs on close, not on every render.
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [isOpen]);
}

const TABBABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getTabbable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)
  ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
}
