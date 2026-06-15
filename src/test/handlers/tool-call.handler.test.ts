import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ToolCallHandler } from "../../handlers/tool-call.handler";
import { TraceEventType } from "../../enums";

function makePart(overrides: Record<string, unknown> = {}) {
  return {
    part: {
      type: "tool",
      sessionID: "sess-1",
      callID: "call-1",
      tool: "bash",
      state: {
        status: "completed",
        time: { start: 1000, end: 1300 },
        output: "ok",
        title: "Ran command",
      },
      ...overrides,
    },
  };
}

function makeHandler(writeTrace = mock.fn(), writeTraceError = mock.fn()) {
  return new ToolCallHandler({
    writeTrace,
    writeTraceError,
    ensureDir: () => {},
  } as any);
}

describe("ToolCallHandler", () => {
  it("writes a trace when tool completes with timing data", () => {
    const writeTrace = mock.fn();
    const handler = makeHandler(writeTrace);

    handler.handle(makePart());

    assert.equal(writeTrace.mock.calls.length, 1);
    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.TOOL_CALL);
    assert.equal(event.sessionID, "sess-1");
    assert.equal(event.tool, "bash");
    assert.equal(event.callID, "call-1");
    assert.equal(event.status, "completed");
    assert.equal(event.durationMs, 300);
  });

  it("writes a trace with error field when tool errors", () => {
    const writeTrace = mock.fn();
    const handler = makeHandler(writeTrace);

    handler.handle(
      makePart({
        state: {
          status: "error",
          time: { start: 1000, end: 1100 },
          error: "command failed",
        },
      }),
    );

    assert.equal(writeTrace.mock.calls.length, 1);
    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.status, "error");
    assert.equal(event.error, "command failed");
    assert.equal(event.durationMs, 100);
  });

  it("ignores pending state", () => {
    const writeTrace = mock.fn();
    const handler = makeHandler(writeTrace);

    handler.handle(
      makePart({
        state: { status: "pending", input: {}, raw: "{}" },
      }),
    );

    assert.equal(writeTrace.mock.calls.length, 0);
  });

  it("ignores running state", () => {
    const writeTrace = mock.fn();
    const handler = makeHandler(writeTrace);

    handler.handle(
      makePart({
        state: {
          status: "running",
          input: {},
          time: { start: 1000 },
        },
      }),
    );

    assert.equal(writeTrace.mock.calls.length, 0);
  });

  it("ignores non-tool part types", () => {
    const writeTrace = mock.fn();
    const handler = makeHandler(writeTrace);

    handler.handle({
      part: { type: "agent", sessionID: "sess-1", name: "planner" },
    });

    assert.equal(writeTrace.mock.calls.length, 0);
  });

  it("sets durationMs to null when end time is missing", () => {
    const writeTrace = mock.fn();
    const handler = makeHandler(writeTrace);

    handler.handle(
      makePart({
        state: { status: "completed", time: { start: 1000 } },
      }),
    );

    assert.equal(writeTrace.mock.calls.length, 1);
    assert.equal(writeTrace.mock.calls[0].arguments[0].durationMs, null);
  });
});
