import { apiClient } from "@/src/lib/api-client";
import type {
  CurrentUser,
  ThemePreference,
  UpdateAppearanceInput,
  UpdateProfileInput,
} from "./types";

export async function getCurrentUser() {
  const response = await apiClient.get<CurrentUser>("/users/me");
  return response.data;
}

export async function updateCurrentUser(input: UpdateProfileInput) {
  const response = await apiClient.patch<CurrentUser>("/users/me", input);
  return response.data;
}

export async function updateThemePreference(themePreference: ThemePreference) {
  const response = await apiClient.patch<CurrentUser>("/users/me/theme", {
    themePreference,
  });
  return response.data;
}

export async function updateAppearance(input: UpdateAppearanceInput) {
  const response = await apiClient.patch<CurrentUser>(
    "/users/me/appearance",
    input,
  );
  return response.data;
}

export async function uploadAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await apiClient.post<CurrentUser>("/users/me/avatar", form);
  return response.data;
}

export async function removeAvatar() {
  const response = await apiClient.delete<CurrentUser>("/users/me/avatar");
  return response.data;
}
