import type { Role, UserStatus } from '../../generated/prisma/client';

export type AuthenticatedUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  designation: string | null;
  status: UserStatus;
  isActive: boolean;
  mustChangePassword: boolean;
  tokenVersion: number;
};
