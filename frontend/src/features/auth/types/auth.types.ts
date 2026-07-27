export type UserRole = "ADMIN" | "MANAGER" | "STAFF";

export type AuthenticatedUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  designation?: string;
  status?: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  isActive: boolean;
  mustChangePassword?: boolean;
  tokenVersion?: number;
};

export type AuthResponse = {
  user: AuthenticatedUser;
};

export type LoginInput = {
  identifier: string;
  password: string;
};


