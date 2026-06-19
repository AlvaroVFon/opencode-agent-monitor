import { TraceHelper } from "../helpers/trace.helpers";
import { EventType } from "../enums";
import { EventsRegistry } from "../events/events.registry";
import { EventHandler } from "../events/events.handler";
import { SessionCreatedHandler } from "../handlers/trace/session-created.handler";
import { SessionErrorHandler } from "../handlers/trace/session-error.handler";
import { UserMessageHandler } from "../handlers/trace/user-message.handler";
import { LlmErrorHandler } from "../handlers/trace/llm-error.handler";
import { LlmCallHandler } from "../handlers/trace/llm-call.handler";
import { AgentDelegationHandler } from "../handlers/trace/agent-delegation.handler";
import { SubtaskDelegationHandler } from "../handlers/trace/subtask-delegation.handler";
import { ToolCallHandler } from "../handlers/trace/tool-call.handler";
import { SkillCallHandler } from "../handlers/trace/skill-call.handler";

export function createEventHandler(
  traceHelper: TraceHelper,
  currentAgent: Map<string, string>,
): EventHandler {
  const registry = new EventsRegistry();

  registry
    .register(EventType.SESSION_CREATED, new SessionCreatedHandler(traceHelper))
    .register(EventType.SESSION_ERROR, new SessionErrorHandler(traceHelper))
    .register(EventType.MESSAGE_UPDATED, new UserMessageHandler(currentAgent))
    .register(EventType.MESSAGE_UPDATED, new LlmErrorHandler(traceHelper))
    .register(EventType.MESSAGE_UPDATED, new LlmCallHandler(traceHelper))
    .register(
      EventType.MESSAGE_PART_UPDATED,
      new AgentDelegationHandler(traceHelper),
    )
    .register(
      EventType.MESSAGE_PART_UPDATED,
      new SubtaskDelegationHandler(traceHelper),
    )
    .register(EventType.MESSAGE_PART_UPDATED, new ToolCallHandler(traceHelper))
    .register(
      EventType.MESSAGE_PART_UPDATED,
      new SkillCallHandler(traceHelper),
    );

  return new EventHandler(traceHelper, registry);
}
