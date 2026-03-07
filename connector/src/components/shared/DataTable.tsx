import type { ReactNode } from "react";

interface DataTableProps<T> {
  columns: { key: string; title: string; render: (row: T) => ReactNode }[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}

export default function DataTable<T>({ columns, rows, getRowKey, onRowClick }: DataTableProps<T>) {
  return (
    <div className="panel overflow-x-auto">
      <table className="min-w-[760px] w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[var(--line)]">
            {columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-4 py-2.5 text-[12px] font-medium text-[var(--ink-muted)] uppercase tracking-wide">
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className={`border-b border-[var(--line-soft)] last:border-b-0 transition-colors ${
                onRowClick ? "cursor-pointer hover:bg-[var(--accent-soft)]" : ""
              }`}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2.5 align-top">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
