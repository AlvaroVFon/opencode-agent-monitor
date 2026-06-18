import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { traceReader } from "../../cli/reader";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-reader-test-"));
  tempDirs.push(dir);
  return dir;
}

function writeJsonl(fileName: string, dir: string, items: unknown[]): void {
  const text = items.map((i) => JSON.stringify(i)).join("\n") + "\n";
  fs.writeFileSync(path.join(dir, fileName), text);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {}
    }
  }
});

describe("readEvents", () => {
  it("returns empty array for empty directory", () => {
    const dir = makeTempDir();
    const events = traceReader.readEvents(dir);
    assert.deepEqual(events, []);
  });

  it("reads trace.jsonl", () => {
    const dir = makeTempDir();
    writeJsonl("trace.jsonl", dir, [
      { type: "llm_call", agent: "a", sessionID: "s1", timestamp: 1 },
    ]);
    const events = traceReader.readEvents(dir);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "llm_call");
  });

  it("merges trace.jsonl and trace.errors.jsonl", () => {
    const dir = makeTempDir();
    writeJsonl("trace.jsonl", dir, [
      { type: "llm_call", agent: "a", sessionID: "s1", timestamp: 1 },
    ]);
    writeJsonl("trace.errors.jsonl", dir, [
      { type: "session_error", sessionID: "s1", timestamp: 2 },
    ]);
    const events = traceReader.readEvents(dir);
    assert.equal(events.length, 2);
    assert.equal(events[0].type, "llm_call");
    assert.equal(events[1].type, "session_error");
  });

  it("silently skips malformed JSON lines", () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, "trace.jsonl");
    fs.writeFileSync(
      filePath,
      '{valid: "no"}\n{"type":"llm_call","agent":"a","sessionID":"s1","timestamp":1}\nnot-json\n',
    );
    const events = traceReader.readEvents(dir);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "llm_call");
  });

  it("returns empty array when both files are empty", () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "trace.jsonl"), "");
    fs.writeFileSync(path.join(dir, "trace.errors.jsonl"), "");
    const events = traceReader.readEvents(dir);
    assert.deepEqual(events, []);
  });
});
