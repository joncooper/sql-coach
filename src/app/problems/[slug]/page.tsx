"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import dynamic from "next/dynamic";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import ProblemDescription from "@/components/ProblemDescription";
import { ProblemDescriptionText } from "@/components/ProblemDescription";
import DifficultyBadge from "@/components/DifficultyBadge";
import SchemaExplorer from "@/components/SchemaExplorer";
import SampleData from "@/components/SampleData";
import ResultsTable from "@/components/ResultsTable";
import CoachingChat from "@/components/CoachingChat";
import { useLlmStatus } from "@/hooks/useLlmStatus";
import { loadStats, recordAttempt, recordHintReveal, recordSolutionViewed, isReviewDue, computeMasteryLevel, getSolvedCount } from "@/lib/stats";
import { enqueuePendingAnalysis } from "@/hooks/usePendingAnalyses";
import type { QueryResult, RowDiff, MasteryLevel } from "@/types";

function formatCategory(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const masteryLabels: Record<MasteryLevel, string> = {
  unattempted: "Unattempted",
  attempted: "Attempted",
  solved: "Solved",
  practiced: "Practiced",
  mastered: "Mastered \u2605",
};

function formatMastery(level: MasteryLevel): string {
  return masteryLabels[level];
}

const SqlEditor = dynamic(() => import("@/components/SqlEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-zinc-600">
      Loading editor...
    </div>
  ),
});

interface ProblemDetail {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  category: string;
  tags: string[];
  domain: string;
  tables: string[];
  description: string;
  hints: string[];
  starter_code?: string;
  order_matters: boolean;
  expected_columns: string[];
  schema: Record<
    string,
    { column_name: string; data_type: string; is_nullable: string }[]
  >;
  samples: Record<string, { columns: string[]; rows: unknown[][] }>;
  expectedOutput: { columns: string[]; rows: unknown[][] } | null;
  adjacent: { prev: string | null; next: string | null };
}

interface SubmitResponse {
  pass: boolean;
  message: string;
  coaching: string;
  expected: { columns: string[]; rows: unknown[][] };
  actual: { columns: string[]; rows: unknown[][] };
  diff: RowDiff[];
  executionTimeMs: number;
  error?: string;
  submissionId?: number | null;
}

