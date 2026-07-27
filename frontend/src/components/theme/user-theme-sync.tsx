"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useCurrentUser } from "@/src/features/auth/hooks/use-current-user";

export function UserThemeSync() {
  const { data: user } = useCurrentUser();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (user?.themePreference) {
      setTheme(user.themePreference.toLowerCase());
    }
  }, [setTheme, user?.themePreference]);

  return null;
}
