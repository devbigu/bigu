import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  createAccentPalette,
  normalizeHexColor,
} from "../accent-color";

describe("accent color utilities", () => {
  it.each([
    ["#6366F1", "#6366F1"],
    ["#6366f1", "#6366F1"],
    ["#abc", "#AABBCC"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeHexColor(input)).toBe(expected);
  });

  it.each([
    "",
    "6366F1",
    "#GG66F1",
    "url(https://example.com)",
    "var(--primary)",
    "linear-gradient(red, blue)",
  ])("rejects unsafe or invalid input %s", (input) => {
    expect(normalizeHexColor(input)).toBeNull();
  });

  it("chooses the higher-contrast black or white foreground", () => {
    expect(createAccentPalette("#111827").foreground).toBe("#FFFFFF");
    expect(createAccentPalette("#FDE68A").foreground).toBe("#000000");
  });

  it("derives deterministic, bounded palette colors", () => {
    const first = createAccentPalette("#2563EB");
    const second = createAccentPalette("#2563EB");
    expect(first).toEqual(second);
    expect(first.hover).toMatch(/^#[0-9A-F]{6}$/);
    expect(first.active).toMatch(/^#[0-9A-F]{6}$/);
    expect(first.soft).toMatch(/^#[0-9A-F]{6}$/);
    expect(first.border).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("calculates known contrast ratios", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.478, 2);
  });
});
