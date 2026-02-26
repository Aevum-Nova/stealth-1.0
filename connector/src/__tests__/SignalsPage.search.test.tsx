import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import SignalsPage from "@/pages/signals/SignalsPage";

const mockUseSignals = vi.fn();
const mockUseSignalSearch = vi.fn();

vi.mock("@/hooks/use-signals", () => ({
  useSignals: (...args: unknown[]) => mockUseSignals(...args),
  useSignalSearch: (...args: unknown[]) => mockUseSignalSearch(...args)
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SignalsPage />
    </MemoryRouter>
  );
}

describe("SignalsPage semantic search", () => {
  beforeEach(() => {
    mockUseSignals.mockReturnValue({
      isLoading: false,
      data: {
        data: [
          {
            id: "s1",
            status: "completed",
            source: "api",
            source_data_type: "text",
            raw_artifact_r2_key: "k",
            raw_artifact_mime_type: "text/plain",
            raw_artifact_size_bytes: 1,
            structured_summary: "Billing export is failing for enterprise customers",
            entities: [],
            source_metadata: {},
            synthesized: false,
            organization_id: "org",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z"
          }
        ],
        pagination: { page: 1, limit: 20, total: 1 }
      }
    });

    mockUseSignalSearch.mockImplementation((query: string) => {
      const normalized = query.trim();
      if (normalized.length < 2) {
        return { isLoading: false, isError: false, data: undefined };
      }
      return { isLoading: true, isError: false, data: undefined };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps default rows for a one-character query", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("Semantic search signals..."), "a");

    expect(screen.getByText("Type at least 2 characters to run search.")).toBeInTheDocument();
    expect(screen.getByText("Billing export is failing for enterprise customers")).toBeInTheDocument();
    expect(screen.queryByText("No signals found")).not.toBeInTheDocument();
  });

  it("shows a loading state while search request is in-flight", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("Semantic search signals..."), "ab");

    expect(screen.getByText("Searching signals")).toBeInTheDocument();
    expect(screen.queryByText("No signals found")).not.toBeInTheDocument();
  });
});
