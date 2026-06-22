import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const CLI_ENTRY = "src/cli/main.ts";
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-errors-test-"));
  tempDirs.push(dir);
  return dir;
}

function writeTrace(dir: string, events: unknown[]): void {
  const bySession = new Map<string, unknown[]>();
  for (const ev of events) {
    const sid = (ev as Record<string, unknown>).sessionID as string;
    if (!bySession.has(sid)) bySession.set(sid, []);
    bySession.get(sid)!.push(ev);
  }
  for (const [sid, evts] of bySession) {
    const text = evts.map((e) => JSON.stringify(e)).join("\n") + "\n";
    fs.writeFileSync(path.join(dir, `${sid}.jsonl`), text);
  }
}

function runCli(
  args: string[],
  dir: string,
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(
    "node",
    ["--import", "tsx", CLI_ENTRY, ...args, "--dir", dir],
    {
      encoding: "utf8",
    },
  );
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
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

describe("errors command", () => {
  it("lists session errors", () => {
    const dir = makeTempDir();
    writeTrace(dir, [
      {
        type: "session_error",
        sessionID: "s1",
        errorType: "RuntimeError",
        errorMessage: "boom",
        timestamp: 2000,
      },
    ]);
    const { stdout, stderr, status } = runCli(["errors"], dir);
    assert.equal(status, 0, `stderr: ${stderr}`);
    assert.ok(stdout.includes("RuntimeError"));
    assert.ok(stdout.includes("boom"));
    assert.ok(stdout.includes("s1"));
  });

  it("outputs JSON with --json flag", () => {
    const dir = makeTempDir();
    writeTrace(dir, [
      {
        type: "session_error",
        sessionID: "s1",
        errorType: "RuntimeError",
        errorMessage: "boom",
        timestamp: 2000,
      },
    ]);
    const { stdout, stderr, status } = runCli(["errors", "--json"], dir);
    assert.equal(status, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].type, "RuntimeError");
  });

  it("respects --limit flag", () => {
    const dir = makeTempDir();
    writeTrace(dir, [
      {
        type: "session_error",
        sessionID: "s1",
        errorType: "E1",
        errorMessage: "e1",
        timestamp: 100,
      },
      {
        type: "session_error",
        sessionID: "s2",
        errorType: "E2",
        errorMessage: "e2",
        timestamp: 200,
      },
      {
        type: "session_error",
        sessionID: "s3",
        errorType: "E3",
        errorMessage: "e3",
        timestamp: 300,
      },
    ]);
    const { stdout, stderr, status } = runCli(["errors", "--limit", "2"], dir);
    assert.equal(status, 0, `stderr: ${stderr}`);
    const lines = stdout
      .trim()
      .split("\n")
      .filter((l) => l.includes("E"));
    assert.equal(lines.length, 2);
  });

  it("filters by --type", () => {
    const dir = makeTempDir();
    writeTrace(dir, [
      {
        type: "session_error",
        sessionID: "s1",
        errorType: "RuntimeError",
        errorMessage: "boom",
        timestamp: 100,
      },
      {
        type: "session_error",
        sessionID: "s2",
        errorType: "TimeoutError",
        errorMessage: "timeout",
        timestamp: 200,
      },
    ]);
    const { stdout, stderr, status } = runCli(
      ["errors", "--type", "RuntimeError"],
      dir,
    );
    assert.equal(status, 0, `stderr: ${stderr}`);
    assert.ok(stdout.includes("RuntimeError"));
    assert.ok(!stdout.includes("TimeoutError"));
  });

  it("shows 'No errors found' when no errors", () => {
    const dir = makeTempDir();
    writeTrace(dir, [
      {
        type: "llm_call",
        sessionID: "s1",
        agent: "coder",
        model: "gpt-4",
        finish: "stop",
        inputTokens: 10,
        outputTokens: 20,
        reasoningTokens: 0,
        cacheRead: 5,
        cost: 0.002,
        durationMs: 800,
        timestamp: 1000,
      },
    ]);
    const { stdout, stderr, status } = runCli(["errors"], dir);
    assert.equal(status, 0, `stderr: ${stderr}`);
    assert.ok(stdout.includes("No errors found"));
  });

  it("handles --help", () => {
    const dir = makeTempDir();
    const { stdout, status } = runCli(["errors", "--help"], dir);
    assert.equal(status, 0);
    assert.ok(stdout.includes("list errors from trace files"));
  });

  it("filters by --since and includes recent errors", () => {
    const dir = makeTempDir();
    writeTrace(dir, [
      {
        type: "session_error",
        sessionID: "s1",
        errorType: "RuntimeError",
        errorMessage: "recent",
        timestamp: Date.now(),
      },
    ]);
    const { stdout, stderr, status } = runCli(
      ["errors", "--since", "24h", "--json"],
      dir,
    );
    assert.equal(status, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].message, "recent");
  });
});
