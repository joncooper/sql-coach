"use client";

import { useState } from "react";

interface SchemaExplorerProps {
  schema: Record<
    string,
    { column_name: string; data_type: string; is_nullable: string }[]
  >;
}

export default function SchemaExplorer({ schema }: SchemaExplorerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(Object.keys(schema))
  );

  const toggle = (table: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(table)) next.delete(table);
      else next.add(table);
      return next;
    });
  };

  return (
    <div className="text-sm">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Tables
      </h3>
      <div className="space-y-1">
        {Object.entries(schema).map(([table, columns]) => (
          <div key={table}>
            <button
              onClick={() => toggle(table)}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-zinc-300 hover:bg-zinc-800"
            >
              <span className="text-xs text-zinc-500">
                {expanded.has(table) ? "\u25BC" : "\u25B6"}
              </span>
              <span className="font-mono text-xs font-medium text-blue-400">
                {table}
              </span>
            </button>
            {expanded.has(table) && (
              <div className="ml-5 space-y-0.5 pb-1">
                {columns.map((col) => (
                  <div
                    key={col.column_name}
                    className="flex items-center gap-2 px-2 py-0.5 font-mono text-xs"
                  >
                    <span className="text-zinc-300">{col.column_name}</span>
                    <span className="text-zinc-600">{col.data_type}</span>
                    {col.is_nullable === "YES" && (
                      <span className="text-zinc-700">nullable</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
