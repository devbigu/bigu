export type ThemePreference = "SYSTEM" | "LIGHT" | "DARK";

export type CurrentUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "STAFF";
  isActive: boolean;
  designation?: string;
  status?: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  mustChangePassword?: boolean;
  tokenVersion?: number;
  avatarUrl?: string | null;
  accentColor?: string | null;
  themeColor?: string | null;
  themePreference?: ThemePreference;
  createdAt?: string;
  updatedAt?: string;
};

export type UpdateProfileInput = {
  name?: string;
  username?: string;
};



export type UpdateAppearanceInput = {
  accentColor?: string;
  themeColor?: string | null;
};

