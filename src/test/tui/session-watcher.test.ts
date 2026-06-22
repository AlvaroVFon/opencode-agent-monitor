import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { SessionWatcher } from "../../tui/session-watcher.js";
import { sessionFS } from "../../shared/session-fs.js";

const POLL_MS = 30;
const SETTLE_MS = 80;
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "session-watcher-test-"));
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

describe("SessionWatcher", () => {
  it("constructor_stores_traceDir_and_sessionID: resolves file via sessionFS.sessionFilePath", () => {
    const dir = makeTempDir();
    const sessionID = "my-session";
    const watcher = new SessionWatcher(dir, sessionID, {
      pollIntervalMs: POLL_MS,
    });

    // Cursor starts at 0
    assert.equal(watcher.cursor, 0, "cursor must start at 0");

    // Verify the resolved path exists by starting watcher on a created file
    const filePath = sessionFS.sessionFilePath(dir, sessionID);
    writeJsonl(filePath, [{ id: 1 }]);
    const emitted: unknown[] = [];
    const w2 = new SessionWatcher(dir, sessionID, {
      onLine: (line) => emitted.push(line),
      pollIntervalMs: POLL_MS,
    });
    w2.start(0);
    try {
      return waitFor(() => emitted.length === 1).then(() => {
        assert.deepEqual(emitted[0], { id: 1 });
      });
    } finally {
      w2.stop();
    }
  });

  it("start_reads_full_file_and_emits_all_events: start(0) reads full file, emits all events via onLine", async () => {
    const dir = makeTempDir();
    const sessionID = "test-session";
    const filePath = sessionFS.sessionFilePath(dir, sessionID);
    const lines = [
      { id: 1, kind: "first" },
      { id: 2, kind: "second" },
      { id: 3, kind: "third" },
    ];
    const expectedSize = writeJsonl(filePath, lines);

    const emitted: unknown[] = [];
    const watcher = new SessionWatcher(dir, sessionID, {
      onLine: (line) => emitted.push(line),
      pollIntervalMs: POLL_MS,
    });

    watcher.start(0);
    try {
      await waitFor(() => emitted.length === lines.length);
      assert.deepEqual(emitted, lines);
      assert.equal(watcher.cursor, expectedSize);
    } finally {
      watcher.stop();
    }
  });

  it("start_with_cursor_skips_bytes: start(cursor) skips bytes before cursor, emits only new content", async () => {
    const dir = makeTempDir();
    const sessionID = "cursor-session";
    const filePath = sessionFS.sessionFilePath(dir, sessionID);

    // Write initial content
    const initialLines = [{ id: 1 }, { id: 2 }];
    writeJsonl(filePath, initialLines);

    // Track the size after initial content
    const initialSize = Buffer.byteLength(
      initialLines.map((i) => JSON.stringify(i)).join("\n") + "\n",
    );

    // Append new content
    const appendedLines = [{ id: 3 }, { id: 4 }];
    const appendedText =
      appendedLines.map((i) => JSON.stringify(i)).join("\n") + "\n";
    fs.appendFileSync(filePath, appendedText);

    // Start watcher at the offset of initial content
    const emitted: unknown[] = [];
    const watcher = new SessionWatcher(dir, sessionID, {
      onLine: (line) => emitted.push(line),
      pollIntervalMs: POLL_MS,
    });

    watcher.start(initialSize);
    try {
      await waitFor(() => emitted.length === 2);
      assert.deepEqual(emitted, appendedLines);
    } finally {
      watcher.stop();
    }
  });

  it("append_detected: file grows → new lines emitted", async () => {
    const dir = makeTempDir();
    const sessionID = "append-session";
    const filePath = sessionFS.sessionFilePath(dir, sessionID);
    writeJsonl(filePath, [{ id: 1, kind: "seed" }]);

    const emitted: unknown[] = [];
    const watcher = new SessionWatcher(dir, sessionID, {
      onLine: (line) => emitted.push(line),
      pollIntervalMs: POLL_MS,
    });

    watcher.start(0);
    try {
      await waitFor(() => emitted.length === 1);
      assert.deepEqual(emitted[0], { id: 1, kind: "seed" });

      fs.appendFileSync(
        filePath,
        JSON.stringify({ id: 2, kind: "appended" }) + "\n",
      );
      await waitFor(() => emitted.length === 2);
      assert.deepEqual(emitted[1], { id: 2, kind: "appended" });

      fs.appendFileSync(
        filePath,
        JSON.stringify({ id: 3, kind: "another" }) + "\n",
      );
      await waitFor(() => emitted.length === 3);
      assert.deepEqual(emitted[2], { id: 3, kind: "another" });

      assert.equal(watcher.cursor, fs.statSync(filePath).size);
    } finally {
      watcher.stop();
    }
  });

  it("empty_lines_skipped: Empty lines in append are skipped, cursor advances", async () => {
    const dir = makeTempDir();
    const sessionID = "empty-lines";
    const filePath = sessionFS.sessionFilePath(dir, sessionID);

    const emitted: unknown[] = [];
    const watcher = new SessionWatcher(dir, sessionID, {
      onLine: (line) => emitted.push(line),
      pollIntervalMs: POLL_MS,
    });

    watcher.start(0);
    try {
      await sleep(SETTLE_MS);

      // Append blank lines followed by a valid line
      fs.appendFileSync(filePath, "\n\n");
      await sleep(SETTLE_MS);
      assert.equal(emitted.length, 0, "blank lines must not emit events");

      fs.appendFileSync(
        filePath,
        JSON.stringify({ id: 1, kind: "after-blank" }) + "\n",
      );
      await waitFor(() => emitted.length === 1);
      assert.deepEqual(emitted[0], { id: 1, kind: "after-blank" });

      assert.equal(watcher.cursor, fs.statSync(filePath).size);
    } finally {
      watcher.stop();
    }
  });

  it("truncation_detected: cursor resets → re-reads entire file", async () => {
    const dir = makeTempDir();
    const sessionID = "truncate-session";
    const filePath = sessionFS.sessionFilePath(dir, sessionID);
    writeJsonl(filePath, [{ id: 1 }, { id: 2 }, { id: 3 }]);

    const emitted: unknown[] = [];
    const watcher = new SessionWatcher(dir, sessionID, {
      onLine: (line) => emitted.push(line),
      pollIntervalMs: POLL_MS,
    });

    watcher.start(0);
    try {
      await waitFor(() => emitted.length === 3);
      const beforeTruncate = watcher.cursor;
      assert.ok(beforeTruncate > 0);

      // Truncate and write new content
      fs.truncateSync(filePath, 0);
      fs.writeFileSync(
        filePath,
        JSON.stringify({ id: 99, kind: "after-truncate" }) + "\n",
      );

      await waitFor(() => emitted.length === 4);
      assert.deepEqual(emitted[3], { id: 99, kind: "after-truncate" });

      assert.equal(watcher.cursor, fs.statSync(filePath).size);
    } finally {
      watcher.stop();
    }
  });

  it("enoent_silent: ENOENT is silent, watcher stays active and recovers when file appears", async () => {
    const dir = makeTempDir();
    const sessionID = "enoent-session";
    // File does not exist yet

    const errors: Error[] = [];
    const emitted: unknown[] = [];
    const watcher = new SessionWatcher(dir, sessionID, {
      onLine: (line) => emitted.push(line),
      onError: (err) => errors.push(err),
      pollIntervalMs: POLL_MS,
    });

    watcher.start(0);
    try {
      await sleep(SETTLE_MS * 3);
      assert.equal(errors.length, 0, "ENOENT must not be reported as an error");
      assert.equal(
        emitted.length,
        0,
        "no lines should be emitted for a missing file",
      );

      // Create the file — watcher should pick it up
      const filePath = sessionFS.sessionFilePath(dir, sessionID);
      fs.writeFileSync(
        filePath,
        JSON.stringify({ id: 1, kind: "recovered" }) + "\n",
      );
      await waitFor(() => emitted.length === 1);

      assert.deepEqual(emitted[0], { id: 1, kind: "recovered" });
      assert.equal(watcher.cursor, fs.statSync(filePath).size);
    } finally {
      watcher.stop();
    }
  });

  it("malformed_json_skipped: Malformed JSON silently skipped", async () => {
    const dir = makeTempDir();
    const sessionID = "malformed-session";
    const filePath = sessionFS.sessionFilePath(dir, sessionID);

    // Write valid, malformed, valid
    fs.writeFileSync(
      filePath,
      JSON.stringify({ id: 1 }) +
        "\nnot-json\n" +
        JSON.stringify({ id: 2 }) +
        "\n",
    );

    const emitted: unknown[] = [];
    const watcher = new SessionWatcher(dir, sessionID, {
      onLine: (line) => emitted.push(line),
      pollIntervalMs: POLL_MS,
    });

    watcher.start(0);
    try {
      await waitFor(() => emitted.length === 2);
      assert.deepEqual(emitted[0], { id: 1 });
      assert.deepEqual(emitted[1], { id: 2 });
    } finally {
      watcher.stop();
    }
  });

  it("stop_clears_watcher_and_poll: stop() clears watcher + poll timer, no further callbacks", async () => {
    const dir = makeTempDir();
    const sessionID = "stop-session";
    const filePath = sessionFS.sessionFilePath(dir, sessionID);
    writeJsonl(filePath, [{ id: 1 }]);

    const emitted: unknown[] = [];
    const watcher = new SessionWatcher(dir, sessionID, {
      onLine: (line) => emitted.push(line),
      pollIntervalMs: POLL_MS,
    });

    watcher.start(0);
    try {
      await waitFor(() => emitted.length === 1);

      watcher.stop();

      // Append after stop — should NOT be emitted
      fs.appendFileSync(
        filePath,
        JSON.stringify({ id: 2, kind: "after-stop" }) + "\n",
      );
      await sleep(SETTLE_MS * 3);
      assert.equal(emitted.length, 1, "no new lines after stop()");
    } finally {
      watcher.stop();
    }
  });

  it("cursor_getter_returns_position: cursor getter returns current byte position", async () => {
    const dir = makeTempDir();
    const sessionID = "cursor-getter";
    const filePath = sessionFS.sessionFilePath(dir, sessionID);
    const lines = [{ id: 1 }, { id: 2 }];
    const expectedSize = writeJsonl(filePath, lines);

    const emitted: unknown[] = [];
    const watcher = new SessionWatcher(dir, sessionID, {
      onLine: (line) => emitted.push(line),
      pollIntervalMs: POLL_MS,
    });

    assert.equal(watcher.cursor, 0, "cursor must start at 0");

    watcher.start(0);
    try {
      await waitFor(() => emitted.length === 2);
      assert.equal(watcher.cursor, expectedSize);
    } finally {
      watcher.stop();
    }
  });
});
