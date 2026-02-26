import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import * as ingestApi from "@/api/ingest";
import FileDropZone from "@/components/ingest/FileDropZone";
import IngestionHistory from "@/components/ingest/IngestionHistory";
import UploadProgressList from "@/components/ingest/UploadProgressList";
import BatchTextForm from "@/components/ingest/BatchTextForm";
import TextInputForm from "@/components/ingest/TextInputForm";
import { useToast } from "@/components/shared/Toast";
import { useJobs } from "@/hooks/use-jobs";
import { useFileUpload } from "@/hooks/use-file-upload";

function normalizeErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { status?: number } }).response;
    if (response?.status === 401) {
      return "Your session expired. Please log in again.";
    }
    if (response?.status === 413) {
      return "Payload too large. Try a smaller input.";
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Request failed.";
}

export default function IngestPage() {
  const [tab, setTab] = useState<"files" | "text" | "batch">("files");
  const [customerCompany, setCustomerCompany] = useState("");
  const [channelName, setChannelName] = useState("");
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const jobsQueryData = useJobs();
  const jobs = jobsQueryData.data?.data ?? [];

  const upload = useFileUpload();

  const uploadFiles = async () => {
    try {
      const response = await upload.submitBatch({ customer_company: customerCompany, channel_name: channelName });
      if (response) {
        upload.clearFiles();
        setCustomerCompany("");
        setChannelName("");
        pushToast(`Batch submitted. Job ${response.data.job_id.slice(0, 8)} created.`, "success");
        await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      }
    } catch (error) {
      pushToast(normalizeErrorMessage(error), "error");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl">Ingest Customer Data</h2>
        <p className="text-[var(--ink-soft)]">Upload files, paste text, and monitor ingestion progress.</p>
      </div>

      <div className="panel elevated p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ["files", "Upload Files"],
            ["text", "Single Text"],
            ["batch", "Batch Text"]
          ].map(([value, label]) => (
            <button
              key={value}
              className={`rounded-lg px-3 py-2 text-sm ${tab === value ? "bg-[var(--ink)] text-white" : "border border-[var(--line)]"}`}
              onClick={() => setTab(value as "files" | "text" | "batch")}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "files" ? (
          <div className="space-y-4">
            <FileDropZone onFilesAdded={upload.enqueueFiles} />
            <UploadProgressList files={upload.queuedFiles} onRemove={upload.removeFile} />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                value={customerCompany}
                onChange={(event) => setCustomerCompany(event.target.value)}
                placeholder="Customer company"
                className="rounded-lg border border-[var(--line)] px-3 py-2"
              />
              <input
                value={channelName}
                onChange={(event) => setChannelName(event.target.value)}
                placeholder="Context / channel"
                className="rounded-lg border border-[var(--line)] px-3 py-2"
              />
            </div>
            <button
              className="rounded-lg bg-[var(--ink)] px-4 py-2 text-white"
              disabled={upload.acceptedFiles.length === 0 || upload.isUploading}
              onClick={() => void uploadFiles()}
            >
              Upload & Process ({upload.acceptedFiles.length} files)
            </button>
          </div>
        ) : null}

        {tab === "text" ? (
          <TextInputForm
            onSubmit={async (text, metadata) => {
              try {
                const response = await ingestApi.ingestText(text, metadata);
                pushToast(`Text submitted. Signal ${response.data.signal_id.slice(0, 8)} queued.`, "success");
                await queryClient.invalidateQueries({ queryKey: ["signals"] });
              } catch (error) {
                const message = normalizeErrorMessage(error);
                pushToast(message, "error");
                throw new Error(message);
              }
            }}
          />
        ) : null}

        {tab === "batch" ? (
          <BatchTextForm
            onSubmitBatch={async (items) => {
              try {
                const response = await ingestApi.ingestTextBatch(items);
                pushToast(`Batch submitted. Job ${response.data.job_id.slice(0, 8)} created.`, "success");
                await queryClient.invalidateQueries({ queryKey: ["jobs"] });
              } catch (error) {
                const message = normalizeErrorMessage(error);
                pushToast(message, "error");
                throw new Error(message);
              }
            }}
          />
        ) : null}
      </div>

      <IngestionHistory jobs={jobs} />
      {jobsQueryData.isFetching ? <p className="text-sm text-[var(--ink-soft)]">Refreshing jobs...</p> : null}
    </div>
  );
}
