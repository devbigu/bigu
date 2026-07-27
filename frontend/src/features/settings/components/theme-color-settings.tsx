"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyThemeColor,
  DEFAULT_THEME_COLOR,
  normalizeHexColor,
} from "../lib/accent-color";

type ThemeColorSettingsProps = {
  savedColor?: string | null;
  isSaving: boolean;
  onSave: (themeColor: string | null) => Promise<void>;
};

export function ThemeColorSettings({
  savedColor,
  isSaving,
  onSave,
}: ThemeColorSettingsProps) {
  const saved = normalizeHexColor(savedColor ?? "");
  const [themeColor, setThemeColor] = useState(saved ?? DEFAULT_THEME_COLOR);
  const [hexInput, setHexInput] = useState(saved ?? DEFAULT_THEME_COLOR);
  const [useDefault, setUseDefault] = useState(!saved);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => applyThemeColor(saved), [saved]);
  useEffect(() => () => applyThemeColor(saved), [saved]);

  function selectColor(value: string) {
    const normalized = normalizeHexColor(value);
    if (!normalized) return;
    setThemeColor(normalized);
    setHexInput(normalized);
    setUseDefault(false);
    setError(null);
    applyThemeColor(normalized);
  }

  function updateHex(value: string) {
    const display = value.toUpperCase();
    setHexInput(display);
    const normalized = normalizeHexColor(display);
    if (normalized) selectColor(normalized);
    else setError("Enter a valid hex color, such as #737373.");
  }

  function reset() {
    setThemeColor(DEFAULT_THEME_COLOR);
    setHexInput(DEFAULT_THEME_COLOR);
    setUseDefault(true);
    setError(null);
    applyThemeColor(null);
  }

  async function save() {
    try {
      await onSave(useDefault ? null : themeColor);
    } catch {
      setThemeColor(saved ?? DEFAULT_THEME_COLOR);
      setHexInput(saved ?? DEFAULT_THEME_COLOR);
      setUseDefault(!saved);
      applyThemeColor(saved);
    }
  }

  const unchanged = useDefault ? !saved : themeColor === saved;

  return (
    <section className="border-t pt-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold">Theme color</h3>
        <p className="text-sm text-muted-foreground">
          Tint the app background, cards, sidebar, and neutral surfaces.
        </p>
      </div>
      <div className="flex max-w-md flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="theme-color-wheel">Color wheel</Label>
          <input
            id="theme-color-wheel"
            type="color"
            value={themeColor}
            onChange={(event) => selectColor(event.target.value)}
            aria-label="Choose theme color"
            className="h-10 w-16 cursor-pointer rounded-md border bg-background p-1"
          />
        </div>
        <div className="min-w-44 flex-1 space-y-2">
          <Label htmlFor="theme-color-hex">Theme hex color</Label>
          <Input
            id="theme-color-hex"
            value={hexInput}
            onChange={(event) => updateHex(event.target.value)}
            maxLength={7}
            spellCheck={false}
            aria-invalid={Boolean(error)}
            className="font-mono uppercase"
          />
        </div>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={reset} disabled={isSaving}>
          <RotateCcw /> Reset theme color
        </Button>
        <Button
          type="button"
          onClick={() => void save()}
          disabled={isSaving || Boolean(error) || unchanged}
        >
          <Save /> {isSaving ? "Saving…" : "Save theme color"}
        </Button>
      </div>
    </section>
  );
}
