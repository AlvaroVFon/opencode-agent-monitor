export const UNKNOWN = "unknown";

export enum TraceEventType {
  SESSION_CREATED = "session_created",
  SESSION_ERROR = "session_error",
  LLM_ERROR = "llm_error",
  LLM_CALL = "llm_call",
  TOOL_CALL = "tool_call",
  AGENT_DELEGATION = "agent_delegation",
  WRITE_TRACE_ERROR = "write_trace_error",
}

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
