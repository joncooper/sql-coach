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
      className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400"
      title="A background LLM is reviewing your recent wrong submission(s)."
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
      </span>
      <span>{label}</span>
    </div>
  );
}
