import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeColorSettings } from "../theme-color-settings";

describe("ThemeColorSettings", () => {
  it("previews and saves a separate theme color", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ThemeColorSettings savedColor={null} isSaving={false} onSave={onSave} />,
    );
    fireEvent.change(screen.getByLabelText("Choose theme color"), {
      target: { value: "#0d9488" },
    });
    expect(screen.getByLabelText("Theme hex color")).toHaveValue("#0D9488");
    fireEvent.click(screen.getByRole("button", { name: /Save theme color/ }));
    expect(onSave).toHaveBeenCalledWith("#0D9488");
  });

  it("resets to the original neutral theme", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <ThemeColorSettings
        savedColor="#2563EB"
        isSaving={false}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Reset theme color/ }));
    fireEvent.click(screen.getByRole("button", { name: /Save theme color/ }));
    expect(onSave).toHaveBeenCalledWith(null);
  });
});
