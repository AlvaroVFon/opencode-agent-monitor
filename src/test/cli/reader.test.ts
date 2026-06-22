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
      } catch {
        // temp dir cleanup must not throw
      }
    }
  }
});

describe("readEvents", () => {
  it("returns empty array for empty directory", () => {
    const dir = makeTempDir();
    assert.deepEqual(traceReader.readEvents(dir), []);
  });

  it("reads events from a single session file", () => {
    const dir = makeTempDir();
    writeJsonl("s1.jsonl", dir, [
      { type: "llm_call", agent: "a", sessionID: "s1", timestamp: 1 },
    ]);
    const events = traceReader.readEvents(dir);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "llm_call");
  });

  it("merges multiple session files in chronological order", () => {
    const dir = makeTempDir();
    writeJsonl("s1.jsonl", dir, [
      { type: "llm_call", agent: "a", sessionID: "s1", timestamp: 10 },
      { type: "tool_call", agent: "a", sessionID: "s1", timestamp: 20 },
    ]);
    writeJsonl("s2.jsonl", dir, [
      { type: "session_start", sessionID: "s2", timestamp: 5 },
    ]);
    const events = traceReader.readEvents(dir);
    assert.equal(events.length, 3);
    assert.equal(events[0].timestamp, 5);
    assert.equal(events[1].timestamp, 10);
    assert.equal(events[2].timestamp, 20);
  });

  it("silently skips malformed JSON lines", () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, "s1.jsonl");
    fs.writeFileSync(
      filePath,
      '{valid: "no"}\n{"type":"llm_call","agent":"a","sessionID":"s1","timestamp":1}\nnot-json\n',
    );
    const events = traceReader.readEvents(dir);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "llm_call");
  });

  it("does not read legacy trace.jsonl", () => {
    const dir = makeTempDir();
    writeJsonl("trace.jsonl", dir, [
      { type: "llm_call", agent: "old", sessionID: "old", timestamp: 1 },
    ]);
    const events = traceReader.readEvents(dir);
    assert.deepEqual(events, []);
  });
});

describe("readJsonl", () => {
  it("reads a JSONL file and returns typed array", () => {
    const dir = makeTempDir();
    writeJsonl("data.jsonl", dir, [{ a: 1 }, { b: 2 }]);
    const result = traceReader.readJsonl<Record<string, number>>(
      path.join(dir, "data.jsonl"),
    );
    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { a: 1 });
  });
});
