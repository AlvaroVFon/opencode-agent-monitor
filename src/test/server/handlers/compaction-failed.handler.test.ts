import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { CompactionFailedHandler } from "../../../server/handlers/trace/compaction-failed.handler";
import { AgentTracker } from "../../../server/state/agent-tracker";
import { TraceEventType } from "../../../server/enums";
import { makeCompactionFailed } from "../fixtures/v2-events";

function setup() {
  const writeTrace = mock.fn();
  const agentTracker = new AgentTracker();
  return {
    writeTrace,
    handler: new CompactionFailedHandler(
      { writeTrace, ensureDir: () => {} } as any,
      agentTracker,
    ),
  };
}

describe("CompactionFailedHandler", () => {
  it("writes an llm_error with kind compaction", () => {
    const { writeTrace, handler } = setup();

    handler.handle(
      makeCompactionFailed({
        cost: 0.0002,
        tokens: {
          input: 5,
          output: 0,
          reasoning: 0,
          cache: { read: 0, write: 0 },
        },
      }),
    );

    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.LLM_ERROR);
    assert.equal(event.kind, "compaction");
    assert.equal(event.errorType, "context-overflow");
    assert.equal(event.errorMessage, "too large");
    assert.equal(event.cost, 0.0002);
    assert.equal(event.inputTokens, 5);
  });
});
