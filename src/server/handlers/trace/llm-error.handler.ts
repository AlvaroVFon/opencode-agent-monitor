import { TraceHelper } from "../../helpers/trace.helpers";
import { UNKNOWN, TraceEventType } from "../../enums";
import { Handler } from "../../handler.interface";
import { AgentTracker } from "../../state/agent-tracker";
import { StepTracker } from "../../state/step-tracker";
import type { SessionStepFailedEvent } from "../../types";

export class LlmErrorHandler implements Handler<SessionStepFailedEvent> {
  constructor(
    private readonly traceHelper: TraceHelper,
    private readonly stepTracker: StepTracker,
    private readonly agentTracker: AgentTracker,
  ) {}

  handle(event: SessionStepFailedEvent): void {
    const { sessionID, assistantMessageID, error, cost, tokens } = event.data;
    const step = this.stepTracker.take(assistantMessageID);
    const agent =
      step?.agent ?? this.agentTracker.agentForSession(sessionID) ?? UNKNOWN;
    const model = step?.model ?? UNKNOWN;

    this.traceHelper.writeTrace({
      type: TraceEventType.LLM_ERROR,
      sessionID,
      agent,
      model,
      errorType: error?.type ?? UNKNOWN,
      errorMessage: error?.message ?? UNKNOWN,
      ...(cost !== undefined ? { cost } : {}),
      ...(tokens ? this.tokens(tokens) : {}),
      messageID: assistantMessageID,
      kind: "step",
      timestamp: event.created,
    });
  }

  private tokens(tokens: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  }): Record<string, number> {
    return {
      inputTokens: tokens.input ?? 0,
      outputTokens: tokens.output ?? 0,
      reasoningTokens: tokens.reasoning ?? 0,
      cacheRead: tokens.cache?.read ?? 0,
      cacheWrite: tokens.cache?.write ?? 0,
    };
  }
}
