import { FileText, Image as ImageIcon, Mic, UploadCloud } from "lucide-react";
import { useDropzone } from "react-dropzone";

interface FileDropZoneProps {
  onFilesAdded: (files: File[]) => void;
}

export default function FileDropZone({ onFilesAdded }: FileDropZoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => onFilesAdded(acceptedFiles),
    multiple: true,
    maxFiles: 50
  });

  return (
    <div
      {...getRootProps()}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all sm:p-12 ${
        isDragActive
          ? "scale-[1.01] border-[var(--ink)] bg-[var(--accent-soft)]"
          : "border-[var(--line-muted)] bg-[var(--surface-contrast)] hover:border-[var(--ink-muted)] hover:bg-[var(--accent-soft)]"
      }`}
    >
      <input {...getInputProps()} />
      <UploadCloud
        className={`mx-auto size-10 transition-colors ${
          isDragActive ? "text-[var(--ink)]" : "text-[var(--ink-muted)]"
        }`}
      />
      <p className="mt-3 text-[15px] font-semibold">
        {isDragActive ? "Drop to add files" : "Drop files here or click to browse"}
      </p>
      <p className="mt-1 text-[13px] text-[var(--ink-muted)]">Up to 50 files · 100 MB each</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] text-[var(--ink-soft)]">
          <FileText className="size-3" /> Text
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] text-[var(--ink-soft)]">
          <Mic className="size-3" /> Audio
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] text-[var(--ink-soft)]">
          <ImageIcon className="size-3" /> Images
        </span>
      </div>
    </div>
  );
}
