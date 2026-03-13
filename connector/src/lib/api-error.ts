export interface ApiErrorDetails {
  status?: number;
  message: string;
}

function toMessage(value: unknown): string | null {
  if (typeof value === "string") {
    const message = value.trim();
    return message || null;
  }

  if (Array.isArray(value)) {
    const messages = value.map((item) => toMessage(item)).filter((item): item is string => Boolean(item));
    return messages.length > 0 ? messages.join("; ") : null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return toMessage(record.detail) || toMessage(record.message) || toMessage(record.msg) || null;
  }

  return null;
}

async function readResponseMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as Record<string, unknown>;
    return toMessage(body.detail) || toMessage(body.message) || toMessage(body.error);
  } catch {
    // Fall back to a plain-text body when the API does not return JSON.
  }

  try {
    return toMessage(await response.clone().text());
  } catch {
    return null;
  }
}

export async function extractApiErrorDetails(error: unknown, fallback: string): Promise<ApiErrorDetails> {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: Response }).response;
    if (response) {
      if (response.status === 401) {
        return { status: response.status, message: "Your session expired. Please log in again." };
      }

      if (response.status === 413) {
        return { status: response.status, message: "Payload too large. Try a smaller input." };
      }

      const message = await readResponseMessage(response);
      if (message) {
        return { status: response.status, message };
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return { message: error.message.trim() };
  }

  return { message: fallback };
}

export async function extractApiErrorMessage(error: unknown, fallback: string): Promise<string> {
  const details = await extractApiErrorDetails(error, fallback);
  return details.message;
}
