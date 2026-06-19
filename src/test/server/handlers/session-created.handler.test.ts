import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { SessionCreatedHandler } from "../../../server/handlers/trace/session-created.handler";
import { TraceEventType } from "../../../server/enums";

describe("SessionCreatedHandler", () => {
  it("writes a trace with sessionID and parentID", () => {
    const writeTrace = mock.fn();
    const handler = new SessionCreatedHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle({ info: { id: "sess-1", parentID: "parent-1" } });

    assert.equal(writeTrace.mock.calls.length, 1);
    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.SESSION_CREATED);
    assert.equal(event.sessionID, "sess-1");
    assert.equal(event.parentID, "parent-1");
  });

  it("writes parentID as null when not provided", () => {
    const writeTrace = mock.fn();
    const handler = new SessionCreatedHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle({ info: { id: "sess-2" } });

    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.parentID, null);
  });
});
