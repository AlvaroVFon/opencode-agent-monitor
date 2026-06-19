import { TraceEventType } from "./enums";

export type LlmCallEvent = {
  type: TraceEventType.LLM_CALL;
  sessionID: string;
  agent: string;
  model: string;
  finish: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
  cost: number;
  durationMs: number;
  timestamp: number;
};

export type ToolCallEvent = {
  type: TraceEventType.TOOL_CALL;
  sessionID: string;
  tool: string;
  callID: string;
  status: "completed" | "error";
  durationMs: number;
  error?: string;
  timestamp: number;
};

export type SkillCallEvent = {
  type: TraceEventType.SKILL_CALL;
  sessionID: string;
  skill: string;
  status: "completed" | "error";
  durationMs: number;
  error?: string;
  timestamp: number;
};

export type SessionCreatedEvent = {
  type: TraceEventType.SESSION_CREATED;
  sessionID: string;
  parentID: string | null;
  timestamp: number;
};

export type SessionErrorEvent = {
  type: TraceEventType.SESSION_ERROR;
  sessionID: string;
  errorType?: string;
  errorMessage?: string;
  error?: string;
  timestamp: number;
};

export type AgentDelegationEvent = {
  type: TraceEventType.AGENT_DELEGATION;
  timestamp: number;
  [key: string]: unknown;
};

export type TraceEvent =
  | LlmCallEvent
  | ToolCallEvent
  | SkillCallEvent
  | SessionCreatedEvent
  | SessionErrorEvent
  | AgentDelegationEvent;
