import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const CLI_ENTRY = "src/cli/main.ts";
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-stats-test-"));
  tempDirs.push(dir);
  return dir;
}

function writeTrace(dir: string, events: unknown[]): void {
  const text = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  fs.writeFileSync(path.join(dir, "trace.jsonl"), text);
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

describe("stats command", () => {
  it("outputs markdown by default with llm_call events", () => {
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
    const { stdout, stderr, status } = runCli(["stats"], dir);
    assert.equal(status, 0, `stderr: ${stderr}`);
    assert.ok(stdout.includes("## Summary"));
    assert.ok(stdout.includes("coder"));
    assert.ok(stdout.includes("0.0020"));
  });

  it("outputs JSON with --json flag", () => {
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
    const { stdout, stderr, status } = runCli(["stats", "--json"], dir);
    assert.equal(status, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.totals.llmCalls, 1);
    assert.equal(parsed.byAgent.coder.llmCalls, 1);
  });

  it("filters by --session", () => {
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
      {
        type: "llm_call",
        sessionID: "s2",
        agent: "reviewer",
        model: "gpt-4",
        finish: "stop",
        inputTokens: 5,
        outputTokens: 10,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.001,
        durationMs: 500,
        timestamp: 2000,
      },
    ]);
    const { stdout, stderr, status } = runCli(
      ["stats", "--session", "s1", "--json"],
      dir,
    );
    assert.equal(status, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.totals.llmCalls, 1);
    assert.equal(parsed.bySession["s1"].llmCalls, 1);
    assert.ok(!parsed.bySession["s2"]);
  });

  it("handles empty trace file", () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "trace.jsonl"), "");
    const { stderr, status } = runCli(["stats"], dir);
    assert.equal(status, 1);
    assert.ok(stderr.includes("No events found"));
  });

  it("handles --help", () => {
    const dir = makeTempDir();
    const { stdout, status } = runCli(["stats", "--help"], dir);
    assert.equal(status, 0);
    assert.ok(stdout.includes("aggregate and display metrics"));
  });

  it("filters by --since and includes recent events", () => {
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
        timestamp: Date.now(),
      },
    ]);
    const { stdout, stderr, status } = runCli(
      ["stats", "--since", "24h", "--json"],
      dir,
    );
    assert.equal(status, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.totals.llmCalls, 1);
  });

  it("exits with error when --since filters everything out", () => {
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
    const { stderr, status } = runCli(
      ["stats", "--since", "1d", "--json"],
      dir,
    );
    assert.equal(status, 1);
    assert.ok(stderr.includes("No events match"));
  });

  it("filters by --top scopes totals and byAgent to top N agents", () => {
    const dir = makeTempDir();
    writeTrace(dir, [
      {
        type: "llm_call",
        sessionID: "s1",
        agent: "expensive",
        model: "gpt-4",
        finish: "stop",
        inputTokens: 100,
        outputTokens: 200,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.01,
        durationMs: 800,
        timestamp: 1000,
      },
      {
        type: "llm_call",
        sessionID: "s2",
        agent: "medium",
        model: "gpt-4",
        finish: "stop",
        inputTokens: 50,
        outputTokens: 100,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.005,
        durationMs: 500,
        timestamp: 2000,
      },
      {
        type: "llm_call",
        sessionID: "s3",
        agent: "cheap",
        model: "gpt-4",
        finish: "stop",
        inputTokens: 10,
        outputTokens: 20,
        reasoningTokens: 0,
        cacheRead: 0,
        cost: 0.001,
        durationMs: 200,
        timestamp: 3000,
      },
    ]);
    const { stdout, stderr, status } = runCli(
      ["stats", "--top", "2", "--json"],
      dir,
    );
    assert.equal(status, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout);
    const agents = Object.keys(parsed.byAgent);
    assert.equal(agents.length, 2);
    assert.ok(agents.includes("expensive"));
    assert.ok(agents.includes("medium"));
    assert.ok(!agents.includes("cheap"));
    assert.equal(parsed.totals.llmCalls, 2);
    assert.equal(parsed.totals.cost, 0.015);
  });
});
