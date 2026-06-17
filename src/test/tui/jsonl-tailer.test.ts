import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { JsonlTailer } from "../../tui/jsonl-tailer.js";

const POLL_MS = 30;
const SETTLE_MS = 80; // ~2-3 poll cycles
const TIMEOUT_MS = 2000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number = TIMEOUT_MS,
  intervalMs: number = 15,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await sleep(intervalMs);
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jsonl-tailer-test-"));
  tempDirs.push(dir);
  return dir;
}

function writeJsonl(filePath: string, items: unknown[]): number {
  const text = items.map((i) => JSON.stringify(i)).join("\n");
  const final = items.length > 0 ? text + "\n" : text;
  fs.writeFileSync(filePath, final);
  return Buffer.byteLength(final);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }
});

describe("JsonlTailer", () => {
  it("backfill_reads_existing_file_from_start: emits all N parsed objects and sets cursor to file size", async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, "trace.jsonl");
    const lines = [
      { id: 1, kind: "first" },
      { id: 2, kind: "second" },
      { id: 3, kind: "third" },
    ];
    const expectedSize = writeJsonl(filePath, lines);

    const emitted: unknown[] = [];
    const tailer = new JsonlTailer(filePath, {
      onLine: (line) => emitted.push(line),
      pollIntervalMs: POLL_MS,
    });

    tailer.start();
    try {
      await waitFor(() => emitted.length === lines.length);
      assert.deepEqual(emitted, lines);
      assert.equal(tailer.cursor, expectedSize);
    } finally {
      tailer.stop();
    }
  });

  it("append_emits_new_lines_incrementally: emits each new line as it is appended to the file", async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, "trace.jsonl");
    writeJsonl(filePath, [{ id: 1, kind: "seed" }]);

    const emitted: unknown[] = [];
    const tailer = new JsonlTailer(filePath, {
      onLine: (line) => emitted.push(line),
      pollIntervalMs: POLL_MS,
    });

    tailer.start();
    try {
      // Wait for the initial backfill to complete
      await waitFor(() => emitted.length === 1);
      assert.deepEqual(emitted[0], { id: 1, kind: "seed" });
      const sizeAfterBackfill = fs.statSync(filePath).size;
      assert.equal(tailer.cursor, sizeAfterBackfill);

      // Append a new line and wait for it to be emitted
      fs.appendFileSync(
        filePath,
        JSON.stringify({ id: 2, kind: "appended" }) + "\n",
      );
      await waitFor(() => emitted.length === 2);
      assert.deepEqual(emitted[1], { id: 2, kind: "appended" });

      // Append another new line and wait
      fs.appendFileSync(
        filePath,
        JSON.stringify({ id: 3, kind: "another" }) + "\n",
      );
      await waitFor(() => emitted.length === 3);
      assert.deepEqual(emitted[2], { id: 3, kind: "another" });

      // Cursor should equal the current file size
      assert.equal(tailer.cursor, fs.statSync(filePath).size);
    } finally {
      tailer.stop();
    }
  });

  it("truncate_resets_cursor_and_rereads: resets cursor to 0 and re-reads from the beginning", async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, "trace.jsonl");
    writeJsonl(filePath, [{ id: 1 }, { id: 2 }, { id: 3 }]);

    const emitted: unknown[] = [];
    const tailer = new JsonlTailer(filePath, {
      onLine: (line) => emitted.push(line),
      pollIntervalMs: POLL_MS,
    });

    tailer.start();
    try {
      // Wait for the initial backfill
      await waitFor(() => emitted.length === 3);
      const beforeTruncate = tailer.cursor;
      assert.ok(beforeTruncate > 0);

      // Truncate the file (size becomes 0, which is < cursor)
      fs.truncateSync(filePath, 0);
      // Write a new line into the truncated file
      fs.writeFileSync(
        filePath,
        JSON.stringify({ id: 99, kind: "after-truncate" }) + "\n",
      );

      // Wait for the new line to be emitted (proving re-read from beginning)
      await waitFor(() => emitted.length === 4);

      // The 4th emission should be the new line — not a duplicate of the old lines
      assert.deepEqual(emitted[3], { id: 99, kind: "after-truncate" });

      // Cursor should equal the new file size (re-read was triggered by truncate)
      const newSize = fs.statSync(filePath).size;
      assert.equal(
        tailer.cursor,
        newSize,
        "cursor must match new file size after re-read",
      );
    } finally {
      tailer.stop();
    }
  });

  it("missing_file_handled_gracefully: ENOENT is silent, tailer recovers when file appears", async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, "trace.jsonl");
    // Note: file does not exist yet

    const errors: Error[] = [];
    const emitted: unknown[] = [];
    const tailer = new JsonlTailer(filePath, {
      onLine: (line) => emitted.push(line),
      onError: (err) => errors.push(err),
      pollIntervalMs: POLL_MS,
    });

    tailer.start();
    try {
      // Wait several poll cycles to confirm ENOENT does NOT trigger onError
      await sleep(SETTLE_MS * 3);
      assert.equal(errors.length, 0, "ENOENT must not be reported as an error");
      assert.equal(
        emitted.length,
        0,
        "no lines should be emitted for a missing file",
      );

      // Now create the file — the tailer should retry on next poll and emit
      fs.writeFileSync(
        filePath,
        JSON.stringify({ id: 1, kind: "recovered" }) + "\n",
      );
      await waitFor(() => emitted.length === 1);

      assert.deepEqual(emitted[0], { id: 1, kind: "recovered" });
      assert.equal(tailer.cursor, fs.statSync(filePath).size);
    } finally {
      tailer.stop();
    }
  });

  it("partial_lines_buffered_until_complete: partial lines are buffered until newline is appended", async () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, "trace.jsonl");

    const emitted: unknown[] = [];
    const tailer = new JsonlTailer(filePath, {
      onLine: (line) => emitted.push(line),
      pollIntervalMs: POLL_MS,
    });

    tailer.start();
    try {
      // Wait a moment to ensure the tailer is running
      await sleep(SETTLE_MS);

      // Write a partial line (no trailing newline) — should NOT be emitted
      fs.writeFileSync(filePath, '{"id":1,"msg":"hel');
      await sleep(SETTLE_MS);
      assert.equal(emitted.length, 0, "partial line must not be emitted");
      assert.equal(
        tailer.cursor,
        0,
        "cursor must not advance for a partial line",
      );

      // Complete the line by appending the rest with a trailing newline
      fs.appendFileSync(filePath, 'lo"}\n');
      await waitFor(() => emitted.length === 1);
      assert.deepEqual(emitted[0], { id: 1, msg: "hello" });
      assert.equal(tailer.cursor, fs.statSync(filePath).size);

      // Write a complete line in a single append — should be emitted immediately
      fs.appendFileSync(
        filePath,
        JSON.stringify({ id: 2, msg: "world" }) + "\n",
      );
      await waitFor(() => emitted.length === 2);
      assert.deepEqual(emitted[1], { id: 2, msg: "world" });

      // Write another partial line at the end — should be buffered
      fs.appendFileSync(filePath, '{"id":3,');
      await sleep(SETTLE_MS);
      assert.equal(
        emitted.length,
        2,
        "partial line at end of file must be buffered",
      );

      // Complete the partial line
      fs.appendFileSync(filePath, '"msg":"partial"}\n');
      await waitFor(() => emitted.length === 3);
      assert.deepEqual(emitted[2], { id: 3, msg: "partial" });
      assert.equal(tailer.cursor, fs.statSync(filePath).size);
    } finally {
      tailer.stop();
    }
  });
});
