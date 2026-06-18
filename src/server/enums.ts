import { TraceEventType } from "../shared/enums";

export { TraceEventType };

export const UNKNOWN = "unknown";

export enum EventType {
  SESSION_CREATED = "session.created",
  SESSION_ERROR = "session.error",
  MESSAGE_UPDATED = "message.updated",
  MESSAGE_PART_UPDATED = "message.part.updated",
}

export enum Role {
  USER = "user",
  ASSISTANT = "assistant",
}

export enum PartType {
  AGENT = "agent",
  SUBTASK = "subtask",
  TOOL = "tool",
}

export enum PartStatus {
  COMPLETED = "completed",
  ERROR = "error",
}
