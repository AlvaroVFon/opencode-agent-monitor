import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { LlmErrorHandler } from "../../../server/handlers/trace/llm-error.handler";
import { StepTracker } from "../../../server/state/step-tracker";
import { AgentTracker } from "../../../server/state/agent-tracker";
import { TraceEventType } from "../../../server/enums";
import { makeStepFailed, makeStepStarted } from "../fixtures/v2-events";

function setup() {
  const writeTrace = mock.fn();
  const stepTracker = new StepTracker();
  const agentTracker = new AgentTracker();
  const handler = new LlmErrorHandler(
    { writeTrace, ensureDir: () => {} } as any,
    stepTracker,
    agentTracker,
  );
  return { writeTrace, stepTracker, agentTracker, handler };
}

describe("LlmErrorHandler (V2 step.failed)", () => {
  it("writes an llm_error with agent, model and error details", () => {
    const { writeTrace, stepTracker, agentTracker, handler } = setup();
    const started = makeStepStarted();
    stepTracker.start("msg-1", {
      sessionID: "sess-1",
      agent: started.data.agent,
      model: "anthropic/claude-sonnet-4-5",
      startedAt: 900,
    });
    agentTracker.recordSessionAgent("sess-1", started.data.agent);

    handler.handle(makeStepFailed());

    assert.equal(writeTrace.mock.calls.length, 1);
    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.LLM_ERROR);
    assert.equal(event.agent, "coder");
    assert.equal(event.model, "anthropic/claude-sonnet-4-5");
    assert.equal(event.errorType, "rate-limit");
    assert.equal(event.errorMessage, "too many requests");
    assert.equal(event.kind, "step");
    assert.equal(event.messageID, "msg-1");
  });

  it("includes usage when the failed step reported it", () => {
    const { writeTrace, handler } = setup();
    handler.handle(
      makeStepFailed({
        cost: 0.0005,
        tokens: {
          input: 7,
          output: 1,
          reasoning: 0,
          cache: { read: 2, write: 0 },
        },
      }),
    );

    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.cost, 0.0005);
    assert.equal(event.inputTokens, 7);
    assert.equal(event.cacheRead, 2);
  });

  it("uses unknown when the error is missing", () => {
    const { writeTrace, handler } = setup();
    handler.handle(makeStepFailed({ error: undefined }));

    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.errorType, "unknown");
    assert.equal(event.errorMessage, "unknown");
  });
});
