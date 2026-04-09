"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ProblemDescriptionProps {
  description: string;
  hints: string[];
  onHintReveal?: (count: number) => void;
  solution?: string | null;
  canShowSolution?: boolean;
  onShowSolution?: () => void;
  reviewDue?: boolean;
}

export default function ProblemDescription({
  description,
  hints,
  onHintReveal,
  solution,
  canShowSolution,
  onShowSolution,
  reviewDue,
}: ProblemDescriptionProps) {
  const [revealedHints, setRevealedHints] = useState(0);

  const revealHint = () => {
    const next = revealedHints + 1;
    setRevealedHints(next);
    onHintReveal?.(next);
  };

  return (
    <div className="space-y-4">
      {reviewDue && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-300">
          Due for review — solve again to strengthen mastery
        </div>
      )}
      <div className="prose prose-invert prose-sm max-w-none prose-p:text-zinc-300 prose-code:rounded prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-blue-400 prose-code:before:content-none prose-code:after:content-none prose-strong:text-zinc-200">
        <Markdown remarkPlugins={[remarkGfm]}>{description}</Markdown>
      </div>

      {hints.length > 0 && (
        <div className="border-t border-zinc-800 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Hints
          </h3>
          <div className="mt-2 space-y-2">
            {hints.map((hint, i) => (
              <div key={i}>
                {i < revealedHints ? (
                  <div className="rounded bg-zinc-800/50 px-3 py-2 text-sm text-zinc-400">
                    {hint}
                  </div>
                ) : i === revealedHints ? (
                  <button
                    onClick={revealHint}
                    className="rounded bg-zinc-800/30 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400"
                  >
                    Show hint {i + 1}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Show Solution */}
      {canShowSolution && !solution && (
        <div className="border-t border-zinc-800 pt-3">
          <button
            onClick={onShowSolution}
            className="rounded bg-zinc-800/30 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400"
          >
            Show solution
          </button>
        </div>
      )}

      {solution && (
        <details open className="border-t border-zinc-800 pt-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Solution
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-zinc-900 p-3 text-sm text-zinc-300">
            <code>{solution}</code>
          </pre>
        </details>
      )}
    </div>
  );
}
