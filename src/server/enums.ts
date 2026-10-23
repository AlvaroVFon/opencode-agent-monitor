import { TraceEventType } from "../shared/enums";

export { TraceEventType };

export const UNKNOWN = "unknown";

/** OpenCode V2 server events consumed by the trace pipeline. */
export enum EventType {
  SESSION_CREATED = "session.created",
  SESSION_EXECUTION_FAILED = "session.execution.failed",
  SESSION_AGENT_SELECTED = "session.agent.selected",
  SESSION_STEP_STARTED = "session.step.started",
  SESSION_STEP_ENDED = "session.step.ended",
  SESSION_STEP_FAILED = "session.step.failed",
  SESSION_COMPACTION_ENDED = "session.compaction.ended",
  SESSION_COMPACTION_FAILED = "session.compaction.failed",
  SESSION_SKILL_ACTIVATED = "session.skill.activated",
}
