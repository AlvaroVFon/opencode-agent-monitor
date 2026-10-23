import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { StepStartedHandler } from "../../../server/handlers/trace/step-started.handler";
import { StepTracker } from "../../../server/state/step-tracker";
import { AgentTracker } from "../../../server/state/agent-tracker";
import { makeStepStarted } from "../fixtures/v2-events";

function setup() {
  const writeTrace = mock.fn();
  const stepTracker = new StepTracker();
  const agentTracker = new AgentTracker();
  return {
    writeTrace,
    stepTracker,
    agentTracker,
    handler: new StepStartedHandler(stepTracker, agentTracker),
  };
}

describe("StepStartedHandler", () => {
  it("records the step and the session agent without writing a trace", () => {
    const { writeTrace, stepTracker, agentTracker, handler } = setup();

    handler.handle(makeStepStarted());

    assert.equal(writeTrace.mock.calls.length, 0);
    assert.deepEqual(stepTracker.peek("msg-1"), {
      sessionID: "sess-1",
      agent: "coder",
      model: "anthropic/claude-sonnet-4-5",
      startedAt: 900,
    });
    assert.equal(agentTracker.agentForSession("sess-1"), "coder");
  });

  it("falls back to unknown agent and model when absent", () => {
    const { stepTracker, handler } = setup();

    handler.handle(makeStepStarted({ agent: undefined, model: undefined }));

    const step = stepTracker.peek("msg-1");
    assert.equal(step?.agent, "unknown");
    assert.equal(step?.model, "unknown");
  });

  it("uses the event timestamp when started is missing", () => {
    const { stepTracker, handler } = setup();

    handler.handle(makeStepStarted({ started: undefined }));

    assert.equal(stepTracker.peek("msg-1")?.startedAt, 1_000);
  });
});
