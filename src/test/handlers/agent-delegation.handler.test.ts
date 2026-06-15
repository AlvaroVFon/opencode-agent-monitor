import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { AgentDelegationHandler } from "../../handlers/agent-delegation.handler";
import { TraceEventType } from "../../enums";

describe("AgentDelegationHandler", () => {
  it("writes a trace when part type is AGENT", () => {
    const writeTrace = mock.fn();
    const handler = new AgentDelegationHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle({
      part: { type: "agent", sessionID: "sess-1", name: "planner" },
    });

    assert.equal(writeTrace.mock.calls.length, 1);
    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.AGENT_DELEGATION);
    assert.equal(event.sessionID, "sess-1");
    assert.equal(event.childAgent, "planner");
  });

  it("ignores non-AGENT part types", () => {
    const writeTrace = mock.fn();
    const handler = new AgentDelegationHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle({
      part: { type: "subtask", sessionID: "sess-1", agent: "worker" },
    });

    assert.equal(writeTrace.mock.calls.length, 0);
  });
});
