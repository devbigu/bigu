import { apiClient } from "@/src/lib/api-client";

export type SpreadsheetState =
  | "NOT_CONFIGURED"
  | "CREATING"
  | "PENDING"
  | "SYNCING"
  | "SYNCED"
  | "FAILED"
  | "CONFLICT";

export type ProjectSpreadsheetStatus = {
  state: SpreadsheetState;
  providerConfigured: boolean;
  workbook: {
    id: string;
    name: string;
    externalUrl: string | null;
    status: string;
  } | null;
  worksheet: {
    id: string;
    name: string;
    externalUrl: string | null;
    status: string;
    lastSyncedAt: string | null;
  } | null;
};

export type ClientSpreadsheetStatus = {
  state: SpreadsheetState;
  providerConfigured: boolean;
  workbook: {
    id: string;
    name: string;
    externalUrl: string | null;
    status: string;
    lastSyncedAt: string | null;
    worksheetCount: number;
  } | null;
  projects: Array<{
    projectId: string;
    projectName: string;
    projectType: string | null;
    projectStatus: string;
    worksheetName: string;
    worksheetStatus: string;
    worksheetUrl: string | null;
    lastSyncedAt: string | null;
  }>;
};

export type SpreadsheetSyncJob = {
  id: string;
  sourceType: string;
  operation: string;
  status: string;
  attempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

const projectPath = (id: string) => `/projects/${encodeURIComponent(id)}`;
const clientPath = (id: string) => `/clients/${encodeURIComponent(id)}`;

export async function getProjectSpreadsheet(projectId: string) {
  return (
    await apiClient.get<ProjectSpreadsheetStatus>(
      `${projectPath(projectId)}/spreadsheet`,
    )
  ).data;
}

export async function syncProjectSpreadsheet(projectId: string) {
  return (
    await apiClient.post(`${projectPath(projectId)}/spreadsheet/sync`)
  ).data;
}

export async function getProjectSpreadsheetJobs(projectId: string) {
  return (
    await apiClient.get<SpreadsheetSyncJob[]>(
      `${projectPath(projectId)}/spreadsheet/sync-jobs`,
    )
  ).data;
}

export async function getClientSpreadsheet(clientId: string) {
  return (
    await apiClient.get<ClientSpreadsheetStatus>(
      `${clientPath(clientId)}/spreadsheet`,
    )
  ).data;
}

export async function createClientSpreadsheet(clientId: string) {
  return (
    await apiClient.post(`${clientPath(clientId)}/spreadsheet/create`)
  ).data;
}

export async function syncClientSpreadsheet(clientId: string) {
  return (
    await apiClient.post(`${clientPath(clientId)}/spreadsheet/sync`)
  ).data;
}

export async function downloadProjectSpreadsheet(projectId: string) {
  const response = await apiClient.get<ArrayBuffer>(
    `${projectPath(projectId)}/export.xlsx`,
    { responseType: "arraybuffer" },
  );
  return new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
