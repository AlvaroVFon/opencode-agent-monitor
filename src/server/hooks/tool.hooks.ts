import { TraceHelper } from "../helpers/trace.helpers";
import { UNKNOWN, TraceEventType } from "../enums";
import type { ToolExecuteAfterEvent, ToolExecuteBeforeEvent } from "../types";

const MAX_PENDING = 1_000;

/**
 * Records tool executions through the V2 tool hooks.
 *
 * The public event stream does not expose tool names (`session.tool.*` only
 * carries the call id), so the hook is the authoritative source for both name
 * and agent. The before-hook timestamp supplies the duration.
 */
export class ToolHookHandler {
  private readonly started = new Map<string, number>();

  constructor(private readonly traceHelper: TraceHelper) {}

  before(event: ToolExecuteBeforeEvent): void {
    this.started.set(event.id, Date.now());
    if (this.started.size > MAX_PENDING) {
      const oldest = this.started.keys().next().value;
      if (oldest !== undefined) this.started.delete(oldest);
    }
  }

  after(event: ToolExecuteAfterEvent): void {
    const start = this.started.get(event.id);
    this.started.delete(event.id);
    const durationMs = start ? Math.max(0, Date.now() - start) : 0;

    this.traceHelper.writeTrace({
      type: TraceEventType.TOOL_CALL,
      sessionID: event.sessionID,
      tool: event.tool,
      callID: event.id,
      status: event.status,
      durationMs,
      ...(event.status === "error"
        ? { error: event.error?.message ?? UNKNOWN }
        : {}),
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.started.clear();
  }
}
