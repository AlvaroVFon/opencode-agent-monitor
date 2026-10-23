import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { SkillCallHandler } from "../../../server/handlers/trace/skill-call.handler";
import { TraceEventType } from "../../../server/enums";
import { makeSkillActivated } from "../fixtures/v2-events";

function setup() {
  const writeTrace = mock.fn();
  return {
    writeTrace,
    handler: new SkillCallHandler({
      writeTrace,
      ensureDir: () => {},
    } as any),
  };
}

describe("SkillCallHandler (V2 skill.activated)", () => {
  it("writes a completed skill call with its identifier", () => {
    const { writeTrace, handler } = setup();

    handler.handle(makeSkillActivated());

    const event = writeTrace.mock.calls[0].arguments[0];
    assert.equal(event.type, TraceEventType.SKILL_CALL);
    assert.equal(event.sessionID, "sess-1");
    assert.equal(event.skill, "Review");
    assert.equal(event.skillID, "review");
    assert.equal(event.status, "completed");
    assert.equal(event.durationMs, 0);
    assert.equal(event.timestamp, 1_000);
  });

  it("falls back to the skill id when the name is empty", () => {
    const { writeTrace, handler } = setup();

    handler.handle(makeSkillActivated({ name: "" }));

    assert.equal(writeTrace.mock.calls[0].arguments[0].skill, "review");
  });
});
