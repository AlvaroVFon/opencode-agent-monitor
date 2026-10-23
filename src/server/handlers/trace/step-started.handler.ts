import { UNKNOWN } from "../../enums";
import { Handler } from "../../handler.interface";
import { AgentTracker } from "../../state/agent-tracker";
import { StepTracker } from "../../state/step-tracker";
import type { SessionStepStartedEvent } from "../../types";

/**
 * Records the agent/model/start time for a model invocation. It intentionally
 * emits no trace event: `session.step.ended`/`failed` produce the recorded
 * call, and writing a second line would double count.
 */
export class StepStartedHandler implements Handler<SessionStepStartedEvent> {
  constructor(
    private readonly stepTracker: StepTracker,
    private readonly agentTracker: AgentTracker,
  ) {}

  handle(event: SessionStepStartedEvent): void {
    const { sessionID, assistantMessageID, agent, model, started } = event.data;
    const agentID = agent || UNKNOWN;

    this.stepTracker.start(assistantMessageID, {
      sessionID,
      agent: agentID,
      model: this.formatModel(model),
      startedAt: started || event.created,
    });
    this.agentTracker.recordSessionAgent(sessionID, agentID);
  }

  private formatModel(model: { providerID?: string; id?: string }): string {
    if (!model?.providerID || !model?.id) return UNKNOWN;
    return `${model.providerID}/${model.id}`;
  }
}
