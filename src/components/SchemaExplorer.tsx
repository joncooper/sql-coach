"use client";

import { useMemo, useState } from "react";

interface SchemaExplorerProps {
  schema: Record<
    string,
    { column_name: string; data_type: string; is_nullable: string }[]
  >;
}

export default function SchemaExplorer({ schema }: SchemaExplorerProps) {
  const tableNames = Object.keys(schema);
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(tableNames.slice(0, Math.min(tableNames.length, 2)))
  );
  const [query, setQuery] = useState("");

  const filteredTables = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const entries = Object.entries(schema);

    if (!normalized) return entries;

    return entries.flatMap(([table, columns]) => {
      if (table.toLowerCase().includes(normalized)) {
        return [[table, columns] as const];
      }

      const matchingColumns = columns.filter((column) =>
        `${column.column_name} ${column.data_type}`
          .toLowerCase()
          .includes(normalized)
      );

      return matchingColumns.length > 0
        ? [[table, matchingColumns] as const]
        : [];
    });
  }, [query, schema]);

  const toggle = (table: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table);
      else next.add(table);
      return next;
    });
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Tables</div>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Search by table name or column to get oriented faster.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(new Set(tableNames))}
            className="btn-ghost"
          >
            Expand all
          </button>
          <button
            onClick={() => setExpanded(new Set())}
            className="btn-ghost"
          >
            Collapse all
          </button>
        </div>
      </div>

      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter tables or columns"
        className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent)] focus:outline-none"
      />

      {filteredTables.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[color:var(--border-strong)] bg-[color:var(--panel-muted)] px-4 py-5 text-sm leading-6 text-[color:var(--text-muted)]">
          No tables or columns match that filter.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTables.map(([table, columns]) => {
            const open = query.trim() ? true : expanded.has(table);

            return (
              <div
                key={table}
                className="app-panel overflow-hidden"
              >
                <button
                  onClick={() => toggle(table)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-[color:var(--text)] hover:bg-[color:var(--panel-muted)]"
                >
                  <span className="text-xs text-[color:var(--text-muted)]">
                    {open ? "\u25BC" : "\u25B6"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-[family-name:var(--font-mono)] text-xs font-semibold text-[color:var(--accent)]">
                      {table}
                    </div>
                    <div className="mt-1 text-xs text-[color:var(--text-muted)]">
                      {columns.length} visible column
                      {columns.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </button>
                {open && (
                  <div className="space-y-1 border-t border-[color:var(--border-subtle)] px-4 py-3">
                    {columns.map((col) => (
                      <div
                        key={col.column_name}
                        className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md px-2 py-1.5 font-[family-name:var(--font-mono)] text-xs"
                      >
                        <span className="truncate text-[color:var(--text)]">
                          {col.column_name}
                        </span>
                        <span className="text-[color:var(--text-muted)]">
                          {col.data_type}
                        </span>
                        {col.is_nullable === "YES" && (
                          <span className="rounded bg-[color:var(--panel-muted)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--text-muted)]">
                            nullable
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
