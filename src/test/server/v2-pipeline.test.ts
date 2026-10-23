import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TraceHelper } from "../../server/helpers/trace.helpers";
import { ToolHookHandler } from "../../server/hooks/tool.hooks";
import { createEventHandler } from "../../server/wire/handler-wiring";
import { TraceEventType } from "../../shared/enums";
import {
  makeAgentSelected,
  makeCompactionEnded,
  makeSessionCreated,
  makeSkillActivated,
  makeStepEnded,
  makeStepFailed,
  makeStepStarted,
  makeToolEvent,
} from "./fixtures/v2-events";

function delay(ms = 60) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readEvents(path: string) {
  return readFileSync(path, "utf-8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

describe("V2 event pipeline", () => {
  it("produces a schema v2 trace from a realistic event sequence", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-monitor-pipeline-"));
    const traceHelper = new TraceHelper(dir);
    const handler = createEventHandler(traceHelper);
    const toolHandler = new ToolHookHandler(traceHelper);

    handler.handle(makeAgentSelected() as any);
    handler.handle(makeSessionCreated() as any);
    handler.handle(makeStepStarted() as any);
    handler.handle(makeStepEnded() as any);
    handler.handle(
      makeStepStarted({ assistantMessageID: "msg-2", started: 1_100 }) as any,
    );
    handler.handle(
      makeStepFailed({
        assistantMessageID: "msg-2",
        error: { type: "rate-limit", message: "slow down" },
      }) as any,
    );
    handler.handle(makeCompactionEnded() as any);
    handler.handle(makeSkillActivated() as any);

    toolHandler.before(makeToolEvent("completed"));
    toolHandler.after(makeToolEvent("completed"));
    toolHandler.before(makeToolEvent("error", { id: "call-2" }));
    toolHandler.after(makeToolEvent("error", { id: "call-2" }));

    traceHelper.close();
    await delay();

    const events = readEvents(join(dir, "sess-1.jsonl"));
    assert.deepEqual(
      events.map((event) => event.type),
      [
        TraceEventType.SESSION_CREATED,
        TraceEventType.LLM_CALL,
        TraceEventType.LLM_ERROR,
        TraceEventType.LLM_CALL,
        TraceEventType.SKILL_CALL,
        TraceEventType.TOOL_CALL,
        TraceEventType.TOOL_CALL,
      ],
    );

    const [sessionCreated, llmCall, llmError, compaction, skill] = events;
    assert.equal(sessionCreated.parentID, null);
    assert.equal(sessionCreated.agent, "coder");
    assert.equal(llmCall.kind, "step");
    assert.equal(llmCall.model, "anthropic/claude-sonnet-4-5");
    assert.equal(llmError.errorType, "rate-limit");
    assert.equal(llmError.kind, "step");
    assert.equal(compaction.kind, "compaction");
    assert.equal(skill.skillID, "review");
    assert(events.every((event) => event.schemaVersion === 2));
  });

  it("routes delegated child sessions to the parent trace file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-monitor-delegation-"));
    const traceHelper = new TraceHelper(dir);
    const handler = createEventHandler(traceHelper);

    handler.handle(makeSessionCreated() as any);
    handler.handle(
      makeSessionCreated({
        sessionID: "child-1",
        parentID: "sess-1",
        agent: "worker",
        title: "Investigate",
      }) as any,
    );

    traceHelper.close();
    await delay();

    assert.equal(existsSync(join(dir, "child-1.jsonl")), false);

    const events = readEvents(join(dir, "sess-1.jsonl"));
    assert.deepEqual(
      events.map((event) => event.type),
      [
        TraceEventType.SESSION_CREATED,
        TraceEventType.SESSION_CREATED,
        TraceEventType.AGENT_DELEGATION,
      ],
    );

    const delegation = events[2];
    assert.equal(delegation.parentID, "sess-1");
    assert.equal(delegation.childSessionID, "child-1");
    assert.equal(delegation.childAgent, "worker");
  });
});
