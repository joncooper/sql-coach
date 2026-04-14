"use client";

import { usePendingAnalyses } from "@/hooks/usePendingAnalyses";

export default function PendingAnalysesPill() {
  const pending = usePendingAnalyses();
  if (pending.length === 0) return null;

  const label =
    pending.length === 1
      ? "analyzing attempt"
      : `analyzing ${pending.length} attempts`;

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--accent-soft)] px-3 py-1 text-xs text-[color:var(--accent)]"
      title="A background LLM is reviewing your recent wrong submission(s)."
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--accent)] opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
      </span>
      <span>{label}</span>
    </div>
  );
}
