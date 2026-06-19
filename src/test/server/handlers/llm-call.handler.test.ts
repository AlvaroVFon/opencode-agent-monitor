import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { LlmCallHandler } from "../../../server/handlers/trace/llm-call.handler";
import { TraceEventType } from "../../../server/enums";

function makeMsg(overrides: Record<string, unknown> = {}) {
  return {
    info: {
      role: "assistant",
      sessionID: "sess-1",
      finish: "stop",
      tokens: { input: 10, output: 20, reasoning: 0, cache: { read: 0 } },
      providerID: "openai",
      modelID: "gpt-4",
      cost: 0.002,
      time: { created: 1000, completed: 1050 },
      ...overrides,
    },
  };
}

describe("LlmCallHandler", () => {
  it("writes a trace when assistant finishes with tokens", () => {
    const writeTrace = mock.fn();
    const handler = new LlmCallHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    const getAgent = (sID: string) => (sID === "sess-1" ? "coder" : "unknown");
    handler.handle(makeMsg(), getAgent);

    assert.equal(writeTrace.mock.calls.length, 1);
    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.LLM_CALL);
    assert.equal(event.sessionID, "sess-1");
    assert.equal(event.agent, "coder");
    assert.equal(event.model, "openai/gpt-4");
    assert.equal(event.finish, "stop");
    assert.equal(event.inputTokens, 10);
    assert.equal(event.outputTokens, 20);
    assert.equal(event.durationMs, 50);
  });

  it("uses UNKNOWN agent when no getAgent provided", () => {
    const writeTrace = mock.fn();
    const handler = new LlmCallHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle(makeMsg());
    assert.equal(writeTrace.mock.calls[0].arguments[0].agent, "unknown");
  });

  it("ignores non-assistant messages", () => {
    const writeTrace = mock.fn();
    const handler = new LlmCallHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle(makeMsg({ role: "user" }));
    assert.equal(writeTrace.mock.calls.length, 0);
  });

  it("ignores assistant messages without finish", () => {
    const writeTrace = mock.fn();
    const handler = new LlmCallHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle(makeMsg({ finish: undefined }));
    assert.equal(writeTrace.mock.calls.length, 0);
  });

  it("ignores assistant messages without tokens", () => {
    const writeTrace = mock.fn();
    const handler = new LlmCallHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle(makeMsg({ tokens: undefined }));
    assert.equal(writeTrace.mock.calls.length, 0);
  });

  it("skips trace when time.completed is missing", () => {
    const writeTrace = mock.fn();
    const handler = new LlmCallHandler({
      writeTrace,
      writeTraceError: mock.fn(),
      ensureDir: () => {},
    } as any);

    handler.handle(makeMsg({ time: undefined }));
    assert.equal(writeTrace.mock.calls.length, 0);
  });
});
