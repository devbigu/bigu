import { apiClient } from "@/src/lib/api-client";
import { getCurrentUser } from "@/src/features/settings/api";
import type { AuthResponse, LoginInput } from "../types/auth.types";

export async function login(input: LoginInput) {
  const response = await apiClient.post<AuthResponse>("/auth/login", input);
  return response.data.user;
}

export { getCurrentUser };

export async function logout() {
  await apiClient.post<{ success: true }>("/auth/logout");
}

export async function changeInitialPassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const response = await apiClient.post<AuthResponse>("/auth/change-initial-password", input);
  return response.data.user;
}

