"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sql-coach:pending-analyses";
const POLL_INTERVAL_MS = 3000;
const MAX_AGE_MS = 5 * 60 * 1000; // 5 min — drop stale entries the poller never closed

export interface PendingAnalysis {
  id: number;
  slug: string;
  startedAt: number;
}

function read(): PendingAnalysis[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PendingAnalysis =>
        typeof p?.id === "number" &&
        typeof p?.slug === "string" &&
        typeof p?.startedAt === "number"
    );
  } catch {
    return [];
  }
}

function write(list: PendingAnalysis[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  // Notify other tabs/components in this tab
  window.dispatchEvent(new CustomEvent("sql-coach:pending-analyses-changed"));
}

export function enqueuePendingAnalysis(entry: PendingAnalysis): void {
  const list = read().filter((p) => p.id !== entry.id);
  list.push(entry);
  write(list);
}

export function usePendingAnalyses(): PendingAnalysis[] {
  const [pending, setPending] = useState<PendingAnalysis[]>([]);

  const refresh = useCallback(() => {
    setPending(read());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("storage", onChange);
    window.addEventListener("sql-coach:pending-analyses-changed", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("sql-coach:pending-analyses-changed", onChange);
    };
  }, [refresh]);

  useEffect(() => {
    if (pending.length === 0) return;
    let cancelled = false;

    const poll = async () => {
      const current = read();
      if (current.length === 0) return;

      const now = Date.now();
      const remaining: PendingAnalysis[] = [];

      for (const entry of current) {
        if (now - entry.startedAt > MAX_AGE_MS) continue; // drop stale
        try {
          const res = await fetch(`/api/coaching/analysis/${entry.id}`);
          if (!res.ok) {
            remaining.push(entry);
            continue;
          }
          const data = await res.json();
          if (data.status === "pending") {
            remaining.push(entry);
          }
          // done or error → drop from list
        } catch {
          remaining.push(entry);
        }
      }

      if (cancelled) return;
      if (remaining.length !== current.length) {
        write(remaining);
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    // Run one immediately so short analyses don't wait a full interval
    poll();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pending.length]);

  return pending;
}
