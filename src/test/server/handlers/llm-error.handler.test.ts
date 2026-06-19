import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { LlmErrorHandler } from "../../../server/handlers/llm-error.handler";
import { TraceEventType } from "../../../server/enums";

function makeErrorMsg(overrides: Record<string, unknown> = {}) {
  return {
    info: {
      role: "assistant",
      sessionID: "sess-1",
      error: {
        name: "RateLimitError",
        data: { message: "too many requests" },
      },
      providerID: "openai",
      modelID: "gpt-4",
      ...overrides,
    },
  };
}

describe("LlmErrorHandler", () => {
  it("writes trace and traceError when assistant has an error", () => {
    const writeTrace = mock.fn();
    const writeTraceError = mock.fn();
    const handler = new LlmErrorHandler({
      writeTrace,
      writeTraceError,
      ensureDir: () => {},
    } as any);

    const getAgent = (sID: string) => (sID === "sess-1" ? "coder" : "unknown");
    handler.handle(makeErrorMsg(), getAgent);

    assert.equal(writeTrace.mock.calls.length, 1);
    assert.equal(writeTraceError.mock.calls.length, 1);

    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.LLM_ERROR);
    assert.equal(event.sessionID, "sess-1");
    assert.equal(event.agent, "coder");
    assert.equal(event.model, "openai/gpt-4");
    assert.equal(event.errorType, "RateLimitError");
    assert.equal(event.errorMessage, "too many requests");
  });

  it("ignores non-assistant messages", () => {
    const writeTrace = mock.fn();
    const handler = new LlmErrorHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle(makeErrorMsg({ role: "user" }));
    assert.equal(writeTrace.mock.calls.length, 0);
  });

  it("ignores assistant messages without error", () => {
    const writeTrace = mock.fn();
    const handler = new LlmErrorHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle(makeErrorMsg({ error: undefined }));
    assert.equal(writeTrace.mock.calls.length, 0);
  });

  it("ignores assistant messages that have tokens", () => {
    const writeTrace = mock.fn();
    const handler = new LlmErrorHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle(makeErrorMsg({ tokens: { input: 5, output: 10 } }));
    assert.equal(writeTrace.mock.calls.length, 0);
  });

  it("uses UNKNOWN agent when sessionID not resolved", () => {
    const writeTrace = mock.fn();
    const handler = new LlmErrorHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle(makeErrorMsg());
    assert.equal(writeTrace.mock.calls[0].arguments[0].agent, "unknown");
  });
});
