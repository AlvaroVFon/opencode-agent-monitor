import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { LlmCallHandler } from "../../../server/handlers/trace/llm-call.handler";
import { StepTracker } from "../../../server/state/step-tracker";
import { AgentTracker } from "../../../server/state/agent-tracker";
import { TraceEventType } from "../../../server/enums";
import { makeStepEnded, makeStepStarted } from "../fixtures/v2-events";

function setup() {
  const writeTrace = mock.fn();
  const stepTracker = new StepTracker();
  const agentTracker = new AgentTracker();
  const handler = new LlmCallHandler(
    { writeTrace, ensureDir: () => {} } as any,
    stepTracker,
    agentTracker,
  );
  return { writeTrace, stepTracker, agentTracker, handler };
}

describe("LlmCallHandler (V2 step.ended)", () => {
  it("writes a trace with agent, model, usage and duration from the step", () => {
    const { writeTrace, stepTracker, agentTracker, handler } = setup();
    const started = makeStepStarted();
    stepTracker.start("msg-1", {
      sessionID: "sess-1",
      agent: started.data.agent,
      model: "anthropic/claude-sonnet-4-5",
      startedAt: 900,
    });
    agentTracker.recordSessionAgent("sess-1", started.data.agent);

    handler.handle(makeStepEnded());

    assert.equal(writeTrace.mock.calls.length, 1);
    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.LLM_CALL);
    assert.equal(event.sessionID, "sess-1");
    assert.equal(event.agent, "coder");
    assert.equal(event.model, "anthropic/claude-sonnet-4-5");
    assert.equal(event.finish, "stop");
    assert.equal(event.inputTokens, 10);
    assert.equal(event.outputTokens, 20);
    assert.equal(event.reasoningTokens, 3);
    assert.equal(event.cacheRead, 4);
    assert.equal(event.cacheWrite, 5);
    assert.equal(event.cost, 0.002);
    assert.equal(event.durationMs, 100);
    assert.equal(event.messageID, "msg-1");
    assert.equal(event.kind, "step");
    assert.equal(event.timestamp, 1_000);
  });

  it("falls back to the session agent when the step start was missed", () => {
    const { writeTrace, agentTracker, handler } = setup();
    agentTracker.recordSessionAgent("sess-1", "planner");

    handler.handle(makeStepEnded());

    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.agent, "planner");
    assert.equal(event.model, "unknown");
    assert.equal(event.durationMs, 0);
  });

  it("defaults missing usage to zero", () => {
    const { writeTrace, handler } = setup();
    handler.handle(makeStepEnded({ tokens: undefined, cost: undefined }));

    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.inputTokens, 0);
    assert.equal(event.cost, 0);
    assert.equal(event.cacheRead, 0);
  });

  it("defaults a missing finish to unknown", () => {
    const { writeTrace, handler } = setup();
    handler.handle(makeStepEnded({ finish: undefined }));

    assert.equal(writeTrace.mock.calls[0].arguments[0].finish, "unknown");
  });
});
