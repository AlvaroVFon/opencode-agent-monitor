import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { SessionErrorHandler } from "../../handlers/session-error.handler";
import { TraceEventType } from "../../enums";

describe("SessionErrorHandler", () => {
  it("writes both trace and traceError on session error", () => {
    const writeTrace = mock.fn();
    const writeTraceError = mock.fn();
    const handler = new SessionErrorHandler({
      writeTrace,
      writeTraceError,
      ensureDir: () => {},
    } as any);

    handler.handle({
      sessionID: "sess-1",
      error: { name: "AuthError", data: { message: "invalid token" } },
    });

    assert.equal(writeTrace.mock.calls.length, 1);
    assert.equal(writeTraceError.mock.calls.length, 1);

    const trace = writeTrace.mock.calls[0].arguments[0];
    assert.equal(trace.type, TraceEventType.SESSION_ERROR);
    assert.equal(trace.sessionID, "sess-1");
    assert.equal(trace.errorType, "AuthError");
    assert.equal(trace.errorMessage, "invalid token");

    const errTrace = writeTraceError.mock.calls[0].arguments[0];
    assert.equal(errTrace.type, TraceEventType.SESSION_ERROR);
    assert.ok(errTrace.error.includes("AuthError"));
  });

  it("handles missing error data gracefully", () => {
    const writeTrace = mock.fn();
    const handler = new SessionErrorHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle({ sessionID: "sess-2", error: {} });

    const trace = writeTrace.mock.calls[0].arguments[0];
    assert.equal(trace.errorType, "unknown");
    assert.equal(trace.errorMessage, "unknown");
  });

  it("handles null sessionID gracefully", () => {
    const writeTrace = mock.fn();
    const handler = new SessionErrorHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle({ error: { name: "Fail" } });

    const trace = writeTrace.mock.calls[0].arguments[0];
    assert.equal(trace.sessionID, null);
  });
});
