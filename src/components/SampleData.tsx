"use client";

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
  const tables = Object.entries(samples);
  if (tables.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Sample Data
      </h3>
      {tables.map(([tableName, { columns, rows }]) => (
        <div key={tableName}>
          <div className="mb-1 font-mono text-xs font-medium text-blue-400">
            {tableName}
          </div>
          <div className="overflow-x-auto rounded border border-zinc-800">
            <table className="w-full border-collapse font-mono text-[11px]">
              <thead>
                <tr className="bg-zinc-900">
                  {columns.map((col) => (
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
                {rows.map((row, i) => (
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
                        {formatCell(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
