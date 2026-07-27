"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect } from "react";
import type { AuthenticatedUser } from "../types/auth.types";
import { useCurrentUser } from "../hooks/use-current-user";
import { BrandLoader } from "@/src/components/ui/brand-loader";

type AuthContextValue = {
  user: AuthenticatedUser;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading, isError } = useCurrentUser();

  useEffect(() => {
    if (isError) {
      router.replace("/login");
    }
  }, [isError, router]);

  if (isLoading) {
    return <BrandLoader fullScreen label="Checking your BigU session..." />;
  }

  if (!user) {
    return null;
  }

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}

export function useAuthenticatedUser() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthenticatedUser must be used inside AuthGuard.");
  }

  return context.user;
}