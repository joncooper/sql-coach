"use client";

import { useEffect, useMemo, useState } from "react";

interface SampleDataProps {
  samples: Record<string, { columns: string[]; rows: unknown[][] }>;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return value.toISOString();
  const s = String(value);
  if (s.length > 30) return s.slice(0, 27) + "...";
  return s;
}

export default function SampleData({ samples }: SampleDataProps) {
  const tables = useMemo(() => Object.entries(samples), [samples]);
  const [selectedTable, setSelectedTable] = useState(tables[0]?.[0] ?? "");

  useEffect(() => {
    if (!tables.find(([tableName]) => tableName === selectedTable)) {
      setSelectedTable(tables[0]?.[0] ?? "");
    }
  }, [selectedTable, tables]);

  if (tables.length === 0) return null;

  const activeTable =
    tables.find(([tableName]) => tableName === selectedTable) ?? tables[0];
  const [tableName, { columns, rows }] = activeTable;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Sample data</div>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Representative rows for faster query planning.
          </p>
        </div>
        <div className="rounded-md bg-[color:var(--panel-muted)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--text-muted)]">
          {tables.length} table{tables.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tables.map(([candidateTable, { rows: candidateRows }]) => (
          <button
            key={candidateTable}
            onClick={() => setSelectedTable(candidateTable)}
            className={`rounded-md px-3 py-1.5 font-[family-name:var(--font-mono)] text-xs font-semibold ${
              candidateTable === tableName
                ? "bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                : "bg-[color:var(--panel-muted)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
            }`}
          >
            {candidateTable}
            <span className="ml-2 text-[color:var(--text-muted)]">
              {candidateRows.length}
            </span>
          </button>
        ))}
      </div>

      <div className="app-panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-4 py-3">
          <div className="font-[family-name:var(--font-mono)] text-xs font-semibold text-[color:var(--accent)]">
            {tableName}
          </div>
          <div className="text-[11px] font-medium text-[color:var(--text-muted)]">
            {rows.length} sample row{rows.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-[family-name:var(--font-mono)] text-[11px]">
            <thead>
              <tr className="bg-[color:var(--panel-muted)]">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="border-b border-[color:var(--border)] px-3 py-2 text-left font-semibold uppercase tracking-[0.06em] text-[color:var(--text-muted)]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-[color:var(--border-subtle)] last:border-0 odd:bg-[color:var(--panel-muted)]"
                >
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`whitespace-nowrap px-3 py-2 ${
                        cell === null
                          ? "italic text-[color:var(--text-muted)]"
                          : "text-[color:var(--text-soft)]"
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
      </div>
    </div>
  );
}
