import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { SessionCreatedHandler } from "../../../server/handlers/trace/session-created.handler";
import { TraceEventType } from "../../../server/enums";
import { makeSessionCreated } from "../fixtures/v2-events";

function setup() {
  const writeTrace = mock.fn();
  return {
    writeTrace,
    handler: new SessionCreatedHandler({
      writeTrace,
      ensureDir: () => {},
    } as any),
  };
}

describe("SessionCreatedHandler (V2)", () => {
  it("writes sessionID, parentID, agent and title", () => {
    const { writeTrace, handler } = setup();

    handler.handle(
      makeSessionCreated({
        parentID: "parent-1",
        agent: "worker",
        title: "Investigate",
      }),
    );

    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.SESSION_CREATED);
    assert.equal(event.sessionID, "sess-1");
    assert.equal(event.parentID, "parent-1");
    assert.equal(event.agent, "worker");
    assert.equal(event.title, "Investigate");
    assert.equal(event.timestamp, 1_000);
  });

  it("writes parentID as null for root sessions", () => {
    const { writeTrace, handler } = setup();

    handler.handle(makeSessionCreated());

    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.parentID, null);
    assert.equal(event.agent, "coder");
  });
});
