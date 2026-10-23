import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ToolHookHandler } from "../../../server/hooks/tool.hooks";
import { TraceEventType } from "../../../server/enums";
import { makeToolEvent } from "../fixtures/v2-events";

function setup() {
  const writeTrace = mock.fn();
  return {
    writeTrace,
    handler: new ToolHookHandler({ writeTrace, ensureDir: () => {} } as any),
  };
}

describe("ToolHookHandler", () => {
  it("writes a completed tool call after the hook", () => {
    const { writeTrace, handler } = setup();

    handler.before(makeToolEvent("completed"));
    handler.after(makeToolEvent("completed"));

    assert.equal(writeTrace.mock.calls.length, 1);
    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.TOOL_CALL);
    assert.equal(event.sessionID, "sess-1");
    assert.equal(event.tool, "bash");
    assert.equal(event.callID, "call-1");
    assert.equal(event.status, "completed");
    assert.ok(event.durationMs >= 0);
    assert.equal(event.error, undefined);
  });

  it("writes the error message when the tool fails", () => {
    const { writeTrace, handler } = setup();

    handler.before(makeToolEvent("error"));
    handler.after(makeToolEvent("error"));

    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.status, "error");
    assert.equal(event.error, "command failed");
  });

  it("defaults duration to 0 when the before hook was missed", () => {
    const { writeTrace, handler } = setup();

    handler.after(makeToolEvent("completed"));

    assert.equal(writeTrace.mock.calls[0].arguments[0].durationMs, 0);
  });

  it("clears pending timers", () => {
    const { writeTrace, handler } = setup();

    handler.before(makeToolEvent("completed"));
    handler.clear();
    handler.after(makeToolEvent("completed"));

    assert.equal(writeTrace.mock.calls[0].arguments[0].durationMs, 0);
  });
});
