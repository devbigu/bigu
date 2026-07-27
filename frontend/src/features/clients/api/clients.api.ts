import { apiClient } from "@/src/lib/api-client";
import type { Client, ClientListFilters, CreateClientInput, UpdateClientInput } from "../types";

export async function getClients(filters: ClientListFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.status) params.set("status", filters.status);
  const response = await apiClient.get<Client[]>(`/clients${params.size ? `?${params}` : ""}`);
  return response.data;
}
export async function getClient(clientId: string) {
  return (await apiClient.get<Client>(`/clients/${encodeURIComponent(clientId)}`)).data;
}
export async function createClient(input: CreateClientInput) {
  return (await apiClient.post<Client>("/clients", input)).data;
}
export async function updateClient(clientId: string, input: UpdateClientInput) {
  return (await apiClient.patch<Client>(`/clients/${encodeURIComponent(clientId)}`, input)).data;
}
export async function archiveClient(clientId: string) {
  return (await apiClient.patch<Client>(`/clients/${encodeURIComponent(clientId)}/archive`)).data;
}
export async function restoreClient(clientId: string) {
  return (await apiClient.patch<Client>(`/clients/${encodeURIComponent(clientId)}/restore`)).data;
}

