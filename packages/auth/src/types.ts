export type UserRole =
  | "client"
  | "runner"
  | "admin"
  | "super_admin";

export interface AuthUser {
  id: string;

  email?: string;

  phone?: string;

  role: UserRole;

  fullName?: string;

  avatarUrl?: string;

  isVerified: boolean;

  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}