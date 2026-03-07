import { useState } from "react";

interface TextInputFormProps {
  onSubmit: (text: string, metadata: Record<string, unknown>) => Promise<void>;
}

export default function TextInputForm({ onSubmit }: TextInputFormProps) {
  const [text, setText] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setSuccess(null);
        void (async () => {
          try {
            await onSubmit(text, {
              author_name: authorName,
              customer_company: customerCompany
            });
            setText("");
            setAuthorName("");
            setCustomerCompany("");
            setSuccess("Text submitted. Processing started.");
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Failed to submit text.");
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Paste customer feedback here..."
        className="h-40 w-full rounded-lg border border-[var(--line)] px-3 py-2"
      />
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
      <button className="rounded-lg bg-[var(--ink)] px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] transition-colors" disabled={!text.trim() || busy}>
        {busy ? "Submitting..." : "Submit Text"}
      </button>
      <p className="text-[11px] text-[var(--ink-soft)]">Single text submits create signals directly. Check the Signals page for results.</p>
      {success ? <p className="text-[13px] text-emerald-700">{success}</p> : null}
      {error ? <p className="text-[13px] text-red-700">{error}</p> : null}
    </form>
  );
}
