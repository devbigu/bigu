import { API_BASE_URL, apiClient } from "@/src/lib/api-client";
import type { Project } from "@/src/features/projects";

export type WorkspaceMessage = {
  id: string;
  senderType: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  status: "PENDING" | "STREAMING" | "COMPLETED" | "FAILED" | "CANCELLED";
  createdAt: string;
};

export type ProjectChangeRequest = {
  id: string;
  fieldName: string;
  oldValue: string | null;
  proposedValue: string;
  explanation?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
};

export type ProjectFile = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  processingStatus: string;
};

export type ProjectInstruction = {
  id: string;
  title: string;
  content: string;
  status: string;
};

export type ProjectWorkspace = {
  project: Project;
  client: NonNullable<Project["client"]>;
  messages: WorkspaceMessage[];
  changeRequests: ProjectChangeRequest[];
  instructions: ProjectInstruction[];
  files: ProjectFile[];
};

const projectPath = (id: string) => `/projects/${encodeURIComponent(id)}`;

export async function getProjectWorkspace(projectId: string) {
  return (
    await apiClient.get<ProjectWorkspace>(`${projectPath(projectId)}/workspace`)
  ).data;
}

export async function sendProjectMessage(projectId: string, content: string) {
  return (
    await apiClient.post(`${projectPath(projectId)}/messages`, { content })
  ).data;
}

export async function reviewProjectChange(
  projectId: string,
  requestId: string,
  input: { action: string; proposedValue?: string; syncSpreadsheet?: boolean },
) {
  return (
    await apiClient.patch(
      `${projectPath(projectId)}/change-requests/${encodeURIComponent(requestId)}`,
      input,
    )
  ).data;
}

export async function uploadProjectFile(projectId: string, file: File) {
  const data = new FormData();
  data.append("file", file);
  return (await apiClient.post(`${projectPath(projectId)}/files`, data)).data;
}

export async function reviewProjectFile(
  projectId: string,
  fileId: string,
  action: "approve" | "reject",
) {
  return (
    await apiClient.patch(
      `${projectPath(projectId)}/files/${encodeURIComponent(fileId)}/${action}`,
    )
  ).data;
}

export type ProjectStreamEvent =
  | { type: "message.created"; message: WorkspaceMessage }
  | { type: "assistant.started"; messageId: string }
  | { type: "assistant.delta"; messageId: string; delta: string }
  | { type: "proposal.created"; proposal: ProjectChangeRequest }
  | { type: "assistant.completed"; message: WorkspaceMessage }
  | {
      type: "assistant.failed" | "assistant.cancelled";
      messageId: string;
      partialContent?: string;
      message: string;
      status: "FAILED" | "CANCELLED";
    };

export async function streamProjectMessage(input: {
  projectId: string;
  content: string;
  signal: AbortSignal;
  onEvent: (event: ProjectStreamEvent) => void;
}): Promise<void> {
  const request = () =>
    fetch(`${API_BASE_URL}${projectPath(input.projectId)}/messages/stream`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      signal: input.signal,
      headers: {
        Accept: "application/x-ndjson",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: input.content }),
    });
  let response = await request();
  if (response.status === 401 && !input.signal.aborted) {
    await apiClient.post("/auth/refresh");
    response = await request();
  }
  if (!response.ok)
    throw new Error(`Chat request failed with status ${response.status}`);
  if (!response.body)
    throw new Error("Streaming response body is unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines)
      if (line.trim()) input.onEvent(parseProjectStreamEvent(line));
    if (done) break;
  }
  if (buffer.trim()) input.onEvent(parseProjectStreamEvent(buffer));
}

function parseProjectStreamEvent(line: string): ProjectStreamEvent {
  const value: unknown = JSON.parse(line);
  if (!value || typeof value !== "object" || !("type" in value))
    throw new Error("Invalid project stream event.");
  const type = (value as { type: unknown }).type;
  if (
    ![
      "message.created",
      "assistant.started",
      "assistant.delta",
      "proposal.created",
      "assistant.completed",
      "assistant.failed",
      "assistant.cancelled",
    ].includes(String(type))
  ) {
    throw new Error("Unknown project stream event.");
  }
  return value as ProjectStreamEvent;
}
