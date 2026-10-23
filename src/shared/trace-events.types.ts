import { TraceEventType } from "./enums";

/**
 * Origin of an LLM call. `step` is a regular agent-loop model invocation;
 * `title` and `compaction` are auxiliary requests OpenCode records through
 * `session.usage.recorded` instead of a step.
 */
export type LlmCallKind = "step" | "title" | "compaction";

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
  cacheWrite?: number;
  cost: number;
  durationMs: number;
  timestamp: number;
  /** Assistant message that produced this call (V2 only). */
  messageID?: string;
  /** Where the call came from (V2 only). Absent on schema v1 lines. */
  kind?: LlmCallKind;
};

export type LlmErrorEvent = {
  type: TraceEventType.LLM_ERROR;
  sessionID: string;
  agent: string;
  model: string;
  errorType: string;
  errorMessage: string;
  cost?: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cacheRead?: number;
  cacheWrite?: number;
  timestamp: number;
  /** Assistant message that failed (V2 only). */
  messageID?: string;
  /** `step` for agent-loop failures, `compaction` for summarization failures. */
  kind?: "step" | "compaction";
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
  /** Stable skill identifier (V2 only). */
  skillID?: string;
};

export type SessionCreatedEvent = {
  type: TraceEventType.SESSION_CREATED;
  sessionID: string;
  parentID: string | null;
  timestamp: number;
  /** Agent assigned to the session (V2 only). */
  agent?: string;
  /** Session title, when OpenCode provides one (V2 only). */
  title?: string;
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
  sessionID: string;
  timestamp: number;
  /** Parent session that spawned the delegation (V2 only). */
  parentID?: string;
  /** Session created for the delegated agent (V2 only). */
  childSessionID?: string;
  /** Agent handling the delegated session (V2 only). */
  childAgent?: string;
  /** Optional description provided by the delegating tool (V2 only). */
  description?: string;
};

export type WriteTraceErrorEvent = {
  type: TraceEventType.WRITE_TRACE_ERROR;
  sessionID: string;
  errorType?: string;
  errorMessage?: string;
  timestamp: number;
};

export type TraceEvent =
  | LlmCallEvent
  | LlmErrorEvent
  | ToolCallEvent
  | SkillCallEvent
  | SessionCreatedEvent
  | SessionErrorEvent
  | AgentDelegationEvent;
