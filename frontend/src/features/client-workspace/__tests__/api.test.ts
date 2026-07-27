import { describe, expect, it, vi } from "vitest";
import { streamClientMessage, type ClientMessageStreamEvent } from "../api";

describe("streamClientMessage", () => {
  it("parses NDJSON events progressively in network order", async () => {
    const encoder = new TextEncoder();
    const events = [
      { type: "assistant.started", messageId: "assistant-1" },
      { type: "assistant.delta", messageId: "assistant-1", delta: "Hel" },
      { type: "assistant.delta", messageId: "assistant-1", delta: "lo" },
      {
        type: "assistant.completed",
        message: {
          id: "assistant-1",
          senderType: "ASSISTANT",
          content: "Hello",
          status: "COMPLETED",
          createdAt: new Date().toISOString(),
        },
      },
    ];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`${JSON.stringify(events[0])}\n${JSON.stringify(events[1]).slice(0, 30)}`));
        controller.enqueue(
          encoder.encode(`${JSON.stringify(events[1]).slice(30)}\n${JSON.stringify(events[2])}\n${JSON.stringify(events[3])}\n`),
        );
        controller.close();
      },
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(body, { status: 200 }));
    const received: ClientMessageStreamEvent[] = [];

    await streamClientMessage("client-1", "Hello", {
      signal: new AbortController().signal,
      onEvent: (event) => received.push(event),
    });

    expect(received.map((event) => event.type)).toEqual([
      "assistant.started",
      "assistant.delta",
      "assistant.delta",
      "assistant.completed",
    ]);
    expect(
      received
        .filter((event) => event.type === "assistant.delta")
        .map((event) => event.delta)
        .join(""),
    ).toBe("Hello");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/clients/client-1/messages/stream"),
      expect.objectContaining({ method: "POST", cache: "no-store", credentials: "include" }),
    );
  });

  it("propagates cancellation through the supplied AbortSignal", async () => {
    const controller = new AbortController();
    vi.spyOn(globalThis, "fetch").mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      });
    });
    const request = streamClientMessage("client-1", "Hello", {
      signal: controller.signal,
      onEvent: () => undefined,
    });
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });
});