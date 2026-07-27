import { describe, expect, it } from "vitest";
import { clientSchema } from "../client.schema";

describe("clientSchema", () => {
  it("requires a client name", () => {
    expect(clientSchema.safeParse({ name: "" }).success).toBe(false);
  });
  it("accepts optional empty fields", () => {
    expect(clientSchema.safeParse({ name: "Acme", websiteUrl: "" }).success).toBe(true);
  });
  it("requires URL protocols and enforces limits", () => {
    expect(clientSchema.safeParse({ name: "Acme", websiteUrl: "example.com" }).success).toBe(false);
    expect(clientSchema.safeParse({ name: "x".repeat(161) }).success).toBe(false);
  });
});
