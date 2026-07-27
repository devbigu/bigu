import { AxiosAdapter, AxiosResponse } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../api-client";

describe("apiClient refresh retry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as { window?: Window }).window;
  });

  it("refreshes once and retries the original 401 request", async () => {
    const calls: string[] = [];
    const adapter: AxiosAdapter = async (config) => {
      calls.push(config.url ?? "");

      if (config.url === "/auth/me" && calls.filter((url) => url === "/auth/me").length === 1) {
        return Promise.reject({ response: { status: 401 }, config });
      }

      return {
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      } as AxiosResponse;
    };

    apiClient.defaults.adapter = adapter;

    await expect(apiClient.get("/auth/me")).resolves.toMatchObject({ status: 200 });
    expect(calls).toEqual(["/auth/me", "/auth/refresh", "/auth/me"]);
  });

  it("does not refresh login failures", async () => {
    const calls: string[] = [];
    apiClient.defaults.adapter = async (config) => {
      calls.push(config.url ?? "");
      return Promise.reject({ response: { status: 401 }, config });
    };

    await expect(apiClient.post("/auth/login", {})).rejects.toBeTruthy();
    expect(calls).toEqual(["/auth/login"]);
  });
});