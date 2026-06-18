import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const CLI_ENTRY = "src/cli/main.ts";
const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cli-export-test-"));
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

describe("export command", () => {
  it("outputs CSV to stdout by default", () => {
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
    const { stdout, stderr, status } = runCli(["export"], dir);
    assert.equal(status, 0, `stderr: ${stderr}`);
    assert.ok(stdout.includes("llmCalls"));
    assert.ok(stdout.includes("totals"));
    assert.ok(stdout.includes("1"));
  });

  it("outputs JSON with --format json", () => {
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
    const { stdout, stderr, status } = runCli(
      ["export", "--format", "json"],
      dir,
    );
    assert.equal(status, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.totals.llmCalls, 1);
    assert.equal(parsed.byAgent.coder.cost, 0.002);
  });

  it("writes to file with --out", () => {
    const dir = makeTempDir();
    const outFile = path.join(dir, "report.csv");
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
    const { stderr, status } = runCli(["export", "--out", outFile], dir);
    assert.equal(status, 0, `stderr: ${stderr}`);
    assert.ok(fs.existsSync(outFile));
    const content = fs.readFileSync(outFile, "utf8");
    assert.ok(content.includes("llmCalls"));
    assert.ok(content.includes("1"));
  });

  it("handles empty trace file with exit code 1", () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "trace.jsonl"), "");
    const { stderr, status } = runCli(["export"], dir);
    assert.equal(status, 1);
    assert.ok(stderr.includes("No events found"));
  });

  it("handles --help", () => {
    const dir = makeTempDir();
    const { stdout, status } = runCli(["export", "--help"], dir);
    assert.equal(status, 0);
    assert.ok(stdout.includes("export aggregated metrics to a file"));
  });

  it("filters by --since and exports recent events as json", () => {
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
      ["export", "--since", "24h", "--format", "json"],
      dir,
    );
    assert.equal(status, 0, `stderr: ${stderr}`);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.totals.llmCalls, 1);
  });
});
