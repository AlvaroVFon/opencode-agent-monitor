import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { SessionErrorHandler } from "../../../server/handlers/trace/session-error.handler";
import { TraceEventType } from "../../../server/enums";
import { makeExecutionFailed } from "../fixtures/v2-events";

function setup() {
  const writeTrace = mock.fn();
  return {
    writeTrace,
    handler: new SessionErrorHandler({
      writeTrace,
      ensureDir: () => {},
    } as any),
  };
}

describe("SessionErrorHandler (V2 execution.failed)", () => {
  it("writes the structured error type and message", () => {
    const { writeTrace, handler } = setup();

    handler.handle(makeExecutionFailed());

    const trace = writeTrace.mock.calls[0].arguments[0];
    assert.equal(trace.type, TraceEventType.SESSION_ERROR);
    assert.equal(trace.sessionID, "sess-1");
    assert.equal(trace.errorType, "provider.invalid-request");
    assert.equal(trace.errorMessage, "bad request");
    assert.equal(trace.timestamp, 1_000);
  });

  it("handles a missing error payload", () => {
    const { writeTrace, handler } = setup();

    handler.handle(makeExecutionFailed({ error: undefined }));

    const trace = writeTrace.mock.calls[0].arguments[0];
    assert.equal(trace.errorType, "unknown");
    assert.equal(trace.errorMessage, "unknown");
  });
});
