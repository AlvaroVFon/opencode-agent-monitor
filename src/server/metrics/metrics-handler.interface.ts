import type { GetAgent } from "../handler.interface";
import type { ErrorEntry, TokenUsage } from "../../shared/metrics.types";

export interface MetricsHandler<T = unknown> {
  handle(properties: T, recorder: MetricsRecorder, getAgent?: GetAgent): void;
}

export interface MetricsRecorder {
  recordLlmCall(
    sessionID: string,
    agent: string,
    model: string,
    payload: { tokens: TokenUsage; cost: number },
  ): void;
  recordLlmError(sessionID: string, agent: string, model: string): void;
  recordToolCall(
    sessionID: string,
    agent: string,
    toolName: string,
    isError: boolean,
    durationMs: number,
  ): void;
  recordSessionCreated(sessionID: string): void;
  recordSessionError(sessionID: string, type: string, message: string): void;
  pushError(entry: ErrorEntry): void;
}
