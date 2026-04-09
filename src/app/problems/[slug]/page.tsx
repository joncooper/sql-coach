"use client";

import { useEffect, useState, useCallback, use } from "react";
import dynamic from "next/dynamic";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import ProblemDescription from "@/components/ProblemDescription";
import DifficultyBadge from "@/components/DifficultyBadge";
import SchemaExplorer from "@/components/SchemaExplorer";
import SampleData from "@/components/SampleData";
import ResultsTable from "@/components/ResultsTable";
import type { QueryResult, RowDiff } from "@/types";

function formatCategory(s: string) {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  adjacent: { prev: string | null; next: string | null };
}

interface SubmitResponse {
  pass: boolean;
  message: string;
  expected: { columns: string[]; rows: unknown[][] };
  actual: { columns: string[]; rows: unknown[][] };
  diff: RowDiff[];
  executionTimeMs: number;
  error?: string;
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

  useEffect(() => {
    fetch(`/api/problems/${slug}`)
      .then((r) => r.json())
      .then((data: ProblemDetail) => {
        setProblem(data);
        const saved = localStorage.getItem(`sql-coach:code:${slug}`);
        if (saved) {
          setCode(saved);
        } else if (data.starter_code) {
          setCode(data.starter_code);
        }
      });
  }, [slug]);

  useEffect(() => {
    if (!code) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`sql-coach:code:${slug}`, code);
    }, 500);
    return () => clearTimeout(timer);
  }, [code, slug]);

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
        body: JSON.stringify({ sql: code }),
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
      } else {
        setSubmitResult(data);
        if (data.pass) {
          setShowAccepted(true);
          setTimeout(() => setShowAccepted(false), 3000);
          const completions = JSON.parse(
            localStorage.getItem("sql-coach:completed") ?? "{}"
          );
          completions[slug] = {
            completedAt: new Date().toISOString(),
            attempts: (completions[slug]?.attempts ?? 0) + 1,
          };
          localStorage.setItem(
            "sql-coach:completed",
            JSON.stringify(completions)
          );
        }
      }
    } catch {
      setError("Failed to connect to server");
    } finally {
      setIsRunning(false);
    }
  }, [code, slug, isRunning]);

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

  return (
    <PanelGroup orientation="horizontal" className="h-full overflow-hidden">
      {/* Left: Problem description + schema */}
      <Panel defaultSize={35} minSize={20}>
        <div className="flex h-full flex-col">
          {/* Pinned header */}
          <div className="shrink-0 border-b border-zinc-800 px-4 pt-4 pb-3">
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
          </div>
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <ProblemDescription
              description={problem.description}
              hints={problem.hints}
            />
            <div className="mt-4 border-t border-zinc-800 pt-4">
              <SchemaExplorer schema={problem.schema} />
            </div>
            {problem.samples && (
              <div className="mt-4 border-t border-zinc-800 pt-4">
                <SampleData samples={problem.samples} />
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
              {/* Accepted celebration overlay */}
              {showAccepted && (
                <div className="animate-in absolute inset-0 z-20 flex items-center justify-center bg-emerald-950/80 backdrop-blur-sm">
                  <div className="text-center">
                    <div className="text-6xl font-black tracking-tight text-emerald-400">
                      Accepted
                    </div>
                    <div className="mt-2 text-lg text-emerald-500/80">
                      Runtime: {submitResult?.executionTimeMs}ms
                    </div>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <SqlEditor
                  value={code}
                  onChange={setCode}
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
