import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccentColorSettings } from "../accent-color-settings";

describe("AccentColorSettings", () => {
  it("renders the native picker, synchronized hex field, presets, and preview", () => {
    render(
      <AccentColorSettings
        savedColor="#2563EB"
        isSaving={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Choose accent color")).toHaveValue("#2563eb");
    expect(screen.getByLabelText("Selected color")).toHaveValue("#2563EB");
    expect(screen.getByRole("button", { name: "Blue" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Primary button")).toBeInTheDocument();
  });

  it("updates from presets and saves only when requested", () => {
    const onSave = vi.fn();
    render(
      <AccentColorSettings
        savedColor="#6366F1"
        isSaving={false}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Green" }));
    expect(screen.getByLabelText("Selected color")).toHaveValue("#16A34A");
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save appearance" }));
    expect(onSave).toHaveBeenCalledWith("#16A34A");
  });

  it("rejects arbitrary CSS and restores the default draft", () => {
    render(
      <AccentColorSettings
        savedColor="#2563EB"
        isSaving={false}
        onSave={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Selected color"), {
      target: { value: "var(--x)" },
    });
    expect(screen.getByText(/Enter a 3- or 6-character/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reset to default/ }));
    expect(screen.getByLabelText("Selected color")).toHaveValue("#6366F1");
  });
});
