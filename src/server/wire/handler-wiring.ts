import { TraceHelper } from "../helpers/trace.helpers";
import { EventType } from "../enums";
import { EventsRegistry } from "../events/events.registry";
import { EventHandler } from "../events/events.handler";
import { SessionCreatedHandler } from "../handlers/session-created.handler";
import { SessionErrorHandler } from "../handlers/session-error.handler";
import { UserMessageHandler } from "../handlers/user-message.handler";
import { LlmErrorHandler } from "../handlers/llm-error.handler";
import { LlmCallHandler } from "../handlers/llm-call.handler";
import { AgentDelegationHandler } from "../handlers/agent-delegation.handler";
import { SubtaskDelegationHandler } from "../handlers/subtask-delegation.handler";
import { ToolCallHandler } from "../handlers/tool-call.handler";

export function createEventHandler(
  traceHelper: TraceHelper,
  currentAgent: Map<string, string>,
): EventHandler {
  const registry = new EventsRegistry();

  registry
    .register(EventType.SESSION_CREATED, new SessionCreatedHandler(traceHelper))
    .register(EventType.SESSION_ERROR, new SessionErrorHandler(traceHelper))
    .register(EventType.MESSAGE_UPDATED, new UserMessageHandler(currentAgent))
    .register(
      EventType.MESSAGE_UPDATED,
      new LlmErrorHandler(traceHelper, currentAgent),
    )
    .register(
      EventType.MESSAGE_UPDATED,
      new LlmCallHandler(traceHelper, currentAgent),
    )
    .register(
      EventType.MESSAGE_PART_UPDATED,
      new AgentDelegationHandler(traceHelper),
    )
    .register(
      EventType.MESSAGE_PART_UPDATED,
      new SubtaskDelegationHandler(traceHelper),
    )
    .register(EventType.MESSAGE_PART_UPDATED, new ToolCallHandler(traceHelper));

  return new EventHandler(traceHelper, registry);
}
