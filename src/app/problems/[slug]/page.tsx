"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import ProblemDescription, {
  ProblemDescriptionText,
} from "@/components/ProblemDescription";
import DifficultyBadge from "@/components/DifficultyBadge";
import SchemaExplorer from "@/components/SchemaExplorer";
import SampleData from "@/components/SampleData";
import ResultsTable from "@/components/ResultsTable";
import CoachingChat from "@/components/CoachingChat";
import { useLlmStatus } from "@/hooks/useLlmStatus";
import {
  loadStats,
  recordAttempt,
  recordHintReveal,
  recordSolutionViewed,
  isReviewDue,
  computeMasteryLevel,
  getSolvedCount,
} from "@/lib/stats";
import {
  clearSavedCode,
  loadInitialCode,
  saveCode,
} from "@/lib/problemCode";
import { enqueuePendingAnalysis } from "@/hooks/usePendingAnalyses";
import type { MasteryLevel, QueryResult, RowDiff } from "@/types";

function formatCategory(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatElapsed(ms: number) {
  return `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(
    Math.floor((ms % 60000) / 1000)
  ).padStart(2, "0")}`;
}

const masteryLabels: Record<MasteryLevel, string> = {
  unattempted: "Unattempted",
  attempted: "Attempted",
  solved: "Solved",
  practiced: "Practiced",
  mastered: "Mastered ★",
};

function formatMastery(level: MasteryLevel): string {
  return masteryLabels[level];
}

const SqlEditor = dynamic(() => import("@/components/SqlEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-[color:var(--text-muted)]">
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
  expected: { columns: string[]; columnTypes: string[]; rows: unknown[][] };
  actual: { columns: string[]; columnTypes: string[]; rows: unknown[][] };
  diff: RowDiff[];
  executionTimeMs: number;
  error?: string;
  submissionId?: number | null;
}

function formatRow(row: unknown[]): string {
  return row
    .map((cell) => {
      if (cell === null || cell === undefined) return "NULL";
      if (cell instanceof Date) return cell.toISOString();
      return String(cell);
    })
    .join(" | ");
}

function describeColumns(columns: string[], types: string[]): string {
  return columns.map((c, i) => `${c} (${types[i] ?? "?"})`).join(", ");
}

function buildCoachErrorContext(r: SubmitResponse): string {
  const lines: string[] = [];
  lines.push(r.coaching || r.message || "Query did not match expected output.");
  lines.push("");
  lines.push(
    `EXPECTED COLUMNS: ${describeColumns(r.expected.columns, r.expected.columnTypes)}`
  );
  lines.push(
    `STUDENT COLUMNS: ${describeColumns(r.actual.columns, r.actual.columnTypes)}`
  );

  const missing = r.diff.filter((d) => d.type === "missing").map((d) => d.row);
  const extra = r.diff.filter((d) => d.type === "extra").map((d) => d.row);

  if (missing.length === 0 && extra.length === 0) {
    // No row-level diff (e.g. column shape mismatch). Show a small sample
    // of each result so the coach can still compare.
    const sampleExpected = r.expected.rows.slice(0, 5);
    const sampleActual = r.actual.rows.slice(0, 5);
    if (sampleExpected.length) {
      lines.push("");
      lines.push("EXPECTED SAMPLE:");
      for (const row of sampleExpected) lines.push(`  ${formatRow(row)}`);
    }
    if (sampleActual.length) {
      lines.push("");
      lines.push("STUDENT SAMPLE:");
      for (const row of sampleActual) lines.push(`  ${formatRow(row)}`);
    }
    return lines.join("\n");
  }

  lines.push("");
  lines.push(
    `DIFF: ${missing.length} missing row${missing.length === 1 ? "" : "s"}, ${extra.length} extra row${extra.length === 1 ? "" : "s"}`
  );
  if (missing.length) {
    lines.push("");
    lines.push("MISSING (in expected, not in student output):");
    for (const row of missing) lines.push(`  ${formatRow(row)}`);
  }
  if (extra.length) {
    lines.push("");
    lines.push("EXTRA (in student output, not expected):");
    for (const row of extra) lines.push(`  ${formatRow(row)}`);
  }
  return lines.join("\n");
}

export default function ProblemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
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
  const [masteryTransition, setMasteryTransition] = useState<{
    from: MasteryLevel;
    to: MasteryLevel;
  } | null>(null);
  const [totalSolved, setTotalSolved] = useState(0);

  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerPausedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const stats = loadStats();
    const problemStats = stats.problems[slug];
    if (problemStats) {
      setAttemptCount(problemStats.attempts);
      setReviewDue(isReviewDue(problemStats));
    }
    // Only restore previously-saved code for problems the user
    // has already solved. Unsolved problems always open blank —
    // and any stale localStorage entry is cleared as a side
    // effect of loadInitialCode.
    setCode(loadInitialCode(slug, problemStats, localStorage));

    fetch(`/api/problems/${slug}`)
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setNotFound(true);
          return;
        }
        const data: ProblemDetail = await response.json();
        setProblem(data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!code) return;
    const timer = setTimeout(() => {
      saveCode(slug, code, localStorage);
    }, 500);
    return () => clearTimeout(timer);
  }, [code, slug]);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      if (timerEnabled && !timerStarted && newCode.trim()) {
        setTimerStarted(true);
      }
    },
    [timerEnabled, timerStarted]
  );

  useEffect(() => {
    if (timerStarted && timerEnabled) {
      timerRef.current = setInterval(() => {
        if (!timerPausedRef.current) {
          setElapsedMs((previous) => previous + 1000);
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerStarted, timerEnabled]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      timerPausedRef.current = document.hidden;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const handleRun = useCallback(async () => {
    if (!code.trim() || isRunning) return;
    setIsRunning(true);
    setError(null);
    setSubmitResult(null);
    setShowAccepted(false);
    setCoachOpen(false);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: code, domain: problem?.domain, slug }),
      });
      const data = await response.json();
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
  }, [code, isRunning, problem?.domain, slug]);

  const handleSubmit = useCallback(async () => {
    if (!code.trim() || isRunning) return;
    setIsRunning(true);
    setError(null);
    setResult(null);
    setShowAccepted(false);

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: code, slug }),
      });
      const data: SubmitResponse = await response.json();

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
        const previousStats = loadStats();
        const previousLevel = computeMasteryLevel(
          previousStats.problems[slug],
          difficulty
        );

        const timeArg = timerEnabled && timerStarted ? elapsedMs : undefined;
        const store = recordAttempt(slug, data.pass, timeArg);
        const newCount = store.problems[slug]?.attempts ?? 0;
        setAttemptCount(newCount);
        setReviewDue(isReviewDue(store.problems[slug]));

        if (data.pass) {
          const newLevel = computeMasteryLevel(store.problems[slug], difficulty);
          setMasteryTransition(
            newLevel !== previousLevel
              ? { from: previousLevel, to: newLevel }
              : null
          );
          setTotalSolved(getSolvedCount(store));
          setShowAccepted(true);
          setCoachOpen(false);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setIsRunning(false);
    }
  }, [
    code,
    elapsedMs,
    isRunning,
    problem?.difficulty,
    slug,
    timerEnabled,
    timerStarted,
  ]);

  const handleResetCode = useCallback(() => {
    if (!problem) return;
    setCode("");
    clearSavedCode(slug, localStorage);
    setResult(null);
    setSubmitResult(null);
    setError(null);
    setShowAccepted(false);
    setCoachOpen(false);
    setElapsedMs(0);
    setTimerStarted(false);
    if (timerRef.current) clearInterval(timerRef.current);
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
      const response = await fetch(`/api/problems/${slug}/solution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await response.json();
      if (data.solution) {
        setSolution(data.solution);
        recordSolutionViewed(slug);
      }
    } catch {
      // silent
    }
  }, [slug]);

  if (notFound) {
    return (
      <div className="mx-auto flex h-full max-w-[640px] flex-col items-center justify-center px-6 text-center">
        <div className="eyebrow">404</div>
        <h1 className="mt-3 text-2xl font-semibold text-[color:var(--text)]">
          Problem not found
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
          No problem with the slug{" "}
          <code className="rounded bg-[color:var(--panel-muted)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-xs">
            {slug}
          </code>{" "}
          exists. It may have been renamed or removed.
        </p>
        <a href="/?mode=catalog" className="btn-primary mt-6">
          Browse all problems
        </a>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="flex h-full items-center justify-center text-[color:var(--text-muted)]">
        Loading...
      </div>
    );
  }

  const editorSchema: Record<string, string[]> = {};
  for (const [table, columns] of Object.entries(problem.schema ?? {})) {
    editorSchema[table] = columns.map((column) => column.column_name);
  }

  const hasSubmit = submitResult !== null;
  const isWrong = hasSubmit && !submitResult.pass;
  const isAccepted = hasSubmit && submitResult.pass;
  const failedAttempts = attemptCount - (isAccepted ? 1 : 0);
  const canShowSolution = !solution && failedAttempts >= 3;
  const coachErrorContext = hasSubmit
    ? buildCoachErrorContext(submitResult)
    : "";
  return (
    <PanelGroup orientation="horizontal" className="h-full overflow-hidden">
      <Panel defaultSize={34} minSize={24}>
        <div className="flex h-full flex-col bg-[color:var(--bg)]">
          <div className="border-b border-[color:var(--border)] px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <a
                href="/"
                className="soft-link text-xs font-semibold uppercase tracking-[0.16em]"
              >
                ← Problems
              </a>
              <div className="flex items-center gap-2">
                {problem.adjacent.prev && (
                  <a
                    href={`/problems/${problem.adjacent.prev}`}
                    className="border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--text-soft)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]"
                  >
                    Prev
                  </a>
                )}
                {problem.adjacent.next && (
                  <a
                    href={`/problems/${problem.adjacent.next}`}
                    className="border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--text-soft)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]"
                  >
                    Next
                  </a>
                )}
              </div>
            </div>

            <div className="mt-5">
              <p className="eyebrow">{formatCategory(problem.category)}</p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight text-[color:var(--text)]">
                {problem.title}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <DifficultyBadge difficulty={problem.difficulty} />
                {reviewDue && <InfoPill label="Review due" tone="warning" />}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-6 pb-6">
              <ProblemDescriptionText
                description={problem.description}
                reviewDue={reviewDue}
              />

              <SchemaExplorer schema={problem.schema} />

              {problem.samples &&
                Object.keys(problem.samples).length > 0 && (
                  <SampleData samples={problem.samples} />
                )}

              {problem.expectedOutput &&
                problem.expectedOutput.rows.length > 0 && (
                  <div>
                    <div className="eyebrow mb-2">Expected output</div>
                    <div className="app-panel overflow-hidden">
                      <div className="max-h-64 overflow-auto">
                        <ResultsTable
                          columns={problem.expectedOutput.columns}
                          rows={problem.expectedOutput.rows}
                          rowCount={problem.expectedOutput.rows.length}
                          mode="expected"
                        />
                      </div>
                    </div>
                  </div>
                )}

              <ProblemDescription
                description={problem.description}
                hints={problem.hints}
                onHintReveal={handleHintReveal}
                solution={solution}
                canShowSolution={canShowSolution}
                onShowSolution={handleShowSolution}
              />
            </div>
          </div>
        </div>
      </Panel>

      <PanelResizeHandle className="w-2 bg-[color:var(--border)] transition-colors hover:bg-[color:var(--accent-soft)]" />

      <Panel defaultSize={66} minSize={34}>
        <PanelGroup orientation="vertical" className="h-full">
          <Panel defaultSize={56} minSize={24}>
            <div className="relative flex h-full flex-col bg-[color:var(--bg)]">
              {showAccepted && submitResult && (
                <div
                  className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-black/10"
                  onClick={() => setShowAccepted(false)}
                >
                  <div
                    className="app-panel-strong animate-in max-w-lg border border-[color:var(--border-strong)] px-8 py-7 text-center"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className="eyebrow">Accepted</p>
                    <div className="mt-3 text-2xl font-semibold leading-none text-[color:var(--positive)]">
                      Clean pass.
                    </div>
                    <div className="mt-4 text-sm leading-6 text-[color:var(--text-soft)]">
                      Runtime {submitResult.executionTimeMs}ms
                      {timerEnabled && timerStarted && (
                        <span className="ml-3">
                          Time {formatElapsed(elapsedMs)}
                        </span>
                      )}
                    </div>
                    {attemptCount > 1 && (
                      <div className="mt-2 text-sm text-[color:var(--text-muted)]">
                        Solved in {attemptCount} attempts
                      </div>
                    )}
                    {masteryTransition && (
                      <div className="mt-2 text-sm text-[color:var(--accent-strong)]">
                        {masteryTransition.from === "unattempted" ||
                        masteryTransition.from === "attempted"
                          ? null
                          : `${formatMastery(masteryTransition.from)} → `}
                        {formatMastery(masteryTransition.to)}
                      </div>
                    )}
                    {totalSolved > 0 && (
                      <div className="mt-2 text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                        {totalSolved} total solved
                      </div>
                    )}
                    <div className="mt-6 flex items-center justify-center gap-3">
                      {problem.adjacent.next && (
                        <a
                          href={`/problems/${problem.adjacent.next}`}
                          className="border border-[color:var(--positive)] bg-[color:var(--positive)] px-4 py-2 text-sm font-semibold text-white hover:brightness-105"
                        >
                          Next problem
                        </a>
                      )}
                      <button
                        onClick={() => setShowAccepted(false)}
                        className="border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--text-soft)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]"
                      >
                        Keep editing
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

              <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--border)] bg-[color:var(--panel-muted)] px-4 py-3">
                <button
                  onClick={handleRun}
                  disabled={isRunning}
                  className="border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--panel-muted)] disabled:opacity-50"
                >
                  {isRunning ? "Running..." : "Run query"}
                  <span className="ml-2 text-xs text-[color:var(--text-muted)]">
                    ⌘↵
                  </span>
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isRunning}
                  className="border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--accent-strong)] disabled:opacity-50"
                >
                  Check answer
                  <span className="ml-2 text-xs text-white/70">
                    ⌘⇧↵
                  </span>
                </button>
                <button
                  onClick={() => {
                    setTimerEnabled((current) => {
                      const next = !current;
                      if (next) {
                        setElapsedMs(0);
                        setTimerStarted(false);
                      }
                      return next;
                    });
                  }}
                  className={`border px-3 py-2 text-sm font-medium ${
                    timerEnabled
                      ? "border-[color:var(--warning-soft)] bg-[color:var(--warning-soft)] text-[color:var(--highlight)]"
                      : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:bg-[color:var(--panel-muted)] hover:text-[color:var(--text)]"
                  }`}
                  title={timerEnabled ? "Disable timer" : "Enable timer"}
                >
                  Timer
                  {timerEnabled && (
                    <span className="ml-2 font-[family-name:var(--font-mono)]">
                      {formatElapsed(elapsedMs)}
                    </span>
                  )}
                </button>
                {llmAvailable && (
                  <button
                    onClick={() => setCoachOpen((open) => !open)}
                    className={`ml-auto border px-4 py-2 text-sm font-medium ${
                      coachOpen
                        ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-soft)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]"
                    }`}
                    title="Ask the AI coach for a hint based on what you've written. Never gives the full answer."
                  >
                    <span className="mr-1">✱</span>
                    Ask AI
                  </button>
                )}
                <button
                  onClick={handleResetCode}
                  className={`${llmAvailable ? "" : "ml-auto "}border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--text-soft)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text)]`}
                  title="Clear the editor"
                >
                  Reset
                </button>
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="h-2 bg-[color:var(--border)] transition-colors hover:bg-[color:var(--accent-soft)]" />

          <Panel defaultSize={44} minSize={18}>
            <div className="flex h-full flex-col bg-[color:var(--bg)]">
              <div className="shrink-0 border-b border-[color:var(--border)] px-5 py-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="eyebrow">Results</p>
                    <h2 className="mt-1 text-lg font-semibold text-[color:var(--text)]">
                      {isAccepted
                        ? "Accepted output"
                        : isWrong
                          ? "Compare the diff"
                          : "Run output"}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasSubmit && (
                      <InfoPill
                        label={isAccepted ? "Accepted" : "Wrong answer"}
                        tone={isAccepted ? "success" : "default"}
                      />
                    )}
                    {((submitResult && submitResult.executionTimeMs) ||
                      result?.executionTimeMs) != null && (
                      <InfoPill
                        label={`${submitResult?.executionTimeMs ?? result?.executionTimeMs}ms`}
                      />
                    )}
                  </div>
                </div>

                {isWrong ? (
                  submitResult.coaching ? (
                    <div className="mt-4 border border-[color:var(--warning-soft)] bg-[color:var(--warning-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--warning)]">
                      {submitResult.coaching}
                    </div>
                  ) : null
                ) : !result && !hasSubmit ? (
                  <p className="mt-4 text-sm leading-6 text-[color:var(--text-soft)]">
                    Use Run query for quick inspection or Check answer when you
                    want to validate against the reference solution.
                  </p>
                ) : null}
              </div>

              {coachOpen && llmAvailable && (
                <div className="shrink-0 border-b border-[color:var(--border)]">
                  <CoachingChat
                    problemContext={{
                      description: problem.description,
                      tables: problem.tables,
                      studentSql: code,
                      errorContext: coachErrorContext,
                      attemptNumber: Math.max(1, attemptCount),
                    }}
                    isOpen={coachOpen}
                    onToggle={() => setCoachOpen(false)}
                  />
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-hidden">
                {isWrong ? (
                  <div className="grid h-full grid-cols-2 grid-rows-1">
                    <ResultPanel label="Expected output">
                      <ResultsTable
                        columns={submitResult.expected.columns}
                        rows={submitResult.expected.rows}
                        rowCount={submitResult.expected.rows.length}
                        diff={submitResult.diff}
                        mode="expected"
                      />
                    </ResultPanel>
                    <ResultPanel label="Your output" borderLeft>
                      <ResultsTable
                        columns={submitResult.actual.columns}
                        rows={submitResult.actual.rows}
                        rowCount={submitResult.actual.rows.length}
                        diff={submitResult.diff}
                        mode="submit"
                      />
                    </ResultPanel>
                  </div>
                ) : isAccepted ? (
                  <ResultsTable
                    columns={submitResult.actual.columns}
                    rows={submitResult.actual.rows}
                    executionTimeMs={submitResult.executionTimeMs}
                    rowCount={submitResult.actual.rows.length}
                    mode="run"
                  />
                ) : (
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

function InfoPill({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const toneClass = {
    default:
      "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--text-soft)]",
    warning:
      "border-[color:var(--warning-soft)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]",
    danger:
      "border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] text-[color:var(--danger)]",
    success:
      "border-[color:var(--positive-soft)] bg-[color:var(--positive-soft)] text-[color:var(--positive)]",
  } as const;

  return (
    <span
      className={`border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${toneClass[tone]}`}
    >
      {label}
    </span>
  );
}

function ResultPanel({
  label,
  borderLeft = false,
  children,
}: {
  label: string;
  borderLeft?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col ${
        borderLeft ? "border-l border-[color:var(--border)]" : ""
      }`}
    >
      <div className="border-b border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
        {label}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

