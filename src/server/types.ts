import type { OpenCodeEvent } from "@opencode/client";

export type { OpenCodeEvent };

/**
 * Minimal structural views over the OpenCode V2 event union.
 *
 * Handlers only depend on the fields they consume. `Extract` keeps each view
 * in sync with the published client types, so a V2 contract change surfaces as
 * a type error during `tsc --noEmit`.
 */

export type SessionCreatedEvent = Extract<
  OpenCodeEvent,
  { type: "session.created" }
>;

export type SessionExecutionFailedEvent = Extract<
  OpenCodeEvent,
  { type: "session.execution.failed" }
>;

export type SessionAgentSelectedEvent = Extract<
  OpenCodeEvent,
  { type: "session.agent.selected" }
>;

export type SessionStepStartedEvent = Extract<
  OpenCodeEvent,
  { type: "session.step.started" }
>;

export type SessionStepEndedEvent = Extract<
  OpenCodeEvent,
  { type: "session.step.ended" }
>;

export type SessionStepFailedEvent = Extract<
  OpenCodeEvent,
  { type: "session.step.failed" }
>;

export type SessionCompactionEndedEvent = Extract<
  OpenCodeEvent,
  { type: "session.compaction.ended" }
>;

export type SessionCompactionFailedEvent = Extract<
  OpenCodeEvent,
  { type: "session.compaction.failed" }
>;

export type SessionSkillActivatedEvent = Extract<
  OpenCodeEvent,
  { type: "session.skill.activated" }
>;

/**
 * Tool lifecycle payloads delivered through `ctx.tool.hook(...)`. The plugin
 * runtime types these inline, so they are mirrored here to keep handlers
 * independent from the host import.
 */
export type ToolExecuteBeforeEvent = {
  readonly tool: string;
  readonly sessionID: string;
  readonly agent: string;
  readonly messageID: string;
  readonly id: string;
  readonly input: unknown;
};

export type ToolExecuteAfterEvent = {
  readonly tool: string;
  readonly sessionID: string;
  readonly agent: string;
  readonly messageID: string;
  readonly id: string;
  readonly input: unknown;
} & (
  | { readonly status: "completed"; result: unknown }
  | { readonly status: "error"; error: { readonly message?: string } }
);