export default function ProblemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAccepted, setShowAccepted] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [solution, setSolution] = useState<string | null>(null);
  const [reviewDue, setReviewDue] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);
  const { available: llmAvailable } = useLlmStatus();
  const [masteryTransition, setMasteryTransition] = useState<{ from: MasteryLevel; to: MasteryLevel } | null>(null);
  const [totalSolved, setTotalSolved] = useState(0);

  // Timer state
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerPausedRef = useRef(false);

  useEffect(() => {
    fetch(`/api/problems/${slug}`)
      .then((r) => r.json())
      .then((data: ProblemDetail) => {
        setProblem(data);
        const saved = localStorage.getItem(`sql-coach:code:${slug}`);
        // Invalidate cached code that uses old schema-qualified names
        const isStale = saved && /\b(hr|ecommerce|analytics|leetcode)\.\w/.test(saved);
        if (saved && !isStale) {
          setCode(saved);
        } else if (data.starter_code) {
          if (isStale) localStorage.removeItem(`sql-coach:code:${slug}`);
          setCode(data.starter_code);
        }
      });

    // Load attempt count and review status from stats
    const stats = loadStats();
    const ps = stats.problems[slug];
    if (ps) {
      setAttemptCount(ps.attempts);
      setReviewDue(isReviewDue(ps));
    }
  }, [slug]);

  useEffect(() => {
    if (!code) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`sql-coach:code:${slug}`, code);
    }, 500);
    return () => clearTimeout(timer);
  }, [code, slug]);

  // Start timer on first code change when enabled
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      if (timerEnabled && !timerStarted && newCode.trim()) {
        setTimerStarted(true);
      }
    },
    [timerEnabled, timerStarted]
  );

  // Timer interval
  useEffect(() => {
    if (timerStarted && timerEnabled) {
      timerRef.current = setInterval(() => {
        if (!timerPausedRef.current) {
          setElapsedMs((prev) => prev + 1000);
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerStarted, timerEnabled]);

  // Pause on visibility change
  useEffect(() => {
    const handler = () => {
      timerPausedRef.current = document.hidden;
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  const handleRun = useCallback(async () => {
    if (!code.trim() || isRunning) return;
    setIsRunning(true);
    setError(null);
    setSubmitResult(null);
    setShowAccepted(false);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: code, domain: problem?.domain, slug }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setResult(null);
      } else {
        setResult(data);
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setIsRunning(false);
    }
  }, [code, isRunning]);

  const handleSubmit = useCallback(async () => {
    if (!code.trim() || isRunning) return;
    setIsRunning(true);
    setError(null);
    setResult(null);
    setShowAccepted(false);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: code, slug }),
      });
      const data: SubmitResponse = await res.json();
      if (data.error) {
        setError(data.error);
        setSubmitResult(null);
        if (typeof data.submissionId === "number") {
          enqueuePendingAnalysis({
            id: data.submissionId,
            slug,
            startedAt: Date.now(),
          });
        }
      } else {
        setSubmitResult(data);
        if (!data.pass && typeof data.submissionId === "number") {
          enqueuePendingAnalysis({
            id: data.submissionId,
            slug,
            startedAt: Date.now(),
          });
        }
        const difficulty = problem?.difficulty ?? "easy";

        // Compute mastery before recording
        const prevStats = loadStats();
        const prevLevel = computeMasteryLevel(prevStats.problems[slug], difficulty);

        const timeArg = timerEnabled && timerStarted ? elapsedMs : undefined;
        const store = recordAttempt(slug, data.pass, timeArg);
        const newCount = store.problems[slug]?.attempts ?? 0;
        setAttemptCount(newCount);

        if (data.pass) {
          // Compute mastery after recording
          const newLevel = computeMasteryLevel(store.problems[slug], difficulty);
          if (newLevel !== prevLevel) {
            setMasteryTransition({ from: prevLevel, to: newLevel });
          } else {
            setMasteryTransition(null);
          }
          setTotalSolved(getSolvedCount(store));
          setShowAccepted(true);
          // Stop the timer on acceptance
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setIsRunning(false);
    }
  }, [code, slug, isRunning]);

  const handleResetCode = useCallback(() => {
    if (!problem) return;
    setCode(problem.starter_code ?? "");
    localStorage.removeItem(`sql-coach:code:${slug}`);
    setResult(null);
    setSubmitResult(null);
    setError(null);
    setShowAccepted(false);
  }, [problem, slug]);

  const handleHintReveal = useCallback(
    (count: number) => {
      recordHintReveal(slug, count);
    },
    [slug]
  );

  const handleShowSolution = useCallback(async () => {
    const ok = window.confirm(
      "Viewing the solution means this problem can never reach Mastered status. Continue?"
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/problems/${slug}/solution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (data.solution) {
        setSolution(data.solution);
        recordSolutionViewed(slug);
      }
    } catch {
      // silently fail
    }
  }, [slug]);

  if (!problem) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500">
        Loading...
      </div>
    );
  }

  const editorSchema: Record<string, string[]> = {};
  if (problem.schema) {
    for (const [table, cols] of Object.entries(problem.schema)) {
      editorSchema[table] = cols.map((c) => c.column_name);
    }
  }

  const hasSubmit = submitResult !== null;
  const isWrong = hasSubmit && !submitResult.pass;
  const isAccepted = hasSubmit && submitResult.pass;

  // Show solution button after 3 failed attempts (and no solution already shown)
  const failedAttempts = attemptCount - (isAccepted ? 1 : 0);
  const canShowSolution = !solution && failedAttempts >= 3;

  return (
    <PanelGroup orientation="horizontal" className="h-full overflow-hidden">
      {/* Left: Problem description + schema */}
      <Panel defaultSize={35} minSize={20}>
        <div className="flex h-full flex-col">
          {/* Pinned header: title + description */}
          <div className="max-h-[60%] shrink-0 overflow-y-auto border-b border-zinc-800" style={{ scrollbarWidth: "thin" }}>
            <div className="px-4 pt-4 pb-3">
              <div className="mb-2 flex items-center justify-between">
                <a
                  href="/"
                  className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  &larr; Problems
                </a>
                <div className="flex items-center gap-2">
                  {problem.adjacent.prev && (
                    <a
                      href={`/problems/${problem.adjacent.prev}`}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                      title="Previous problem"
                    >
                      &larr; Prev
                    </a>
                  )}
                  {problem.adjacent.next && (
                    <a
                      href={`/problems/${problem.adjacent.next}`}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                      title="Next problem"
                    >
                      Next &rarr;
                    </a>
                  )}
                </div>
              </div>
              <h1 className="text-lg font-bold text-zinc-100">{problem.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DifficultyBadge difficulty={problem.difficulty} />
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                  {formatCategory(problem.category)}
                </span>
              </div>
              <div className="mt-3">
                <ProblemDescriptionText
                  description={problem.description}
                  reviewDue={reviewDue}
                />
              </div>
            </div>
          </div>
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto border-t border-zinc-800 px-4 py-4">
            <ProblemDescription
              description={problem.description}
              hints={problem.hints}
              onHintReveal={handleHintReveal}
              solution={solution}
              canShowSolution={canShowSolution}
              onShowSolution={handleShowSolution}
            />
            <div className="mt-4 border-t border-zinc-800 pt-4">
              <SchemaExplorer schema={problem.schema} />
            </div>
            {problem.samples && (
              <div className="mt-4 border-t border-zinc-800 pt-4">
                <SampleData samples={problem.samples} />
              </div>
            )}
            {problem.expectedOutput && problem.expectedOutput.rows.length > 0 && (
              <div className="mt-4 border-t border-zinc-800 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Expected Output
                </h3>
                <div className="mt-2 overflow-x-auto rounded border border-zinc-800">
                  <table className="w-full border-collapse font-mono text-[11px]">
                    <thead>
                      <tr className="bg-zinc-900">
                        {problem.expectedOutput.columns.map((col) => (
                          <th
                            key={col}
                            className="border-b border-zinc-800 px-2 py-1 text-left font-semibold text-zinc-500"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {problem.expectedOutput.rows.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-zinc-800/50 last:border-0"
                        >
                          {row.map((cell, j) => (
                            <td
                              key={j}
                              className={`whitespace-nowrap px-2 py-0.5 ${
                                cell === null
                                  ? "italic text-zinc-600"
                                  : "text-zinc-400"
                              }`}
                            >
                              {cell === null || cell === undefined
                                ? "NULL"
                                : String(cell).length > 30
                                  ? String(cell).slice(0, 27) + "..."
                                  : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <PanelResizeHandle className="w-1.5 bg-zinc-800 transition-colors hover:bg-blue-500" />

      {/* Right: Editor + Results */}
      <Panel defaultSize={65} minSize={30}>
        <PanelGroup orientation="vertical" className="h-full">
          {/* Editor */}
          <Panel defaultSize={50} minSize={20}>
            <div className="relative flex h-full flex-col">
              {/* Accepted celebration overlay — persistent until dismissed */}
              {showAccepted && (
                <div
                  className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-emerald-950/80 backdrop-blur-sm"
                  onClick={() => setShowAccepted(false)}
                >
                  <div className="text-center">
                    <div className="text-6xl font-black tracking-tight text-emerald-400">
                      Accepted
                    </div>
                    <div className="mt-2 text-lg text-emerald-500/80">
                      Runtime: {submitResult?.executionTimeMs}ms
                      {timerEnabled && timerStarted && (
                        <span className="ml-3">
                          Time: {String(Math.floor(elapsedMs / 60000)).padStart(2, "0")}:
                          {String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, "0")}
                        </span>
                      )}
                    </div>
                    {attemptCount > 1 && (
                      <div className="mt-1 text-sm text-emerald-600">
                        Solved in {attemptCount} attempt{attemptCount !== 1 ? "s" : ""}
                      </div>
                    )}
                    {masteryTransition && (
                      <div className="mt-1 text-sm text-emerald-500">
                        {masteryTransition.from === "unattempted" || masteryTransition.from === "attempted"
                          ? null
                          : <>{formatMastery(masteryTransition.from)} &rarr; </>}
                        {formatMastery(masteryTransition.to)}
                      </div>
                    )}
                    {totalSolved > 0 && (
                      <div className="mt-1 text-xs text-emerald-700">
                        {totalSolved}/100 problems solved
                      </div>
                    )}
                    <div className="mt-4 flex items-center justify-center gap-3">
                      {problem.adjacent.next && (
                        <a
                          href={`/problems/${problem.adjacent.next}`}
                          className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
                        >
                          Next Problem &rarr;
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAccepted(false);
                        }}
                        className="rounded-md bg-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-600"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <SqlEditor
                  value={code}
                  onChange={handleCodeChange}
                  onRun={handleRun}
                  onSubmit={handleSubmit}
                  schema={editorSchema}
                />
              </div>
              {/* Button bar */}
              <div className="flex items-center gap-2 border-t border-zinc-800 px-3 py-2">
                <button
                  onClick={handleRun}
                  disabled={isRunning}
                  className="rounded-md bg-zinc-800 px-4 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
                >
                  {isRunning ? "Running..." : "Run"}
                  <span className="ml-2 text-xs text-zinc-500">{"\u2318\u23CE"}</span>
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isRunning}
                  className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                >
                  Submit
                  <span className="ml-2 text-xs text-emerald-300">{"\u2318\u21E7\u23CE"}</span>
                </button>
                <button
                  onClick={() => {
                    setTimerEnabled((v) => !v);
                    if (!timerEnabled) {
                      setElapsedMs(0);
                      setTimerStarted(false);
                    }
                  }}
                  className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                    timerEnabled
                      ? "bg-zinc-700 text-zinc-200"
                      : "text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400"
                  }`}
                  title={timerEnabled ? "Disable timer" : "Enable timer"}
                >
                  &#9201;
                  {timerEnabled && (
                    <span className="ml-1 font-mono">
                      {String(Math.floor(elapsedMs / 60000)).padStart(2, "0")}:
                      {String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, "0")}
                    </span>
                  )}
                </button>
                <button
                  onClick={handleResetCode}
                  className="ml-auto rounded-md px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
                  title="Reset to starter code"
                >
                  Reset
                </button>
                {attemptCount > 0 && (
                  <span className="text-xs text-zinc-600">
                    Attempt {attemptCount}
                  </span>
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="h-1.5 bg-zinc-800 transition-colors hover:bg-blue-500" />

          {/* Results */}
          <Panel defaultSize={50} minSize={15}>
            <div className="flex h-full flex-col">
              {/* Verdict header — shown after submit */}
              {hasSubmit && (
                <div className="shrink-0 border-b border-zinc-800 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    {isAccepted ? (
                      <span className="text-lg font-bold text-emerald-500">Accepted</span>
                    ) : (
                      <span className="text-lg font-bold text-red-500">Wrong Answer</span>
                    )}
                    <span className="text-sm text-zinc-500">
                      Runtime: {submitResult.executionTimeMs}ms
                    </span>
                    {isWrong && (
                      <span className="text-sm text-zinc-600">
                        &middot; {submitResult.diff.length} row difference{submitResult.diff.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {/* Coaching message */}
                  {isWrong && submitResult.coaching && (
                    <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-300">
                      {submitResult.coaching}
                    </div>
                  )}
                </div>
              )}

              {/* AI Coaching Chat */}
              {isWrong && llmAvailable && (
                <div className="shrink-0 border-b border-zinc-800">
                  {!coachOpen ? (
                    <button
                      onClick={() => setCoachOpen(true)}
                      className="w-full px-4 py-2 text-left text-sm text-blue-400 hover:bg-zinc-900/50"
                    >
                      Ask AI Coach for help&hellip;
                    </button>
                  ) : (
                    <CoachingChat
                      problemContext={{
                        description: problem.description,
                        tables: problem.tables,
                        studentSql: code,
                        errorContext: submitResult.coaching,
                        attemptNumber: attemptCount,
                      }}
                      isOpen={coachOpen}
                      onToggle={() => setCoachOpen(false)}
                    />
                  )}
                </div>
              )}

              {/* Result content */}
              <div className="flex-1 overflow-hidden">
                {isWrong ? (
                  // Side-by-side: Expected | Your Output
                  <div className="flex h-full">
                    <div className="flex flex-1 flex-col border-r border-zinc-800">
                      <div className="shrink-0 bg-zinc-900/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        Expected Output
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <ResultsTable
                          columns={submitResult.expected.columns}
                          rows={submitResult.expected.rows}
                          rowCount={submitResult.expected.rows.length}
                          diff={submitResult.diff}
                          mode="expected"
                        />
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col">
                      <div className="shrink-0 bg-zinc-900/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        Your Output
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <ResultsTable
                          columns={submitResult.actual.columns}
                          rows={submitResult.actual.rows}
                          rowCount={submitResult.actual.rows.length}
                          diff={submitResult.diff}
                          mode="submit"
                        />
                      </div>
                    </div>
                  </div>
                ) : isAccepted ? (
                  // Accepted: show the matching output
                  <ResultsTable
                    columns={submitResult.actual.columns}
                    rows={submitResult.actual.rows}
                    executionTimeMs={submitResult.executionTimeMs}
                    rowCount={submitResult.actual.rows.length}
                    mode="run"
                  />
                ) : (
                  // Plain run output
                  <ResultsTable
                    columns={result?.columns ?? []}
                    rows={result?.rows ?? []}
                    executionTimeMs={result?.executionTimeMs}
                    rowCount={result?.rowCount}
                    mode="run"
                    error={error ?? undefined}
                  />
                )}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}
