import { useMemo, useState } from "react";

import * as ingestApi from "@/api/ingest";

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_FILES = 50;
const ACCEPTED_EXTENSIONS = [
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".mp3",
  ".wav",
  ".m4a",
  ".webm",
  ".ogg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif"
];

export interface UploadFileItem {
  file: File;
  valid: boolean;
  reason?: string;
}

export function useFileUpload() {
  const [queuedFiles, setQueuedFiles] = useState<UploadFileItem[]>([]);
  const [isUploading, setUploading] = useState(false);

  const acceptedFiles = useMemo(() => queuedFiles.filter((f) => f.valid).map((f) => f.file), [queuedFiles]);
  const rejectedFiles = useMemo(() => queuedFiles.filter((f) => !f.valid), [queuedFiles]);

  const enqueueFiles = (files: File[]) => {
    const next = files.map<UploadFileItem>((file) => {
      const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        return { file, valid: false, reason: "Unsupported file type" };
      }
      if (file.size > MAX_FILE_SIZE) {
        return { file, valid: false, reason: "File exceeds 100MB limit" };
      }
      return { file, valid: true };
    });

    setQueuedFiles((prev) => [...prev, ...next].slice(0, MAX_FILES));
  };

  const removeFile = (name: string) => {
    setQueuedFiles((prev) => prev.filter((item) => item.file.name !== name));
  };

  const clearFiles = () => {
    setQueuedFiles([]);
  };

  const submitBatch = async (metadata: Record<string, unknown> = {}) => {
    if (acceptedFiles.length === 0) {
      return null;
    }
    setUploading(true);
    try {
      return await ingestApi.uploadBatchFiles(acceptedFiles, metadata);
    } finally {
      setUploading(false);
    }
  };

  return {
    queuedFiles,
    acceptedFiles,
    rejectedFiles,
    isUploading,
    enqueueFiles,
    removeFile,
    clearFiles,
    submitBatch
  };
}
