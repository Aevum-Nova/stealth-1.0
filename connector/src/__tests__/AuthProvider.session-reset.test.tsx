import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as authApi from "@/api/auth";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { disableGoogleAutoSelect } from "@/lib/google-identity";
import { attemptTokenRefresh, clearAuthState, setAccessToken } from "@/lib/auth";

vi.mock("@/api/auth", () => ({
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  register: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  attemptTokenRefresh: vi.fn(),
  clearAuthState: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock("@/lib/google-identity", () => ({
  disableGoogleAutoSelect: vi.fn(),
}));

function AuthHarness() {
  const { isLoading, login, logout } = useAuth();

  if (isLoading) {
    return <div>Loading session...</div>;
  }

  return (
    <div>
      <button type="button" onClick={() => void login("next@example.com", "password123")}>
        Log In
      </button>
      <button type="button" onClick={() => void logout()}>
        Log Out
      </button>
    </div>
  );
}

describe("AuthProvider session resets", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(attemptTokenRefresh).mockResolvedValue(false);
    vi.mocked(authApi.login).mockResolvedValue({
      data: {
        access_token: "access-token",
        refresh_token: "refresh-token",
        user: {
          id: "user-next",
          email: "next@example.com",
          name: "Next User",
          role: "admin",
          organization_id: "org-next",
        },
      },
    } as Awaited<ReturnType<typeof authApi.login>>);
    vi.mocked(authApi.me).mockResolvedValue({
      data: {
        id: "user-next",
        email: "next@example.com",
        name: "Next User",
        role: "admin",
        organization: {
          id: "org-next",
          name: "Next Workspace",
        },
        created_at: "2026-03-30T00:00:00Z",
      },
    } as Awaited<ReturnType<typeof authApi.me>>);
    vi.mocked(authApi.logout).mockResolvedValue({
      data: { logged_out: true },
    } as Awaited<ReturnType<typeof authApi.logout>>);
  });

  it("clears cached queries when the signed-in account changes and when logging out", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const clearSpy = vi.spyOn(queryClient, "clear");
    const user = userEvent.setup();

    queryClient.setQueryData(["auth", "user-previous", "signals"], { data: ["stale-signal"] });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthHarness />
        </AuthProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.queryByText("Loading session...")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryData(["auth", "user-previous", "signals"])).toBeUndefined();
    expect(setAccessToken).toHaveBeenCalledWith("access-token");

    queryClient.setQueryData(["auth", "user-next", "jobs"], { data: ["stale-job"] });
    clearSpy.mockClear();

    await user.click(screen.getByRole("button", { name: "Log Out" }));

    await waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(1));
    expect(queryClient.getQueryData(["auth", "user-next", "jobs"])).toBeUndefined();
    expect(clearAuthState).toHaveBeenCalled();
    expect(disableGoogleAutoSelect).toHaveBeenCalled();
  });
});
