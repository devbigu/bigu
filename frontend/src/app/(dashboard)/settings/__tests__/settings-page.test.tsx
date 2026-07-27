import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "../page";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next-themes", () => ({ useTheme: () => ({ setTheme: vi.fn() }) }));
vi.mock("@/src/features/auth/hooks/use-current-user", () => ({
  currentUserQueryKey: ["current-user"],
  useCurrentUser: () => ({
    data: {
      id: "user-1", name: "Ada Lovelace", username: "ada", email: "ada@bigu.test",
      role: "MANAGER", isActive: true, themePreference: "SYSTEM", createdAt: "2026-01-01T00:00:00.000Z",
    },
    isPending: false, isError: false, refetch: vi.fn(),
  }),
}));

function renderPage() {
  return render(<QueryClientProvider client={new QueryClient()}><SettingsPage /></QueryClientProvider>);
}

describe("SettingsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders saved editable profile values and protected account fields", () => {
    renderPage();
    expect(screen.getByLabelText("Display name")).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText("Username")).toHaveValue("ada");
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByText("MANAGER")).toBeInTheDocument();
  });
});