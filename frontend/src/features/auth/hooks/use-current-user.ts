"use client";

import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "../api/auth.api";

export const currentUserQueryKey = ["current-user"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    retry: false,
  });
}
