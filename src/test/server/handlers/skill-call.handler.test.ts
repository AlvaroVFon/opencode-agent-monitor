import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { SkillCallHandler } from "../../../server/handlers/trace/skill-call.handler";
import { PartStatus, PartType, TraceEventType } from "../../../shared/enums";

function makePart(overrides: Record<string, unknown> = {}) {
  return {
    part: {
      type: PartType.TOOL,
      sessionID: "sess-1",
      tool: "skill",
      state: {
        status: PartStatus.COMPLETED,
        time: { start: 1000, end: 1300 },
        input: { name: "planner" },
        output: "ok",
        title: "Invoked planner",
      },
      ...overrides,
    },
  };
}

function makeHandler(writeTrace = mock.fn(), writeTraceError = mock.fn()) {
  return new SkillCallHandler({
    writeTrace,
    writeTraceError,
    ensureDir: () => {},
  } as any);
}

describe("SkillCallHandler", () => {
  it("writes a trace when skill completes with timing data", () => {
    const writeTrace = mock.fn();
    const handler = makeHandler(writeTrace);

    handler.handle(makePart());

    assert.equal(writeTrace.mock.calls.length, 1);
    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.SKILL_CALL);
    assert.equal(event.sessionID, "sess-1");
    assert.equal(event.skill, "planner");
    assert.equal(event.status, "completed");
    assert.equal(event.durationMs, 300);
  });

  it("writes a trace with error field when skill errors", () => {
    const writeTrace = mock.fn();
    const handler = makeHandler(writeTrace);

    handler.handle(
      makePart({
        state: {
          status: PartStatus.ERROR,
          time: { start: 1000, end: 1100 },
          input: { name: "planner" },
          error: "skill failed",
        },
      }),
    );

    assert.equal(writeTrace.mock.calls.length, 1);
    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.status, "error");
    assert.equal(event.error, "skill failed");
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

  it("ignores non-skill tool calls", () => {
    const writeTrace = mock.fn();
    const handler = makeHandler(writeTrace);

    handler.handle({
      part: { type: PartType.TOOL, sessionID: "sess-1", tool: "bash" },
    });

    assert.equal(writeTrace.mock.calls.length, 0);
  });

  it("ignores non-tool part types even if tool field is set", () => {
    const writeTrace = mock.fn();
    const handler = makeHandler(writeTrace);

    handler.handle({
      part: { type: PartType.AGENT, name: "planner" },
    });

    assert.equal(writeTrace.mock.calls.length, 0);
  });

  it("sets durationMs to 0 when end time is missing", () => {
    const writeTrace = mock.fn();
    const handler = makeHandler(writeTrace);

    handler.handle(
      makePart({
        state: {
          status: PartStatus.COMPLETED,
          time: { start: 1000 },
          input: { name: "planner" },
        },
      }),
    );

    assert.equal(writeTrace.mock.calls.length, 1);
    assert.equal(writeTrace.mock.calls[0].arguments[0].durationMs, 0);
  });

  it("uses 'unknown' when input.name is missing", () => {
    const writeTrace = mock.fn();
    const handler = makeHandler(writeTrace);

    handler.handle(
      makePart({
        state: {
          status: PartStatus.COMPLETED,
          time: { start: 1000, end: 1100 },
        },
      }),
    );

    assert.equal(writeTrace.mock.calls.length, 1);
    assert.equal(writeTrace.mock.calls[0].arguments[0].skill, "unknown");
  });
});
