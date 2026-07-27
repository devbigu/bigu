import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardHome } from "../dashboard-home";
import { apiClient } from "@/src/lib/api-client";
import { logout } from "@/src/features/auth/api/auth.api";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/src/features/auth", () => ({
  useAuthenticatedUser: () => ({
    id: "user-1",
    name: "Ada Lovelace",
    username: "ada",
    email: "ada@bigu.test",
    role: "ADMIN",
    isActive: true,
  }),
}));

vi.mock("@/src/features/auth/api/auth.api", () => ({
  logout: vi.fn(async () => undefined),
}));

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardHome />
    </QueryClientProvider>
  );
}

describe("DashboardHome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: { status: "ok" } });
  });

  it("renders the authenticated dashboard", async () => {
    renderDashboard();

    expect(screen.getByRole("heading", { name: "BigU" })).toBeInTheDocument();
    expect(screen.getByText("Welcome, Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ADMIN")).toBeInTheDocument();
    expect(screen.getAllByText("Upcoming")).toHaveLength(4);
    expect(await screen.findByText("API connected")).toBeInTheDocument();
  });

  it("logs out and redirects to login", async () => {
    renderDashboard();

    await userEvent.click(screen.getByRole("button", { name: /logout/i }));

    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
