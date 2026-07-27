import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../manifest";

describe("platform upgrade configuration", () => {
  it("uses the native system font while preserving a monospace stack", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toContain("system-ui, -apple-system, BlinkMacSystemFont");
    expect(css).toContain("--font-mono: ui-monospace");
    expect(css).not.toContain("font-geist");
  });

  it("publishes installable manifest metadata and maskable icons", () => {
    const value = manifest();
    expect(value).toMatchObject({
      name: "BigU",
      short_name: "BigU",
      start_url: "/dashboard",
      scope: "/",
      display: "standalone",
    });
    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192" }),
        expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
      ]),
    );
  });

  it("keeps authenticated APIs and chat streams out of service-worker caches", () => {
    const worker = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
    expect(worker).toContain('request.method !== "GET"');
    expect(worker).toContain('"/api/"');
    expect(worker).toContain('fetch(request, { cache: "no-store" })');
    expect(worker).not.toContain("/clients/*/messages");
  });
});