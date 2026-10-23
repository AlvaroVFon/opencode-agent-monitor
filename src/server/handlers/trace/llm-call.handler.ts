import { TraceHelper } from "../../helpers/trace.helpers";
import { UNKNOWN, TraceEventType } from "../../enums";
import { Handler } from "../../handler.interface";
import { AgentTracker } from "../../state/agent-tracker";
import { StepTracker } from "../../state/step-tracker";
import type { SessionStepEndedEvent } from "../../types";

export class LlmCallHandler implements Handler<SessionStepEndedEvent> {
  constructor(
    private readonly traceHelper: TraceHelper,
    private readonly stepTracker: StepTracker,
    private readonly agentTracker: AgentTracker,
  ) {}

  handle(event: SessionStepEndedEvent): void {
    const { sessionID, assistantMessageID, finish, cost, tokens } = event.data;
    const step = this.stepTracker.take(assistantMessageID);
    const agent =
      step?.agent ?? this.agentTracker.agentForSession(sessionID) ?? UNKNOWN;
    const model = step?.model ?? UNKNOWN;
    const durationMs = step ? Math.max(0, event.created - step.startedAt) : 0;

    this.traceHelper.writeTrace({
      type: TraceEventType.LLM_CALL,
      sessionID,
      agent,
      model,
      finish: finish ?? UNKNOWN,
      inputTokens: tokens?.input ?? 0,
      outputTokens: tokens?.output ?? 0,
      reasoningTokens: tokens?.reasoning ?? 0,
      cacheRead: tokens?.cache?.read ?? 0,
      cacheWrite: tokens?.cache?.write ?? 0,
      cost: cost ?? 0,
      durationMs,
      messageID: assistantMessageID,
      kind: "step",
      timestamp: event.created,
    });
  }
}
