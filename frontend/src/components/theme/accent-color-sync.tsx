"use client";

import { useEffect } from "react";
import { useCurrentUser } from "@/src/features/auth/hooks/use-current-user";
import {
  applyAccentColor,
  applyThemeColor,
  cacheThemeColor,
  cacheAccentColor,
  DEFAULT_ACCENT_COLOR,
  normalizeHexColor,
  readCachedAccentColor,
  readCachedThemeColor,
} from "@/src/features/settings/lib/accent-color";

export function AccentColorSync() {
  const { data: user } = useCurrentUser();

  useEffect(() => {
    const initial = readCachedAccentColor() ?? DEFAULT_ACCENT_COLOR;
    applyAccentColor(initial);
    applyThemeColor(readCachedThemeColor());
  }, []);

  useEffect(() => {
    if (!user) return;
    const backendColor =
      normalizeHexColor(user.accentColor ?? "") ?? DEFAULT_ACCENT_COLOR;
    applyAccentColor(backendColor);
    cacheAccentColor(backendColor);
    const backendThemeColor = normalizeHexColor(user.themeColor ?? "" );
    applyThemeColor(backendThemeColor);
    cacheThemeColor(backendThemeColor);
  }, [user]);

  return null;
}
