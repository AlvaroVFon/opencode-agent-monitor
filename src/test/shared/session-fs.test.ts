import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sessionFS } from "../../shared/session-fs.js";

describe("sanitizeSessionId", () => {
  it("preserves UUID with hyphens intact", () => {
    const input = "550e8400-e29b-41d4-a716-446655440000";
    assert.equal(sessionFS.sanitizeSessionId(input), input);
  });

  it("preserves dots, hyphens, and underscores", () => {
    const input = "my.session-id_v2";
    assert.equal(sessionFS.sanitizeSessionId(input), input);
  });

  it("replaces slashes with underscores", () => {
    const result = sessionFS.sanitizeSessionId("../../etc/passwd");
    assert.equal(result.includes("/"), false);
    assert.equal(result, ".._.._etc_passwd");
  });

  it("replaces colons with underscores", () => {
    const result = sessionFS.sanitizeSessionId("session:id:1");
    assert.equal(result, "session_id_1");
  });

  it("replaces spaces with underscores", () => {
    const result = sessionFS.sanitizeSessionId("bad session id");
    assert.equal(result, "bad_session_id");
  });
});

describe("sessionFilePath", () => {
  it("returns absolute path with .jsonl extension", () => {
    const result = sessionFS.sessionFilePath("/tmp/traces", "my-session");
    assert.equal(result, "/tmp/traces/my-session.jsonl");
  });

  it("sanitizes sessionId before constructing path", () => {
    const result = sessionFS.sessionFilePath("/tmp/traces", "../dangerous");
    // The dot characters are safe, only "/" is replaced
    assert.equal(result, "/tmp/traces/.._dangerous.jsonl");
  });
});

describe("listSessionFiles", () => {
  it("returns sorted absolute paths for .jsonl files", () => {
    const dir = mkdtempSync(join(tmpdir(), "list-test-"));
    writeFileSync(join(dir, "b.jsonl"), "");
    writeFileSync(join(dir, "a.jsonl"), "");
    writeFileSync(join(dir, "readme.txt"), "");

    const result = sessionFS.listSessionFiles(dir);

    assert.equal(result.length, 2);
    assert.ok(result[0].endsWith("/a.jsonl"));
    assert.ok(result[1].endsWith("/b.jsonl"));
    assert.ok(result[0].startsWith("/"));
    assert.ok(result[1].startsWith("/"));
  });

  it("returns empty array for empty directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "list-empty-"));

    const result = sessionFS.listSessionFiles(dir);

    assert.deepEqual(result, []);
  });

  it("returns empty array for non-existent directory (ENOENT)", () => {
    const result = sessionFS.listSessionFiles(
      "/tmp/nonexistent-session-dir-12345",
    );
    assert.deepEqual(result, []);
  });
});

describe("readSessionFile", () => {
  it("parses valid JSONL file and returns array of objects", () => {
    const dir = mkdtempSync(join(tmpdir(), "read-test-"));
    const filePath = join(dir, "session.jsonl");
    writeFileSync(
      filePath,
      JSON.stringify({ a: 1 }) + "\n" + JSON.stringify({ b: 2 }) + "\n",
    );

    const result = sessionFS.readSessionFile(filePath);

    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { a: 1 });
    assert.deepEqual(result[1], { b: 2 });
  });

  it("silently skips malformed JSON lines", () => {
    const dir = mkdtempSync(join(tmpdir(), "read-malformed-"));
    const filePath = join(dir, "session.jsonl");
    writeFileSync(
      filePath,
      JSON.stringify({ a: 1 }) +
        "\nnot-json\n" +
        JSON.stringify({ b: 2 }) +
        "\n",
    );

    const result = sessionFS.readSessionFile(filePath);

    assert.equal(result.length, 2);
    assert.deepEqual(result[0], { a: 1 });
    assert.deepEqual(result[1], { b: 2 });
  });

  it("returns empty array for non-existent file (ENOENT)", () => {
    const result = sessionFS.readSessionFile(
      "/tmp/nonexistent-session-file-12345.jsonl",
    );
    assert.deepEqual(result, []);
  });
});
