"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Focus, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACCENT_COLOR_PRESETS,
  applyAccentColor,
  createAccentPalette,
  DEFAULT_ACCENT_COLOR,
  normalizeHexColor,
} from "../lib/accent-color";

type AccentColorSettingsProps = {
  savedColor?: string | null;
  isSaving: boolean;
  onSave: (accentColor: string) => Promise<void>;
};

export function AccentColorSettings({
  savedColor,
  isSaving,
  onSave,
}: AccentColorSettingsProps) {
  const normalizedSaved =
    normalizeHexColor(savedColor ?? "") ?? DEFAULT_ACCENT_COLOR;
  const [accentColor, setAccentColor] = useState(normalizedSaved);
  const [hexInput, setHexInput] = useState(normalizedSaved);
  const [error, setError] = useState<string | null>(null);
  const palette = useMemo(() => createAccentPalette(accentColor), [accentColor]);

  useEffect(() => {
    applyAccentColor(normalizedSaved);
  }, [normalizedSaved]);

  useEffect(
    () => () => {
      applyAccentColor(normalizedSaved);
    },
    [normalizedSaved],
  );

  function selectColor(value: string) {
    const normalized = normalizeHexColor(value);
    if (!normalized) return;
    setAccentColor(normalized);
    setHexInput(normalized);
    setError(null);
    applyAccentColor(normalized);
  }

  function updateHex(value: string) {
    const display = value.toUpperCase();
    setHexInput(display);
    const normalized = normalizeHexColor(display);
    if (normalized) {
      selectColor(normalized);
      return;
    }
    setError("Enter a 3- or 6-character hexadecimal color, such as #6366F1.");
  }

  function cancel() {
    selectColor(normalizedSaved);
  }

  async function save() {
    try {
      await onSave(accentColor);
    } catch {
      cancel();
    }
  }

  return (
    <section className="border-t pt-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold">Accent color</h3>
        <p className="text-sm text-muted-foreground">
          Customize buttons, selected navigation, links, focus rings, progress
          indicators, and other highlighted elements.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor="accent-color-wheel">Color wheel</Label>
              <input
                id="accent-color-wheel"
                type="color"
                value={accentColor}
                onChange={(event) => selectColor(event.target.value)}
                aria-label="Choose accent color"
                className="h-10 w-16 cursor-pointer rounded-md border bg-background p-1"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="accent-color-hex">Selected color</Label>
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-8 shrink-0 rounded-full border"
                  style={{ backgroundColor: accentColor }}
                />
                <Input
                  id="accent-color-hex"
                  value={hexInput}
                  onChange={(event) => updateHex(event.target.value)}
                  onBlur={() => {
                    const normalized = normalizeHexColor(hexInput);
                    if (normalized) setHexInput(normalized);
                  }}
                  maxLength={7}
                  spellCheck={false}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "accent-color-error" : undefined}
                  className="font-mono uppercase"
                />
              </div>
              {error ? (
                <p id="accent-color-error" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Preset colors</legend>
            <div className="flex flex-wrap gap-2">
              {ACCENT_COLOR_PRESETS.map((preset) => {
                const selected = accentColor === preset.value;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    aria-label={preset.name}
                    aria-pressed={selected}
                    onClick={() => selectColor(preset.value)}
                    className="relative flex size-10 items-center justify-center rounded-full border-2 border-background shadow-sm ring-offset-2 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-pressed:ring-2 aria-pressed:ring-primary"
                    style={{ backgroundColor: preset.value }}
                  >
                    {selected ? (
                      <Check
                        className="size-5"
                        style={{ color: createAccentPalette(preset.value).foreground }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Preview</p>
          <div className="space-y-4 rounded-xl border bg-card p-4 text-card-foreground">
            <div className="rounded-lg bg-accent-custom-soft p-2 font-medium text-primary">
              Selected navigation item
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm">Primary button</Button>
              <Button size="sm" variant="secondary">Secondary button</Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge>Active project</Badge>
              <a href="#accent-preview" className="text-sm font-medium text-primary underline underline-offset-4">
                Example link
              </a>
            </div>
            <div className="flex border-b">
              <span className="border-b-2 border-primary px-2 py-1 text-sm font-medium text-primary">
                Selected tab
              </span>
              <span className="px-2 py-1 text-sm text-muted-foreground">Other</span>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Progress</span><span>72%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full w-[72%] rounded-full bg-primary" />
              </div>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm outline-2 outline-offset-2 outline-ring"
            >
              <Focus className="size-4" /> Visible focus ring
            </button>
            <p className="text-xs text-muted-foreground">
              Button text uses {palette.foreground === "#000000" ? "black" : "white"} for readable contrast.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => selectColor(DEFAULT_ACCENT_COLOR)}
          disabled={isSaving}
        >
          <RotateCcw /> Reset to default
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={cancel}
          disabled={isSaving || accentColor === normalizedSaved}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void save()}
          disabled={isSaving || Boolean(error) || accentColor === normalizedSaved}
        >
          <Save /> {isSaving ? "Saving…" : "Save appearance"}
        </Button>
      </div>
    </section>
  );
}
