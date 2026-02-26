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
      <table className="min-w-[760px] w-full border-collapse text-left">
        <thead className="bg-[#f1ebdf] text-sm text-[var(--ink-soft)]">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-4 py-3 font-medium">
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className="border-t border-[var(--line)] hover:bg-[#fcf8ef]"
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 align-top">
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
