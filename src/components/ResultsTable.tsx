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
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export default function ResultsTable({
  columns,
  rows,
  executionTimeMs,
  rowCount,
  diff,
  mode,
  error,
}: ResultsTableProps) {
  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm text-red-400 whitespace-pre-wrap">
          {error}
        </div>
      </div>
    );
  }

  if (columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
        Run a query to see results
      </div>
    );
  }

  const diffMap = new Map(
    diff?.map((d) => [JSON.stringify(d.row), d.type]) ?? []
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead>
            <tr className="sticky top-0 z-10 bg-zinc-900">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="border-b border-zinc-700 px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const key = JSON.stringify(row);
              const diffType = diffMap.get(key);
              let rowClass = "border-b border-zinc-800/50";
              let cellHighlight = "";
              if (mode === "submit" && diffType === "extra") {
                rowClass = "border-b border-red-900/30 bg-red-500/8";
                cellHighlight = "text-red-300";
              } else if (mode === "expected" && diffType === "missing") {
                rowClass = "border-b border-emerald-900/30 bg-emerald-500/8";
                cellHighlight = "text-emerald-300";
              }
              return (
                <tr key={i} className={rowClass}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-3 py-1 ${
                        cell === null ? "italic text-zinc-600" : "text-zinc-300"
                      } ${cellHighlight}`}
                    >
                      {formatCell(cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {mode === "submit" &&
              diff
                ?.filter((d) => d.type === "missing")
                .map((d, i) => (
                  <tr
                    key={`missing-${i}`}
                    className="border-b border-emerald-900/30 bg-emerald-500/8"
                  >
                    {d.row.map((cell, j) => (
                      <td
                        key={j}
                        className={`px-3 py-1 text-emerald-400/60 ${
                          cell === null ? "italic" : ""
                        }`}
                      >
                        {formatCell(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {executionTimeMs !== undefined && (
        <div className="flex items-center gap-4 border-t border-zinc-800 px-3 py-1 text-[11px] text-zinc-600">
          <span>{rowCount ?? rows.length} rows</span>
          <span>{executionTimeMs}ms</span>
        </div>
      )}
    </div>
  );
}
