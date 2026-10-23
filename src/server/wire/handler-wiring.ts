import { TraceHelper } from "../helpers/trace.helpers";
import { EventType } from "../enums";
import { EventsRegistry } from "../events/events.registry";
import { EventHandler } from "../events/events.handler";
import { AgentTracker } from "../state/agent-tracker";
import { StepTracker } from "../state/step-tracker";
import { AgentDelegationHandler } from "../handlers/trace/agent-delegation.handler";
import { AgentSelectedHandler } from "../handlers/trace/agent-selected.handler";
import { CompactionEndedHandler } from "../handlers/trace/compaction-ended.handler";
import { CompactionFailedHandler } from "../handlers/trace/compaction-failed.handler";
import { LlmCallHandler } from "../handlers/trace/llm-call.handler";
import { LlmErrorHandler } from "../handlers/trace/llm-error.handler";
import { SessionCreatedHandler } from "../handlers/trace/session-created.handler";
import { SessionErrorHandler } from "../handlers/trace/session-error.handler";
import { SkillCallHandler } from "../handlers/trace/skill-call.handler";
import { StepStartedHandler } from "../handlers/trace/step-started.handler";

export function createEventHandler(traceHelper: TraceHelper): EventHandler {
  const stepTracker = new StepTracker();
  const agentTracker = new AgentTracker();
  const registry = new EventsRegistry();

  registry
    .register(EventType.SESSION_CREATED, new SessionCreatedHandler(traceHelper))
    .register(
      EventType.SESSION_CREATED,
      new AgentDelegationHandler(traceHelper),
    )
    .register(
      EventType.SESSION_EXECUTION_FAILED,
      new SessionErrorHandler(traceHelper),
    )
    .register(
      EventType.SESSION_AGENT_SELECTED,
      new AgentSelectedHandler(agentTracker),
    )
    .register(
      EventType.SESSION_STEP_STARTED,
      new StepStartedHandler(stepTracker, agentTracker),
    )
    .register(
      EventType.SESSION_STEP_ENDED,
      new LlmCallHandler(traceHelper, stepTracker, agentTracker),
    )
    .register(
      EventType.SESSION_STEP_FAILED,
      new LlmErrorHandler(traceHelper, stepTracker, agentTracker),
    )
    .register(
      EventType.SESSION_COMPACTION_ENDED,
      new CompactionEndedHandler(traceHelper, agentTracker),
    )
    .register(
      EventType.SESSION_COMPACTION_FAILED,
      new CompactionFailedHandler(traceHelper, agentTracker),
    )
    .register(
      EventType.SESSION_SKILL_ACTIVATED,
      new SkillCallHandler(traceHelper),
    );

  return new EventHandler(registry);
}
