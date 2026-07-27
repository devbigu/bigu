import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGuard } from "../auth-guard";
import * as authApi from "../../api/auth.api";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

function renderGuard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <div>Private dashboard</div>
      </AuthGuard>
    </QueryClientProvider>
  );
}

describe("AuthGuard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders authenticated content", async () => {
    vi.spyOn(authApi, "getCurrentUser").mockResolvedValue({
      id: "user-1",
      name: "Ada Lovelace",
      username: "ada",
      email: "ada@bigu.test",
      role: "ADMIN",
      isActive: true,
    });

    renderGuard();

    expect(screen.getByText(/checking your bigu session/i)).toBeInTheDocument();
    expect(await screen.findByText("Private dashboard")).toBeInTheDocument();
  });

  it("redirects unauthenticated users", async () => {
    vi.spyOn(authApi, "getCurrentUser").mockRejectedValue(new Error("unauthorized"));

    renderGuard();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});
