import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/src/lib/api-client";
import { archiveClient, createClient, getClients, restoreClient } from "../clients.api";

vi.mock("@/src/lib/api-client", () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));

describe("clients API", () => {
  beforeEach(() => vi.clearAllMocks());
  it("builds non-empty list filters safely", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    await getClients({ search: " food ", status: "ARCHIVED" });
    expect(apiClient.get).toHaveBeenCalledWith("/clients?search=food&status=ARCHIVED");
  });
  it("creates and changes status using client endpoints", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { id: "1" } });
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: "1" } });
    await createClient({ name: "Acme" }); await archiveClient("1"); await restoreClient("1");
    expect(apiClient.post).toHaveBeenCalledWith("/clients", { name: "Acme" });
    expect(apiClient.patch).toHaveBeenCalledWith("/clients/1/archive");
    expect(apiClient.patch).toHaveBeenCalledWith("/clients/1/restore");
  });
});
