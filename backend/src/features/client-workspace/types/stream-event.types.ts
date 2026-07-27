export type StreamMessage = {
  id: string;
  senderType: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  status: 'PENDING' | 'STREAMING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: Date;
};

export type StreamProposal = {
  id: string;
  fieldName: string;
  oldValue: string | null;
  proposedValue: string;
  explanation: string | null;
  confidence: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
};

export type ClientMessageStreamEvent =
  | { type: 'message.created'; message: StreamMessage }
  | { type: 'assistant.started'; messageId: string }
  | { type: 'assistant.delta'; messageId: string; delta: string }
  | { type: 'proposal.created'; proposal: StreamProposal }
  | { type: 'assistant.completed'; message: StreamMessage }
  | {
      type: 'assistant.failed';
      messageId: string;
      code: 'AI_RESPONSE_FAILED' | 'AI_RESPONSE_CANCELLED';
      message: string;
      partialContent: string;
      status: 'FAILED' | 'CANCELLED';
    };
