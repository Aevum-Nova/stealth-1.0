import DataTable from "@/components/shared/DataTable";
import type { Signal } from "@/types/signal";
import { formatDate, formatSourceLabel } from "@/lib/utils";

interface SignalTableProps {
  rows: Signal[];
  onOpen: (signal: Signal) => void;
}

export default function SignalTable({ rows, onOpen }: SignalTableProps) {
  return (
    <DataTable
      rows={rows}
      getRowKey={(row) => row.id}
      onRowClick={onOpen}
      columns={[
        {
          key: "source",
          title: "Source",
          render: (row) => <span className="capitalize">{formatSourceLabel(row.source)}</span>
        },
        { key: "type", title: "Type", render: (row) => row.source_data_type },
        {
          key: "summary",
          title: "Summary",
          render: (row) => <span className="line-clamp-2 max-w-xl text-sm">{row.structured_summary ?? "-"}</span>
        },
        { key: "sentiment", title: "Sentiment", render: (row) => row.sentiment ?? "-" },
        { key: "urgency", title: "Urgency", render: (row) => row.urgency ?? "-" },
        { key: "created", title: "Created", render: (row) => formatDate(row.created_at) }
      ]}
    />
  );
}
