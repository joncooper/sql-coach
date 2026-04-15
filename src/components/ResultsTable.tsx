"use client";

import type { RowDiff } from "@/types";

interface ResultsTableProps {
  columns: string[];
  rows: unknown[][];
  executionTimeMs?: number;
  rowCount?: number;
  diff?: RowDiff[];
  mode: "run" | "submit" | "expected";
  error?: string;
  isLoading?: boolean;
}

// Skeleton placeholder rows shown while a query is running, so the table
// chrome doesn't flash between empty-state text and real rows.
function SkeletonRows({ columns }: { columns: number }) {
  const placeholderCols = columns > 0 ? columns : 3;
  return (
    <>
      {[0, 1, 2].map((i) => (
        <tr
          key={`skeleton-${i}`}
          className="border-b border-[color:var(--border-subtle)]"
          aria-hidden
        >
          <td className="px-3 py-2 align-top">
            <div className="h-3 w-4 rounded bg-[color:var(--panel-muted)]" />
          </td>
          {Array.from({ length: placeholderCols }).map((_, j) => (
            <td key={j} className="px-3 py-2 align-top">
              <div
                className="h-3 rounded bg-[color:var(--panel-muted)]"
                style={{ width: `${60 + ((i + j) * 11) % 35}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function getEmptyMessage(mode: "run" | "submit" | "expected"): string {
  if (mode === "expected") return "The reference query returns no rows here.";
  if (mode === "submit") return "Your submitted query returned no rows.";
  return "Run a query to see results.";
}

export default function ResultsTable({
  columns,
  rows,
  executionTimeMs,
  rowCount,
  diff,
  mode,
  error,
  isLoading,
}: ResultsTableProps) {
  if (error) {
    return (
      <div className="p-4">
        <div
          className="rounded-lg border border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)] p-4 font-[family-name:var(--font-mono)] text-sm whitespace-pre-wrap text-[color:var(--danger)]"
          role="alert"
        >
          {error}
        </div>
      </div>
    );
  }

  // Loading state — show skeleton chrome with 3 placeholder rows so the
  // layout doesn't jump when results arrive. Uses existing columns if
  // we have any (reruns) or a 3-col fallback (first run).
  if (isLoading) {
    const skeletonCols = columns.length > 0 ? columns : ["", "", ""];
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-auto">
          <table
            className="w-full border-collapse font-[family-name:var(--font-mono)] text-xs"
            aria-busy="true"
            aria-label="Loading query results"
          >
            <thead>
              <tr className="sticky top-0 z-10 bg-[color:var(--panel-muted)]">
                <th className="border-b border-[color:var(--border)] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                  #
                </th>
                {skeletonCols.map((col, i) => (
                  <th
                    key={i}
                    className="border-b border-[color:var(--border)] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]"
                  >
                    {col || (
                      <span className="inline-block h-3 w-16 rounded bg-[color:var(--border)]" />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <SkeletonRows columns={skeletonCols.length} />
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-4 border-t border-[color:var(--border)] px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
          <span>Running query…</span>
        </div>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm leading-6 text-[color:var(--text-muted)]">
        {getEmptyMessage(mode)}
      </div>
    );
  }

  const diffMap = new Map(
    diff?.map((d) => [JSON.stringify(d.row), d.type]) ?? []
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-[family-name:var(--font-mono)] text-xs">
          <thead>
            <tr className="sticky top-0 z-10 bg-[color:var(--panel-muted)]">
              <th className="border-b border-[color:var(--border)] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
                #
              </th>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="border-b border-[color:var(--border)] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-sm text-[color:var(--text-muted)]"
                >
                  {getEmptyMessage(mode)}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const key = JSON.stringify(row);
                const diffType = diffMap.get(key);
                let rowClass =
                  "border-b border-[color:var(--border-subtle)] odd:bg-[color:var(--panel-muted)]";
                let cellHighlight = "";
                if (mode === "submit" && diffType === "extra") {
                  rowClass =
                    "border-b border-[color:var(--danger-soft)] bg-[color:var(--danger-soft)]";
                  cellHighlight = "text-[color:var(--danger)]";
                } else if (mode === "expected" && diffType === "missing") {
                  rowClass =
                    "border-b border-[color:var(--positive-soft)] bg-[color:var(--positive-soft)]";
                  cellHighlight = "text-[color:var(--positive)]";
                }

                return (
                  <tr key={i} className={rowClass}>
                    <td className="px-3 py-2 align-top text-[11px] text-[color:var(--text-muted)]">
                      {i + 1}
                    </td>
                    {row.map((cell, j) => {
                      const isNull = cell === null || cell === undefined;

                      return (
                        <td
                          key={j}
                          className={`px-3 py-2 align-top ${
                            isNull
                              ? "text-[color:var(--text-muted)]"
                              : "text-[color:var(--text-soft)]"
                          } ${cellHighlight}`}
                        >
                          {isNull ? (
                            <span className="rounded bg-[color:var(--panel-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
                              NULL
                            </span>
                          ) : (
                            formatCell(cell)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {executionTimeMs !== undefined && (
        <div className="flex items-center gap-4 border-t border-[color:var(--border)] px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
          <span>{rowCount ?? rows.length} rows</span>
          <span>{executionTimeMs}ms</span>
        </div>
      )}
    </div>
  );
}
