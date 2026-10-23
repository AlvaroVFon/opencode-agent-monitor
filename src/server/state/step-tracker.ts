export type StepInfo = {
  sessionID: string;
  agent: string;
  model: string;
  startedAt: number;
};

const MAX_STEPS = 1_000;

/**
 * Correlates `session.step.started` with `session.step.ended` /
 * `session.step.failed`. The started event is the only place V2 exposes the
 * agent and model for a model invocation, while the terminal events carry the
 * usage and finish reason.
 */
export class StepTracker {
  private readonly steps = new Map<string, StepInfo>();

  start(messageID: string, info: StepInfo): void {
    this.steps.set(messageID, info);
    if (this.steps.size > MAX_STEPS) {
      const oldest = this.steps.keys().next().value;
      if (oldest !== undefined) {
        this.steps.delete(oldest);
      }
    }
  }

  take(messageID: string): StepInfo | undefined {
    const info = this.steps.get(messageID);
    this.steps.delete(messageID);
    return info;
  }

  peek(messageID: string): StepInfo | undefined {
    return this.steps.get(messageID);
  }

  clear(): void {
    this.steps.clear();
  }
}
