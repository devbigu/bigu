import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "../../api/auth.api";
import { LoginForm } from "../login-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function renderLoginForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginForm />
    </QueryClientProvider>,
  );
}

const adminUser = {
  id: "user-1",
  name: "Aditya",
  username: "aditya",
  email: "adityaxsetia@gmail.com",
  role: "ADMIN" as const,
  isActive: true,
  mustChangePassword: false,
};

const staffUser = {
  ...adminUser,
  id: "user-2",
  username: "staff",
  email: "staff@bigu.test",
  role: "STAFF" as const,
};

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows validation errors", async () => {
    renderLoginForm();

    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/enter your username or email/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });

  it("accepts a username and redirects admin to the admin area", async () => {
    const loginSpy = vi.spyOn(authApi, "login").mockResolvedValue(adminUser);
    renderLoginForm();

    await userEvent.type(screen.getByLabelText(/username or email/i), "aditya");
    await userEvent.type(screen.getByLabelText(/^password$/i), "Password123");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(loginSpy).toHaveBeenCalledWith({
        identifier: "aditya",
        password: "Password123",
      }, expect.anything()),
    );
    expect(push).toHaveBeenCalledWith("/admin");
  });

  it("accepts an email and redirects staff to the dashboard", async () => {
    vi.spyOn(authApi, "login").mockResolvedValue(staffUser);
    renderLoginForm();

    await userEvent.type(
      screen.getByLabelText(/username or email/i),
      "staff@bigu.test",
    );
    await userEvent.type(screen.getByLabelText(/^password$/i), "Password123");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
  });

  it("displays backend errors", async () => {
    vi.spyOn(authApi, "login").mockRejectedValue({
      response: { data: { message: "Invalid username or email or password." } },
      isAxiosError: true,
    });
    renderLoginForm();

    await userEvent.type(screen.getByLabelText(/username or email/i), "unknown");
    await userEvent.type(screen.getByLabelText(/^password$/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign in");
  });

  it("shows a loading state during submission", async () => {
    vi.spyOn(authApi, "login").mockImplementation(
      () => new Promise(() => undefined),
    );
    renderLoginForm();

    await userEvent.type(screen.getByLabelText(/username or email/i), "aditya");
    await userEvent.type(screen.getByLabelText(/^password$/i), "Password123");
    await userEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByRole("button", { name: /signing in/i })).toBeDisabled();
  });
});
