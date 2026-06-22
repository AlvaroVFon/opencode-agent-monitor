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
