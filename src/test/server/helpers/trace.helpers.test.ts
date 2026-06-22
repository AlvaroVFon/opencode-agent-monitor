import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("TraceHelper (Session-based)", () => {
  it("writeTrace creates Session on first call per sessionID", async () => {
    const { TraceHelper } =
      await import("../../../server/helpers/trace.helpers");

    const dir = mkdtempSync(join(tmpdir(), "trace-helper-test-"));
    const helper = new TraceHelper(dir);

    // First write for session "abc"
    helper.writeTrace({ type: "test_event", sessionID: "abc" });

    // Give the stream time to flush
    await new Promise((r) => setTimeout(r, 50));

    // File should exist for session "abc"
    const filePath = join(dir, "abc.jsonl");
    assert.equal(existsSync(filePath), true);
  });

  it("writeTrace writes to existing session on second call", async () => {
    const { TraceHelper } =
      await import("../../../server/helpers/trace.helpers");

    const dir = mkdtempSync(join(tmpdir(), "trace-helper-test-"));
    const helper = new TraceHelper(dir);
    helper.writeTrace({ type: "event_1", sessionID: "abc" });
    helper.writeTrace({ type: "event_2", sessionID: "abc" });

    await new Promise((r) => setTimeout(r, 50));

    // Both events in same file
    const content = await import("node:fs").then((fs) =>
      fs.readFileSync(join(dir, "abc.jsonl"), "utf-8"),
    );
    const lines = content.trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).type, "event_1");
    assert.equal(JSON.parse(lines[1]).type, "event_2");
  });

  it("writeTrace writes to different files for different sessionIDs", async () => {
    const { TraceHelper } =
      await import("../../../server/helpers/trace.helpers");

    const dir = mkdtempSync(join(tmpdir(), "trace-helper-test-"));
    const helper = new TraceHelper(dir);
    helper.writeTrace({ type: "alpha", sessionID: "sess-a" });
    helper.writeTrace({ type: "beta", sessionID: "sess-b" });

    await new Promise((r) => setTimeout(r, 50));

    const fileA = join(dir, "sess-a.jsonl");
    const fileB = join(dir, "sess-b.jsonl");
    assert.equal(existsSync(fileA), true);
    assert.equal(existsSync(fileB), true);

    const contentA = (
      await import("node:fs").then((fs) => fs.readFileSync(fileA, "utf-8"))
    ).trim();
    const contentB = (
      await import("node:fs").then((fs) => fs.readFileSync(fileB, "utf-8"))
    ).trim();
    assert.equal(JSON.parse(contentA).type, "alpha");
    assert.equal(JSON.parse(contentB).type, "beta");
  });

  it("close() closes all sessions", async () => {
    const { TraceHelper } =
      await import("../../../server/helpers/trace.helpers");

    const dir = mkdtempSync(join(tmpdir(), "trace-helper-test-"));
    const helper = new TraceHelper(dir);

    helper.writeTrace({ type: "a", sessionID: "s1" });
    helper.writeTrace({ type: "b", sessionID: "s2" });

    await new Promise((r) => setTimeout(r, 50));

    // close() should not throw
    assert.doesNotThrow(() => helper.close());
  });

  it("close() is idempotent", async () => {
    const { TraceHelper } =
      await import("../../../server/helpers/trace.helpers");

    const dir = mkdtempSync(join(tmpdir(), "trace-helper-test-"));
    const helper = new TraceHelper(dir);
    helper.writeTrace({ type: "evt", sessionID: "s1" });
    await new Promise((r) => setTimeout(r, 50));

    helper.close();
    assert.doesNotThrow(() => helper.close());
  });

  it("writeTrace routes child session events to parent file", async () => {
    const { TraceHelper } =
      await import("../../../server/helpers/trace.helpers");

    const dir = mkdtempSync(join(tmpdir(), "trace-helper-test-"));
    const helper = new TraceHelper(dir);

    // Write SESSION_CREATED for child with parentID
    helper.writeTrace({
      type: "session_created",
      sessionID: "child-1",
      parentID: "parent-a",
      timestamp: 100,
    });

    // Write child events — should go to parent file
    helper.writeTrace({
      type: "llm_call",
      sessionID: "child-1",
      agent: "explore",
      timestamp: 200,
    });

    helper.writeTrace({
      type: "tool_call",
      sessionID: "child-1",
      tool: "read_file",
      timestamp: 300,
    });

    // Write a root session event — should go to its own file
    helper.writeTrace({
      type: "llm_call",
      sessionID: "root-session",
      agent: "coder",
      timestamp: 400,
    });

    await new Promise((r) => setTimeout(r, 50));

    // Only parent file and root file should exist — NOT a child file
    const parentFile = join(dir, "parent-a.jsonl");
    const rootFile = join(dir, "root-session.jsonl");
    const childFile = join(dir, "child-1.jsonl");

    assert.equal(
      existsSync(parentFile),
      true,
      "parent file should exist with all child events",
    );
    assert.equal(
      existsSync(rootFile),
      true,
      "root session should have its own file",
    );
    assert.equal(
      existsSync(childFile),
      false,
      "child should NOT have its own file — events go through parent",
    );

    // Parent file should contain child events
    const parentContent = (
      await import("node:fs").then((fs) => fs.readFileSync(parentFile, "utf-8"))
    ).trim();
    const parentLines = parentContent.split("\n");
    assert.equal(parentLines.length, 3, "parent file should have 3 events");
    assert.equal(
      JSON.parse(parentLines[0]).type,
      "session_created",
      "first event in parent is child SESSION_CREATED",
    );
    assert.equal(
      JSON.parse(parentLines[0]).sessionID,
      "child-1",
      "SESSION_CREATED carries child sessionID",
    );
    assert.equal(
      JSON.parse(parentLines[1]).type,
      "llm_call",
      "second event is child LLM call",
    );
    assert.equal(
      JSON.parse(parentLines[2]).type,
      "tool_call",
      "third event is child tool call",
    );

    // Root file should have its own event
    const rootContent = (
      await import("node:fs").then((fs) => fs.readFileSync(rootFile, "utf-8"))
    ).trim();
    const rootLines = rootContent.split("\n");
    assert.equal(rootLines.length, 1, "root file should have 1 event");
    assert.equal(
      JSON.parse(rootLines[0]).type,
      "llm_call",
      "root file has llm_call",
    );
    assert.equal(
      JSON.parse(rootLines[0]).sessionID,
      "root-session",
      "root event carries its own sessionID",
    );
  });

  it("writeTrace handles events without sessionID gracefully (skips, doesn't crash)", async () => {
    const { TraceHelper } =
      await import("../../../server/helpers/trace.helpers");

    const dir = mkdtempSync(join(tmpdir(), "trace-helper-test-"));
    const helper = new TraceHelper(dir);

    // Event without sessionID should not crash
    assert.doesNotThrow(() => {
      helper.writeTrace({ type: "no_session_event" });
    });
  });
});
