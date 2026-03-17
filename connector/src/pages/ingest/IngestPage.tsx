import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FileText, Image as ImageIcon, Mic, X } from "lucide-react";

import * as ingestApi from "@/api/ingest";
import FileDropZone from "@/components/ingest/FileDropZone";
import IngestionHistory from "@/components/ingest/IngestionHistory";
import { useToast } from "@/components/shared/Toast";
import { useJobs } from "@/hooks/use-jobs";
import { useFileUpload } from "@/hooks/use-file-upload";
import { extractApiErrorMessage } from "@/lib/api-error";

function getFileTypeIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["mp3", "wav", "m4a", "webm", "ogg"].includes(ext)) return Mic;
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return ImageIcon;
  return FileText;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function IngestPage() {
  const [textInput, setTextInput] = useState("");
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [customerCompany, setCustomerCompany] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [channelName, setChannelName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const upload = useFileUpload();
  const jobsQueryData = useJobs();
  const jobs = jobsQueryData.data?.data ?? [];

  const textParts = useMemo(
    () =>
      textInput.trim()
        ? textInput
            .trim()
            .split("---")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    [textInput]
  );

  const totalItems = upload.acceptedFiles.length + textParts.length;
  const hasContent = totalItems > 0;

  const submitAll = async () => {
    if (!hasContent) return;
    setIsSubmitting(true);

    const metadata: Record<string, unknown> = {};
    if (customerCompany) metadata.customer_company = customerCompany;
    if (authorName) metadata.author_name = authorName;
    if (channelName) metadata.channel_name = channelName;

    try {
      const promises: Promise<unknown>[] = [];

      if (upload.acceptedFiles.length > 0) {
        promises.push(upload.submitBatch(metadata));
      }

      if (textParts.length === 1) {
        promises.push(ingestApi.ingestText(textParts[0], metadata));
      } else if (textParts.length > 1) {
        promises.push(
          ingestApi.ingestTextBatch(textParts.map((text) => ({ text, metadata })))
        );
      }

      await Promise.all(promises);

      upload.clearFiles();
      setTextInput("");
      setCustomerCompany("");
      setAuthorName("");
      setChannelName("");

      pushToast(
        `${totalItems} item${totalItems > 1 ? "s" : ""} submitted for processing.`,
        "success"
      );
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["signals"] });
    } catch (error) {
      pushToast(await extractApiErrorMessage(error, "Upload failed."), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Ingest Data</h2>
        <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">
          Drop files or paste text to add customer data for processing.
        </p>
      </div>

      {/* Drop Zone */}
      <FileDropZone onFilesAdded={upload.enqueueFiles} />

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--line)]" />
        <span className="text-[12px] font-medium uppercase tracking-wide text-[var(--ink-muted)]">
          or paste text
        </span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>

      {/* Text Input */}
      <div>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Paste customer feedback, notes, or transcripts..."
          rows={4}
          className="w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[14px] transition"
        />
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-[11px] text-[var(--ink-muted)]">
            Separate multiple entries with{" "}
            <code className="rounded bg-[var(--surface-subtle)] px-1 py-0.5">---</code>
          </p>
          {textParts.length > 1 && (
            <p className="text-[11px] font-medium text-[var(--ink-soft)]">
              {textParts.length} entries detected
            </p>
          )}
        </div>
      </div>

      {/* File Queue */}
      {upload.queuedFiles.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <p className="text-[13px] font-medium">
              {upload.acceptedFiles.length} file{upload.acceptedFiles.length !== 1 ? "s" : ""}{" "}
              ready
              {upload.rejectedFiles.length > 0 && (
                <span className="ml-1 text-[var(--danger)]">
                  · {upload.rejectedFiles.length} rejected
                </span>
              )}
            </p>
            <button
              onClick={upload.clearFiles}
              className="text-[12px] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink-soft)]"
            >
              Clear all
            </button>
          </div>

          <div className="divide-y divide-[var(--line-soft)]">
            {upload.queuedFiles.map((item) => {
              const Icon = getFileTypeIcon(item.file.name);
              return (
                <div key={item.file.name} className="flex items-center gap-3 px-4 py-2.5">
                  <Icon
                    className={`size-4 flex-shrink-0 ${
                      item.valid ? "text-[var(--ink-soft)]" : "text-[var(--danger)]"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{item.file.name}</p>
                    {!item.valid && item.reason && (
                      <p className="text-[11px] text-[var(--danger)]">{item.reason}</p>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-[11px] text-[var(--ink-muted)]">
                    {formatSize(item.file.size)}
                  </span>
                  <button
                    onClick={() => upload.removeFile(item.file.name)}
                    className="flex-shrink-0 rounded p-0.5 text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Metadata + Submit */}
      {hasContent && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setMetadataOpen(!metadataOpen)}
            className="flex items-center gap-1.5 text-[13px] text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
          >
            <ChevronRight
              className={`size-3.5 transition-transform duration-150 ${
                metadataOpen ? "rotate-90" : ""
              }`}
            />
            Add metadata <span className="text-[var(--ink-muted)]">(optional)</span>
          </button>

          {metadataOpen && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                value={customerCompany}
                onChange={(e) => setCustomerCompany(e.target.value)}
                placeholder="Company"
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px]"
              />
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Author"
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px]"
              />
              <input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="Context / channel"
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px]"
              />
            </div>
          )}

          <button
            onClick={() => void submitAll()}
            disabled={!hasContent || isSubmitting || upload.isUploading}
            className="w-full rounded-xl bg-[var(--ink)] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            {isSubmitting || upload.isUploading
              ? "Processing..."
              : `Upload & Process (${totalItems} item${totalItems > 1 ? "s" : ""})`}
          </button>
        </div>
      )}

      {/* History */}
      <IngestionHistory jobs={jobs} />
    </div>
  );
}
