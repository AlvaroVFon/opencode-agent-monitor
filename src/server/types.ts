import type {
  EventSessionCreated,
  EventSessionError,
  EventMessagePartUpdated,
  AssistantMessage,
  UserMessage,
} from "@opencode-ai/sdk";

export type SessionCreatedProps = EventSessionCreated["properties"];
export type SessionErrorProps = EventSessionError["properties"];

export type MessagePartUpdatedProps = EventMessagePartUpdated["properties"];

// tokens puede faltar en errores de LLM a pesar de que el SDK lo marque como requerido
export type LaxAssistantMessage = Omit<AssistantMessage, "tokens"> & {
  tokens?: AssistantMessage["tokens"] | null;
};
export type MessageUpdatedProps = { info: UserMessage | LaxAssistantMessage };
