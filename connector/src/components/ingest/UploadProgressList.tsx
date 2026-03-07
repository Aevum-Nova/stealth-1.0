import type { UploadFileItem } from "@/hooks/use-file-upload";

export default function UploadProgressList({
  files,
  onRemove
}: {
  files: UploadFileItem[];
  onRemove: (name: string) => void;
}) {
  return (
    <div className="space-y-2">
      {files.map((item) => (
        <article
          key={item.file.name}
          className={`flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between ${
            item.valid ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
          }`}
        >
          <div>
            <p className="break-all text-[13px] font-medium">{item.file.name}</p>
            <p className="text-[11px] text-[var(--ink-soft)]">{(item.file.size / 1024).toFixed(1)} KB</p>
            {!item.valid && item.reason ? <p className="text-[11px] text-rose-700">{item.reason}</p> : null}
          </div>
          <button className="text-[11px] text-[var(--ink-soft)] underline" onClick={() => onRemove(item.file.name)}>
            Remove
          </button>
        </article>
      ))}
    </div>
  );
}
