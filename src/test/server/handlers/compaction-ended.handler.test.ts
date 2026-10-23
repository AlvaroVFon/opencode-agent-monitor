import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { CompactionEndedHandler } from "../../../server/handlers/trace/compaction-ended.handler";
import { AgentTracker } from "../../../server/state/agent-tracker";
import { TraceEventType } from "../../../server/enums";
import { makeCompactionEnded } from "../fixtures/v2-events";

function setup() {
  const writeTrace = mock.fn();
  const agentTracker = new AgentTracker();
  agentTracker.recordSessionAgent("sess-1", "coder");
  return {
    writeTrace,
    agentTracker,
    handler: new CompactionEndedHandler(
      { writeTrace, ensureDir: () => {} } as any,
      agentTracker,
    ),
  };
}

describe("CompactionEndedHandler", () => {
  it("writes an auxiliary llm_call with model and usage", () => {
    const { writeTrace, handler } = setup();

    handler.handle(makeCompactionEnded());

    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.LLM_CALL);
    assert.equal(event.agent, "coder");
    assert.equal(event.model, "anthropic/claude-haiku-4-5");
    assert.equal(event.finish, "auxiliary");
    assert.equal(event.kind, "compaction");
    assert.equal(event.cost, 0.001);
    assert.equal(event.inputTokens, 100);
    assert.equal(event.cacheRead, 10);
    assert.equal(event.durationMs, 0);
  });

  it("uses unknown when the model is absent", () => {
    const { writeTrace, handler } = setup();

    handler.handle(makeCompactionEnded({ model: undefined }));

    assert.equal(writeTrace.mock.calls[0].arguments[0].model, "unknown");
  });
});
