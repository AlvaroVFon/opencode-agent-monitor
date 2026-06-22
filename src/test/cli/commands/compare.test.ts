import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const CLI_ENTRY = "src/cli/main.ts";
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-compare-test-"));
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

describe("compare command", () => {
  it("outputs a comparison table with real and estimated costs", () => {
    const dir = makeTempDir();
    writeTrace(dir, [
      {
        type: "llm_call",
        sessionID: "s1",
        agent: "coder",
        model: "openai/gpt-4o",
        finish: "stop",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 12.5, // 2.5 + 10.0
        durationMs: 800,
        timestamp: Date.now(),
      },
    ]);

    const { stdout, stderr, status } = runCli(["compare"], dir);
    assert.equal(status, 0, `stderr: ${stderr}`);
    assert.ok(stdout.includes("# Cost Comparison Report"));
    assert.ok(stdout.includes("Real Cost (current models):** $12.5000"));
    assert.ok(stdout.includes("openai/gpt-4o-mini"));
    assert.ok(stdout.includes("$0.7500")); // (0.15 + 0.6)
  });

  it("filters by --session", () => {
    const dir = makeTempDir();
    const now = Date.now();
    writeTrace(dir, [
      {
        type: "llm_call",
        sessionID: "s1",
        agent: "coder",
        model: "openai/gpt-4o",
        finish: "stop",
        inputTokens: 1_000_000,
        outputTokens: 0,
        cost: 2.5,
        timestamp: now,
      },
      {
        type: "llm_call",
        sessionID: "s2",
        agent: "reviewer",
        model: "openai/gpt-4o",
        finish: "stop",
        inputTokens: 1_000_000,
        outputTokens: 0,
        cost: 2.5,
        timestamp: now,
      },
    ]);

    const { stdout, status } = runCli(["compare", "--session", "s1"], dir);
    assert.equal(status, 0);
    assert.ok(stdout.includes("Real Cost (current models):** $2.5000"));
  });

  it("handles empty trace file", () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "empty.jsonl"), "");
    const { stderr, status } = runCli(["compare"], dir);
    assert.equal(status, 1);
    assert.ok(stderr.includes("No events found"));
  });

  it("handles no LLM calls", () => {
    const dir = makeTempDir();
    writeTrace(dir, [
      {
        type: "session_created",
        sessionID: "s1",
        timestamp: Date.now(),
      },
    ]);
    const { stderr, status } = runCli(["compare"], dir);
    assert.equal(status, 1);
    assert.ok(stderr.includes("No LLM calls found"));
  });
});
