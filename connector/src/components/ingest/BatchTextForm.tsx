import { useMemo, useState } from "react";

interface BatchTextFormProps {
  onSubmitBatch: (items: { text: string; metadata?: Record<string, unknown> }[]) => Promise<void>;
}

export default function BatchTextForm({ onSubmitBatch }: BatchTextFormProps) {
  const [text, setText] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const parts = useMemo(
    () =>
      text
        .split("---")
        .map((item) => item.trim())
        .filter(Boolean),
    [text]
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (parts.length === 0) return;
        setBusy(true);
        setError(null);
        setSuccess(null);
        void (async () => {
          try {
            await onSubmitBatch(
              parts.map((item) => ({
                text: item,
                metadata: {
                  author_name: authorName,
                  customer_company: customerCompany
                }
              }))
            );
            setText("");
            setAuthorName("");
            setCustomerCompany("");
            setSuccess("Batch submitted. Processing job started.");
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Failed to submit batch.");
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Separate entries with ---"
        className="h-40 w-full rounded-lg border border-[var(--line)] px-3 py-2"
      />
      <p className="text-[13px] text-[var(--ink-soft)]">This will create {parts.length} signal(s).</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <input
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          placeholder="Author"
          className="rounded-lg border border-[var(--line)] px-3 py-2"
        />
        <input
          value={customerCompany}
          onChange={(event) => setCustomerCompany(event.target.value)}
          placeholder="Company"
          className="rounded-lg border border-[var(--line)] px-3 py-2"
        />
      </div>
      <button className="rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] transition-colors" disabled={parts.length === 0 || busy}>
        {busy ? "Submitting..." : "Submit Batch"}
      </button>
      {success ? <p className="text-[13px] text-emerald-700">{success}</p> : null}
      {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
    </form>
  );
}
