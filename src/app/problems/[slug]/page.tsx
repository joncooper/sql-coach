"use client";

import { use, useCallback, useEffect, useState } from "react";
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
import AcceptedModal from "@/components/workspace/AcceptedModal";
import SolutionConfirmModal from "@/components/workspace/SolutionConfirmModal";
import TimerToolbar from "@/components/workspace/TimerToolbar";
import { useLlmStatus } from "@/hooks/useLlmStatus";
import { useProblemTimer } from "@/hooks/useProblemTimer";
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
import { loadCatalogContext } from "@/lib/catalog-context";
import {
  buildLevelMap,
  computeNext,
  type NextResult,
} from "@/lib/problem-navigation";
import type { MasteryLevel, ProblemSummary, QueryResult, RowDiff } from "@/types";

import { formatElapsed } from "@/lib/formatTime";

function formatCategory(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
  position?: string;
  submissionId?: number | null;
}

function annotateError(sql: string, message: string, position?: string): string {
  if (!position) return message;
  const pos = parseInt(position, 10);
  if (isNaN(pos) || pos < 1) return message;
  const before = sql.slice(0, pos - 1);
  const line = (before.match(/\n/g) || []).length + 1;
  const lastNewline = before.lastIndexOf("\n");
  const col = pos - (lastNewline + 1);
  return `${message}\n\n→ Line ${line}, column ${col}`;
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
  const [loadError, setLoadError] = useState<string | null>(null);
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

  // "Next" navigation. If the user came from the catalog screen with an
  // active filter (sessionStorage context), compute the next problem inside
  // that filter rather than using the server's skill-tree adjacency. When
  // the filter is exhausted and a section was highlighted, the result's
  // nextSectionSlug offers "continue to next section" in the AcceptedModal.
  const [nextResult, setNextResult] = useState<NextResult | null>(null);

  // Timer state is encapsulated in a hook so the page component doesn't
  // own the interval ref, pause handler, or confirm flag. See useProblemTimer.
  const timer = useProblemTimer();

  // Solution reveal confirmation modal — replaces window.confirm which
  // broke the Linear × Notion × Raycast register.
  const [showSolutionConfirm, setShowSolutionConfirm] = useState(false);

  // Inline celebration banner for subsequent-pass submissions (the full
  // Accepted modal only fires on first solve). Auto-clears after 3s.
  const [showInlineCelebration, setShowInlineCelebration] = useState(false);

  // Pending coach analysis surface. Tracks the submission id so we can
  // show "Coach analyzing…" in the results panel until the user opens
  // the coach chat or starts a new submission.
  const [pendingAnalysis, setPendingAnalysis] = useState<{
    id: number;
    startedAt: number;
  } | null>(null);

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
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (!response.ok) {
          setLoadError(
            `Couldn't load this problem (HTTP ${response.status}). The database may be down — try \`docker start sql-coach-db\`.`
          );
          return;
        }
        const data: ProblemDetail = await response.json();
        setProblem(data);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            "Couldn't reach the server. Check that the dev server and database are running."
          );
        }
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

  // Compute what "Next problem" should navigate to. Cheap in the common
  // coach-origin case (no sessionStorage context → use server's adjacent
  // slug). Fetches the full catalog only when catalog filters are active.
  useEffect(() => {
    if (!problem) return;
    let cancelled = false;
    const ctx = loadCatalogContext();
    if (!ctx) {
      setNextResult({
        kind: problem.adjacent.next ? "next" : "end-of-catalog",
        slug: problem.adjacent.next,
      });
      return;
    }
    fetch("/api/problems")
      .then((r) => (r.ok ? (r.json() as Promise<ProblemSummary[]>) : []))
      .then((list) => {
        if (cancelled) return;
        const store = loadStats();
        const levelMap =
          ctx.sortKey === "status" ? buildLevelMap(list, store) : undefined;
        setNextResult(computeNext(slug, list, ctx, levelMap));
      })
      .catch(() => {
        if (cancelled) return;
        // Network hiccup: fall back to server's skill-tree adjacency.
        setNextResult({
          kind: problem.adjacent.next ? "next" : "end-of-catalog",
          slug: problem.adjacent.next,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [problem, slug]);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      if (newCode.trim()) {
        // Safe to call repeatedly; the hook guards on enabled + not-started.
        timer.beginTicking();
      }
    },
    [timer]
  );

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
        setError(annotateError(code, data.error, data.position));
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
        setError(annotateError(code, data.error, data.position));
        setSubmitResult(null);
        if (typeof data.submissionId === "number") {
          enqueuePendingAnalysis({
            id: data.submissionId,
            slug,
            startedAt: Date.now(),
          });
          setPendingAnalysis({ id: data.submissionId, startedAt: Date.now() });
        }
      } else {
        setSubmitResult(data);
        if (!data.pass && typeof data.submissionId === "number") {
          enqueuePendingAnalysis({
            id: data.submissionId,
            slug,
            startedAt: Date.now(),
          });
          setPendingAnalysis({ id: data.submissionId, startedAt: Date.now() });
        }

        const difficulty = problem?.difficulty ?? "easy";
        const previousStats = loadStats();
        const previousLevel = computeMasteryLevel(
          previousStats.problems[slug],
          difficulty
        );

        // First-pass = user has never solved this problem before. Everything
        // else (practiced, mastered, or a re-solve) is a subsequent pass and
        // gets the quieter inline banner instead of the full modal.
        const isFirstPass =
          previousLevel === "unattempted" || previousLevel === "attempted";

        const timeArg =
          timer.enabled && timer.started ? timer.elapsedMs : undefined;
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
          setCoachOpen(false);
          // Stop ticking without clearing elapsed — the modal needs to show it.
          timer.stopTicking();
          setPendingAnalysis(null);

          if (isFirstPass) {
            setShowAccepted(true);
          } else {
            setShowInlineCelebration(true);
          }
        }
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setIsRunning(false);
    }
  }, [code, isRunning, problem?.difficulty, slug, timer]);

  const handleResetCode = useCallback(() => {
    if (!problem) return;
    setCode("");
    clearSavedCode(slug, localStorage);
    setResult(null);
    setSubmitResult(null);
    setError(null);
    setShowAccepted(false);
    setCoachOpen(false);
    // Clear elapsed + stop ticking, but preserve enabled (armed) state.
    timer.reset();
  }, [problem, slug, timer]);

  const handleHintReveal = useCallback(
    (count: number) => {
      recordHintReveal(slug, count);
    },
    [slug]
  );

  // Opening the solution reveal just toggles the branded modal. The
  // actual fetch lives in confirmShowSolution so the modal stays in
  // control of consent. Focus management + Escape live inside the modal.
  const handleShowSolution = useCallback(() => {
    setShowSolutionConfirm(true);
  }, []);

  const confirmShowSolution = useCallback(async () => {
    setShowSolutionConfirm(false);
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
      // Silent — solution reveal failing is a rare edge case; the
      // solution remains hidden and the user can retry.
    }
  }, [slug]);

  // Auto-clear the inline celebration banner after 3s. Cleanup cancels
  // the timeout if the component unmounts or the state flips early,
  // preventing "setState on unmounted component" warnings.
  useEffect(() => {
    if (!showInlineCelebration) return;
    const id = window.setTimeout(() => setShowInlineCelebration(false), 3000);
    return () => window.clearTimeout(id);
  }, [showInlineCelebration]);

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

  if (loadError) {
    return (
      <div className="mx-auto flex h-full max-w-[640px] flex-col items-center justify-center px-6 text-center">
        <div className="eyebrow">Error</div>
        <h1 className="mt-3 text-2xl font-semibold text-[color:var(--text)]">
          Couldn&apos;t load this problem
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
          {loadError}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary mt-6"
        >
          Retry
        </button>
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
                <AcceptedModal
                  executionTimeMs={submitResult.executionTimeMs}
                  elapsedLabel={
                    timer.enabled && timer.started
                      ? formatElapsed(timer.elapsedMs)
                      : null
                  }
                  attemptCount={attemptCount}
                  masteryTransition={masteryTransition}
                  totalSolved={totalSolved}
                  nextResult={
                    nextResult ?? {
                      kind: problem.adjacent.next ? "next" : "end-of-catalog",
                      slug: problem.adjacent.next,
                    }
                  }
                  onClose={() => setShowAccepted(false)}
                />
              )}

              {showSolutionConfirm && (
                <SolutionConfirmModal
                  onConfirm={confirmShowSolution}
                  onClose={() => setShowSolutionConfirm(false)}
                />
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
                <TimerToolbar timer={timer} />
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
              {/* Inline celebration banner — subsequent-pass submissions
                  get this quieter surface instead of the full Accepted modal. */}
              {showInlineCelebration && submitResult?.pass && (
                <div
                  role="status"
                  aria-live="polite"
                  className="shrink-0 border-b border-[color:var(--positive)] bg-[color:var(--positive-soft)] px-5 py-2 text-sm font-medium text-[color:var(--positive)]"
                >
                  <span aria-hidden className="mr-1.5">
                    ✓
                  </span>
                  Accepted · {submitResult.executionTimeMs}ms · {attemptCount}{" "}
                  attempt{attemptCount === 1 ? "" : "s"}
                </div>
              )}

              {/* Pending coach analysis surface — tells the user their failed
                  submission is being analyzed. No live counter (the label would
                  freeze on render; the animated dots carry the sense of motion). */}
              {pendingAnalysis && !coachOpen && isWrong && (
                <div className="shrink-0 flex items-center gap-3 border-b border-[color:var(--border)] bg-[color:var(--accent-soft)] px-5 py-2 text-sm">
                  <span className="eyebrow text-[color:var(--accent-strong)]">
                    Coach analyzing<span className="animate-pulse">…</span>
                  </span>
                  {llmAvailable && (
                    <button
                      type="button"
                      onClick={() => {
                        setCoachOpen(true);
                        setPendingAnalysis(null);
                      }}
                      className="btn-ghost ml-auto text-[color:var(--accent)]"
                    >
                      Open coach chat →
                    </button>
                  )}
                </div>
              )}

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
                    <div className="mt-4 border border-[color:var(--warning-soft)] bg-[color:var(--warning-soft)] px-4 py-3 text-sm leading-6 text-[color:var(--warning-text)]">
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
                    isLoading={isRunning && !result && !error}
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
      "border-[color:var(--warning-soft)] bg-[color:var(--warning-soft)] text-[color:var(--warning-text)]",
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

