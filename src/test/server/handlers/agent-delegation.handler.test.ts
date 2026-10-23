import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { AgentDelegationHandler } from "../../../server/handlers/trace/agent-delegation.handler";
import { TraceEventType } from "../../../server/enums";
import { makeSessionCreated } from "../fixtures/v2-events";

function setup() {
  const writeTrace = mock.fn();
  return {
    writeTrace,
    handler: new AgentDelegationHandler({
      writeTrace,
      ensureDir: () => {},
    } as any),
  };
}

describe("AgentDelegationHandler (V2 child sessions)", () => {
  it("writes agent_delegation for a session with a parent", () => {
    const { writeTrace, handler } = setup();

    handler.handle(
      makeSessionCreated({
        parentID: "parent-1",
        agent: "worker",
        title: "Implement the fix",
      }),
    );

    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.AGENT_DELEGATION);
    assert.equal(event.sessionID, "sess-1");
    assert.equal(event.parentID, "parent-1");
    assert.equal(event.childSessionID, "sess-1");
    assert.equal(event.childAgent, "worker");
    assert.equal(event.description, "Implement the fix");
  });

  it("ignores root sessions", () => {
    const { writeTrace, handler } = setup();

    handler.handle(makeSessionCreated());

    assert.equal(writeTrace.mock.calls.length, 0);
  });
});
