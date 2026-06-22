import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SESSION_MODULE = "../../server/session";

describe("Session (real WriteStream)", () => {
  it("constructor does NOT create a WriteStream", async () => {
    const { Session } = await import(SESSION_MODULE);
    const dir = mkdtempSync(join(tmpdir(), "session-test-"));
    const session = new Session(dir, "no-write-yet");
    // No file should exist since write() was never called
    const files = await import("node:fs").then((fs) =>
      fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")),
    );
    assert.equal(files.length, 0);
  });

  it("first write creates the file", async () => {
    const { Session } = await import(SESSION_MODULE);
    const dir = mkdtempSync(join(tmpdir(), "session-test-"));
    const session = new Session(dir, "session-one");
    session.write({ type: "test_event", value: 1 });

    // Give the stream a tick to flush
    await new Promise((r) => setTimeout(r, 50));

    const filePath = join(dir, "session-one.jsonl");
    assert.equal(existsSync(filePath), true);
  });

  it("write() injects schemaVersion: 1 into each written event", async () => {
    const { Session } = await import(SESSION_MODULE);
    const dir = mkdtempSync(join(tmpdir(), "session-test-"));
    const session = new Session(dir, "schema-test");
    session.write({ type: "my_event", data: "hello" });
    await new Promise((r) => setTimeout(r, 50));

    const filePath = join(dir, "schema-test.jsonl");
    const content = readFileSync(filePath, "utf-8").trim();
    const parsed = JSON.parse(content);
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.type, "my_event");
    assert.equal(parsed.data, "hello");
  });

  it("write() appends JSON lines to the correct path using sessionFilePath", async () => {
    const { Session } = await import(SESSION_MODULE);
    const dir = mkdtempSync(join(tmpdir(), "session-test-"));
    const session = new Session(dir, "path-test");
    session.write({ seq: 1 });
    session.write({ seq: 2 });
    await new Promise((r) => setTimeout(r, 50));

    const filePath = join(dir, "path-test.jsonl");
    const lines = readFileSync(filePath, "utf-8").trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).seq, 1);
    assert.equal(JSON.parse(lines[1]).seq, 2);
  });

  it("close() ends the stream and sets closed flag", async () => {
    const { Session } = await import(SESSION_MODULE);
    const dir = mkdtempSync(join(tmpdir(), "session-test-"));
    const session = new Session(dir, "close-test");
    session.write({ type: "pre_close" });
    session.close();

    // After close, the stream should have ended (data was flushed)
    // Verify by reading the file
    await new Promise((r) => setTimeout(r, 50));
    const filePath = join(dir, "close-test.jsonl");
    const content = readFileSync(filePath, "utf-8").trim();
    const parsed = JSON.parse(content);
    assert.equal(parsed.type, "pre_close");
    assert.equal(parsed.schemaVersion, 1);
  });

  it("close() is idempotent — calling twice does not throw", async () => {
    const { Session } = await import(SESSION_MODULE);
    const dir = mkdtempSync(join(tmpdir(), "session-test-"));
    const session = new Session(dir, "idempotent-test");
    session.write({ type: "data" });
    await new Promise((r) => setTimeout(r, 50));

    session.close();
    assert.doesNotThrow(() => session.close());
  });

  it("multiple writes go to the same file", async () => {
    const { Session } = await import(SESSION_MODULE);
    const dir = mkdtempSync(join(tmpdir(), "session-test-"));
    const session = new Session(dir, "multi-test");
    session.write({ n: 1 });
    session.write({ n: 2 });
    session.write({ n: 3 });
    await new Promise((r) => setTimeout(r, 50));

    const filePath = join(dir, "multi-test.jsonl");
    const lines = readFileSync(filePath, "utf-8").trim().split("\n");
    assert.equal(lines.length, 3);
    assert.equal(JSON.parse(lines[0]).n, 1);
    assert.equal(JSON.parse(lines[1]).n, 2);
    assert.equal(JSON.parse(lines[2]).n, 3);
  });

  it("stream error emits to process.stderr", async () => {
    const { Session } = await import(SESSION_MODULE);
    // Use a dir that doesn't exist to force a stream error
    const dir = join(tmpdir(), "nonexistent-dir-" + Date.now());
    const session = new Session(dir, "error-test");

    const stderrWriter = mock.method(process.stderr, "write", () => true);

    session.write({ type: "boom" });
    await new Promise((r) => setTimeout(r, 200));

    assert.equal(stderrWriter.mock.calls.length, 1);
    const written = stderrWriter.mock.calls[0].arguments[0];
    assert.ok(
      typeof written === "string" || written instanceof Buffer,
      "stderr write argument should be string or Buffer",
    );
    if (typeof written === "string" || written instanceof Buffer) {
      assert.ok(
        String(written).length > 0,
        "stderr should receive a non-empty error message",
      );
    }

    stderrWriter.mock.restore();
  });

  it("session resume: if file exists, appends (flags: 'a')", async () => {
    const { Session } = await import(SESSION_MODULE);
    const dir = mkdtempSync(join(tmpdir(), "session-test-"));
    const filePath = join(dir, "resume-test.jsonl");

    // Pre-populate the file with one event (simulating a previous session)
    writeFileSync(
      filePath,
      JSON.stringify({ type: "old_event", seq: 0 }) + "\n",
      "utf-8",
    );

    const session = new Session(dir, "resume-test");
    session.write({ type: "new_event", seq: 1 });
    await new Promise((r) => setTimeout(r, 50));

    const lines = readFileSync(filePath, "utf-8").trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).seq, 0);
    assert.equal(JSON.parse(lines[0]).type, "old_event");
    assert.equal(JSON.parse(lines[1]).seq, 1);
    assert.equal(JSON.parse(lines[1]).type, "new_event");
    assert.equal(JSON.parse(lines[1]).schemaVersion, 1);
  });
});
