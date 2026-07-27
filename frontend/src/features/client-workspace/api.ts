import { API_BASE_URL, apiClient } from "@/src/lib/api-client";

export type MessageStatus = "PENDING" | "STREAMING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type WorkspaceMessage = {
  id: string;
  senderType: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  status: MessageStatus;
  createdAt: string;
};
export type ChangeRequest = {
  id: string;
  fieldName: string;
  oldValue: string | null;
  proposedValue: string;
  explanation?: string | null;
  confidence?: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
};
export type ClientFile = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  processingStatus: string;
  storageUrl?: string;
};
export type Workspace = {
  client: { id: string; name: string; industry?: string; status: string };
  messages: WorkspaceMessage[];
  changeRequests: ChangeRequest[];
  instructions: { id: string; title: string; content: string; status: string }[];
  files: ClientFile[];
};

export type ClientMessageStreamEvent =
  | { type: "message.created"; message: WorkspaceMessage }
  | { type: "assistant.started"; messageId: string }
  | { type: "assistant.delta"; messageId: string; delta: string }
  | { type: "proposal.created"; proposal: ChangeRequest }
  | { type: "assistant.completed"; message: WorkspaceMessage }
  | {
      type: "assistant.failed";
      messageId: string;
      code: "AI_RESPONSE_FAILED" | "AI_RESPONSE_CANCELLED";
      message: string;
      partialContent: string;
      status: "FAILED" | "CANCELLED";
    };

const path = (id: string) => `/clients/${encodeURIComponent(id)}`;

export const getWorkspace = async (id: string) =>
  (await apiClient.get<Workspace>(`${path(id)}/workspace`)).data;

export const sendMessage = async (id: string, content: string) =>
  (await apiClient.post(`${path(id)}/messages`, { content })).data;

export async function streamClientMessage(
  id: string,
  content: string,
  options: {
    signal: AbortSignal;
    onEvent: (event: ClientMessageStreamEvent) => void;
  },
) {
  const request = () =>
    fetch(`${API_BASE_URL}${path(id)}/messages/stream`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        accept: "application/x-ndjson",
        "content-type": "application/json",
      },
      body: JSON.stringify({ content }),
      signal: options.signal,
    });

  let response = await request();
  if (response.status === 401 && !options.signal.aborted) {
    await apiClient.post("/auth/refresh");
    response = await request();
  }
  if (!response.ok) {
    throw new Error(await safeResponseMessage(response));
  }
  if (!response.body) throw new Error("The streaming response was unavailable.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminalEvent = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = done ? "" : (lines.pop() ?? "");
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = parseStreamEvent(line);
        options.onEvent(event);
        terminalEvent ||= event.type === "assistant.completed" || event.type === "assistant.failed";
      }
      if (done) break;
    }
    if (buffer.trim()) {
      const event = parseStreamEvent(buffer);
      options.onEvent(event);
      terminalEvent ||= event.type === "assistant.completed" || event.type === "assistant.failed";
    }
  } finally {
    reader.releaseLock();
  }
  if (!terminalEvent && !options.signal.aborted) {
    throw new Error("The response stream ended before completion.");
  }
}

export const reviewChange = async (
  id: string,
  requestId: string,
  input: { action: string; proposedValue?: string; syncSpreadsheet?: boolean },
) =>
  (
    await apiClient.patch(
      `${path(id)}/change-requests/${encodeURIComponent(requestId)}`,
      input,
    )
  ).data;

export const createInstruction = async (
  id: string,
  input: { title: string; content: string },
) => (await apiClient.post(`${path(id)}/instructions`, input)).data;

export const uploadFile = async (id: string, file: File) => {
  const data = new FormData();
  data.append("file", file);
  return (await apiClient.post(`${path(id)}/files`, data)).data;
};

export const reviewFile = async (
  id: string,
  fileId: string,
  action: "approve" | "reject",
) =>
  (
    await apiClient.patch(
      `${path(id)}/files/${encodeURIComponent(fileId)}/${action}`,
    )
  ).data;

function parseStreamEvent(line: string): ClientMessageStreamEvent {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error("BigU received an invalid streaming response.");
  }
  if (!value || typeof value !== "object" || !("type" in value)) {
    throw new Error("BigU received an invalid streaming response.");
  }
  const event = value as Record<string, unknown>;
  const type = event.type;
  if (
    type === "message.created" ||
    type === "assistant.started" ||
    type === "assistant.delta" ||
    type === "proposal.created" ||
    type === "assistant.completed" ||
    type === "assistant.failed"
  ) {
    return value as ClientMessageStreamEvent;
  }
  throw new Error("BigU received an unknown streaming event.");
}

async function safeResponseMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string") return body.message;
  } catch {
    // The backend did not return JSON. Keep the user-facing error generic.
  }
  return "BigU could not start the response. Please try again.";
}