export async function extractApiErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: Response }).response;
    if (response) {
      try {
        const body = (await response.clone().json()) as { detail?: string; message?: string; error?: string };
        const detail = body.detail || body.message || body.error;
        if (typeof detail === "string" && detail.trim()) {
          return detail;
        }
      } catch {
        // ignore parse errors and fall through to generic message
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
