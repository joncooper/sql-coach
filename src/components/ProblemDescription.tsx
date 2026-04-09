"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ProblemDescriptionProps {
  description: string;
  hints: string[];
}

export default function ProblemDescription({
  description,
  hints,
}: ProblemDescriptionProps) {
  const [revealedHints, setRevealedHints] = useState(0);

  return (
    <div className="space-y-4">
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
                    onClick={() => setRevealedHints(revealedHints + 1)}
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
    </div>
  );
}
