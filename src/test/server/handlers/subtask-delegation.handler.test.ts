import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { SubtaskDelegationHandler } from "../../../server/handlers/trace/subtask-delegation.handler";
import { TraceEventType } from "../../../server/enums";

describe("SubtaskDelegationHandler", () => {
  it("writes a trace when part type is SUBTASK", () => {
    const writeTrace = mock.fn();
    const handler = new SubtaskDelegationHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle({
      part: {
        type: "subtask",
        sessionID: "sess-1",
        agent: "worker",
        description: "do the thing",
      },
    });

    assert.equal(writeTrace.mock.calls.length, 1);
    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.AGENT_DELEGATION);
    assert.equal(event.sessionID, "sess-1");
    assert.equal(event.childAgent, "worker");
    assert.equal(event.description, "do the thing");
  });

  it("ignores non-SUBTASK part types", () => {
    const writeTrace = mock.fn();
    const handler = new SubtaskDelegationHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle({
      part: { type: "agent", sessionID: "sess-1", name: "planner" },
    });

    assert.equal(writeTrace.mock.calls.length, 0);
  });
});
