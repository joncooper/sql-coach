"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatRevealedAt } from "@/lib/formatTime";

interface ProblemDescriptionProps {
  description: string;
  hints: string[];
  onHintReveal?: (count: number) => void;
  solution?: string | null;
  canShowSolution?: boolean;
  onShowSolution?: () => void;
  reviewDue?: boolean;
}

export function ProblemDescriptionText({
  description,
  reviewDue,
}: {
  description: string;
  reviewDue?: boolean;
}) {
  return (
    <div className="space-y-3">
      {reviewDue && (
        <div className="flex items-center gap-2 rounded-lg border border-[color:var(--warning-soft)] bg-[color:var(--warning-soft)] px-4 py-3 text-sm text-[color:var(--warning-text)]">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--review-due)]"
            aria-hidden
          />
          Due for review — solve again to strengthen mastery
        </div>
      )}
      <div className="space-y-4">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => (
              <p className="text-[15px] leading-7 text-[color:var(--text-soft)]">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc space-y-2 pl-5 text-[15px] leading-7 text-[color:var(--text-soft)]">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-7 text-[color:var(--text-soft)]">
                {children}
              </ol>
            ),
            li: ({ children }) => <li>{children}</li>,
            strong: ({ children }) => (
              <strong className="font-semibold text-[color:var(--text)]">
                {children}
              </strong>
            ),
            code: ({ children, className }) =>
              className ? (
                <code className={className}>{children}</code>
              ) : (
                <code className="rounded bg-[color:var(--accent-soft)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[13px] text-[color:var(--accent-strong)]">
                  {children}
                </code>
              ),
            pre: ({ children }) => (
              <pre className="overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--panel-muted)] p-4 font-[family-name:var(--font-mono)] text-sm text-[color:var(--text)]">
                {children}
              </pre>
            ),
          }}
        >
          {description}
        </Markdown>
      </div>
    </div>
  );
}

export default function ProblemDescription({
  description: _description,
  hints,
  onHintReveal,
  solution,
  canShowSolution,
  onShowSolution,
  reviewDue: _reviewDue,
}: ProblemDescriptionProps) {
  const [revealedHints, setRevealedHints] = useState(0);
  // Per-hint reveal timestamps. Index aligns with hints[]. Undefined = not yet revealed.
  const [revealedAt, setRevealedAt] = useState<(number | undefined)[]>(
    () => hints.map(() => undefined)
  );

  const revealHint = () => {
    const next = revealedHints + 1;
    setRevealedHints(next);
    setRevealedAt((prev) => {
      const copy = [...prev];
      copy[next - 1] = Date.now();
      return copy;
    });
    onHintReveal?.(next);
  };

  const allRevealed = revealedHints === hints.length;

  return (
    <div className="space-y-4">
      {hints.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <div className="eyebrow">
              Hints{" "}
              <span className="num ml-1 text-[color:var(--text-muted)]">
                {revealedHints}/{hints.length}
              </span>
            </div>
            {!allRevealed && (
              <button
                onClick={revealHint}
                className="btn-ghost text-[color:var(--accent)]"
              >
                Show next hint
              </button>
            )}
          </div>
          {revealedHints > 0 && (
            <ol className="mt-2 space-y-2">
              {hints.slice(0, revealedHints).map((hint, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--panel-muted)] px-3 py-2 text-sm leading-6 text-[color:var(--text-soft)]"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="eyebrow flex items-center gap-1.5 text-[color:var(--positive)]">
                      <span aria-hidden>✓</span>
                      Revealed
                    </span>
                    {revealedAt[i] !== undefined && (
                      <span className="num text-[10px] text-[color:var(--text-muted)]">
                        {formatRevealedAt(revealedAt[i]!)}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="num mr-2 text-[color:var(--text-muted)]">
                      {i + 1}.
                    </span>
                    {hint}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {canShowSolution && !solution && (
        <button
          onClick={onShowSolution}
          className="btn-ghost text-[color:var(--danger)]"
          title="Revealing the solution permanently blocks Mastered status for this problem"
        >
          Show solution
        </button>
      )}

      {solution && (
        <details open>
          <summary className="eyebrow cursor-pointer">Solution</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--panel-muted)] p-4 font-[family-name:var(--font-mono)] text-sm text-[color:var(--text)]">
            <code>{solution}</code>
          </pre>
        </details>
      )}
    </div>
  );
}
