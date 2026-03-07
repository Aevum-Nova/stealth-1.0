import { UploadCloud } from "lucide-react";
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
      className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition sm:p-10 ${
        isDragActive ? "border-[var(--accent)] bg-[var(--accent-soft)]/40" : "border-[var(--line)] bg-[var(--accent-soft)]"
      }`}
    >
      <input {...getInputProps()} />
      <UploadCloud className="mx-auto size-8 text-[var(--ink-soft)]" />
      <p className="mt-2 font-semibold">Drop files here or click to browse</p>
      <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
        Supports text, audio, and image files. Max 100MB per file, up to 50 files.
      </p>
    </div>
  );
}
