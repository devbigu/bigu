export const DEFAULT_ACCENT_COLOR = "#6366F1";
export const ACCENT_COLOR_STORAGE_KEY = "bigu-accent-color";
export const DEFAULT_THEME_COLOR = "#737373";
export const THEME_COLOR_STORAGE_KEY = "bigu-theme-color";

export const ACCENT_COLOR_PRESETS = [
  { name: "BigU Default", value: DEFAULT_ACCENT_COLOR },
  { name: "Blue", value: "#2563EB" },
  { name: "Purple", value: "#9333EA" },
  { name: "Green", value: "#16A34A" },
  { name: "Orange", value: "#EA580C" },
  { name: "Red", value: "#DC2626" },
  { name: "Pink", value: "#DB2777" },
  { name: "Teal", value: "#0D9488" },
] as const;

export type AccentPalette = {
  base: string;
  foreground: "#000000" | "#FFFFFF";
  hover: string;
  active: string;
  soft: string;
  border: string;
  disabled: string;
  ringLight: string;
  ringDark: string;
};

type Rgb = { r: number; g: number; b: number };

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const SHORT_HEX_COLOR = /^#[0-9A-Fa-f]{3}$/;

export function normalizeHexColor(value: string): string | null {
  const candidate = value.trim();
  if (SHORT_HEX_COLOR.test(candidate)) {
    return `#${candidate
      .slice(1)
      .split("")
      .map((character) => character.repeat(2))
      .join("")}`.toUpperCase();
  }
  return HEX_COLOR.test(candidate) ? candidate.toUpperCase() : null;
}

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

function parseHex(value: string): Rgb {
  const normalized = normalizeHexColor(value);
  if (!normalized) throw new Error("Invalid hexadecimal color.");
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase();
}

function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  const ratio = Math.min(1, Math.max(0, amount));
  return {
    r: color.r + (target.r - color.r) * ratio,
    g: color.g + (target.g - color.g) * ratio,
    b: color.b + (target.b - color.b) * ratio,
  };
}

export function relativeLuminance(value: string): number {
  const { r, g, b } = parseHex(value);
  const linear = [r, g, b].map((channel) => {
    const component = channel / 255;
    return component <= 0.04045
      ? component / 12.92
      : ((component + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(first: string, second: string): number {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

function contrastingVariant(base: Rgb, surface: string): string {
  const toward = relativeLuminance(surface) > 0.5
    ? { r: 0, g: 0, b: 0 }
    : { r: 255, g: 255, b: 255 };
  for (let amount = 0; amount <= 1; amount += 0.05) {
    const candidate = toHex(mix(base, toward, amount));
    if (contrastRatio(candidate, surface) >= 3) return candidate;
  }
  return toHex(toward);
}

export function createAccentPalette(value: string): AccentPalette {
  const base = parseHex(value);
  const normalized = toHex(base);
  const blackContrast = contrastRatio(normalized, "#000000");
  const whiteContrast = contrastRatio(normalized, "#FFFFFF");
  const foreground = blackContrast >= whiteContrast ? "#000000" : "#FFFFFF";
  const shadeTarget =
    relativeLuminance(normalized) > 0.35
      ? { r: 0, g: 0, b: 0 }
      : { r: 255, g: 255, b: 255 };

  return {
    base: normalized,
    foreground,
    hover: toHex(mix(base, shadeTarget, 0.12)),
    active: toHex(mix(base, shadeTarget, 0.22)),
    soft: toHex(mix(base, { r: 255, g: 255, b: 255 }, 0.88)),
    border: toHex(mix(base, { r: 255, g: 255, b: 255 }, 0.58)),
    disabled: toHex(mix(base, { r: 128, g: 128, b: 128 }, 0.5)),
    ringLight: contrastingVariant(base, "#FFFFFF"),
    ringDark: contrastingVariant(base, "#171717"),
  };
}

export function applyAccentColor(value: string): AccentPalette {
  const palette = createAccentPalette(value);
  const root = document.documentElement;
  const variables: Record<string, string> = {
    "--accent-custom": palette.base,
    "--accent-custom-foreground": palette.foreground,
    "--accent-custom-hover": palette.hover,
    "--accent-custom-active": palette.active,
    "--accent-custom-soft-light": palette.soft,
    "--accent-custom-soft-dark": toHex(
      mix(parseHex(palette.base), { r: 23, g: 23, b: 23 }, 0.78),
    ),
    "--accent-custom-border-light": palette.border,
    "--accent-custom-border-dark": toHex(
      mix(parseHex(palette.base), { r: 23, g: 23, b: 23 }, 0.45),
    ),
    "--accent-custom-disabled": palette.disabled,
    "--primary": palette.base,
    "--primary-foreground": palette.foreground,
    "--sidebar-primary": palette.base,
    "--sidebar-primary-foreground": palette.foreground,
    "--sidebar-accent": "var(--accent-custom-soft)",
    "--chart-1": palette.base,
  };
  Object.entries(variables).forEach(([name, color]) =>
    root.style.setProperty(name, color),
  );
  root.style.setProperty("--accent-ring-light", palette.ringLight);
  root.style.setProperty("--accent-ring-dark", palette.ringDark);
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((element) => element.setAttribute("content", palette.base));
  return palette;
}

export function readCachedAccentColor(): string | null {
  try {
    const cached = window.localStorage.getItem(ACCENT_COLOR_STORAGE_KEY);
    return cached ? normalizeHexColor(cached) : null;
  } catch {
    return null;
  }
}

export function cacheAccentColor(value: string): void {
  const normalized = normalizeHexColor(value);
  if (!normalized) return;
  try {
    window.localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, normalized);
  } catch {
    // Appearance still works when storage is unavailable.
  }
}

export function applyThemeColor(value: string | null): void {
  const root = document.documentElement;
  const names = [
    "--theme-background-light", "--theme-card-light", "--theme-muted-light",
    "--theme-border-light", "--theme-background-dark", "--theme-card-dark",
    "--theme-muted-dark", "--theme-border-dark",
  ];
  const normalized = value ? normalizeHexColor(value) : null;
  if (!normalized) {
    names.forEach((name) => root.style.removeProperty(name));
    return;
  }
  const base = parseHex(normalized);
  const white = { r: 255, g: 255, b: 255 };
  const dark = { r: 15, g: 15, b: 15 };
  const values: Record<string, string> = {
    "--theme-background-light": toHex(mix(base, white, 0.96)),
    "--theme-card-light": toHex(mix(base, white, 0.985)),
    "--theme-muted-light": toHex(mix(base, white, 0.9)),
    "--theme-border-light": toHex(mix(base, white, 0.78)),
    "--theme-background-dark": toHex(mix(base, dark, 0.88)),
    "--theme-card-dark": toHex(mix(base, dark, 0.8)),
    "--theme-muted-dark": toHex(mix(base, dark, 0.68)),
    "--theme-border-dark": toHex(mix(base, dark, 0.5)),
  };
  Object.entries(values).forEach(([name, color]) => root.style.setProperty(name, color));
}

export function readCachedThemeColor(): string | null {
  try {
    const cached = window.localStorage.getItem(THEME_COLOR_STORAGE_KEY);
    return cached ? normalizeHexColor(cached) : null;
  } catch {
    return null;
  }
}

export function cacheThemeColor(value: string | null): void {
  try {
    if (value) {
      const normalized = normalizeHexColor(value);
      if (normalized) window.localStorage.setItem(THEME_COLOR_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(THEME_COLOR_STORAGE_KEY);
    }
  } catch {
    // Appearance still works when storage is unavailable.
  }
}