import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../..",
);
const CLI_ENTRY = path.join(repoRoot, "src/cli/main.ts");
const TSX_PATH = path.join(repoRoot, "node_modules/tsx/dist/loader.mjs");
const tempDirs: string[] = [];
const cleanupFiles: string[] = [];

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
  cwd?: string,
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(
    "node",
    ["--import", TSX_PATH, CLI_ENTRY, ...args, "--dir", dir],
    {
      cwd: cwd ?? process.cwd(),
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
  while (cleanupFiles.length > 0) {
    const file = cleanupFiles.pop();
    if (file) {
      try {
        fs.unlinkSync(file);
      } catch {}
    }
  }
});

describe("export command", () => {
  it("writes CSV to default filename when --out is omitted", () => {
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
    const outPath = path.join(dir, "metrics.csv");
    const { stderr, status } = runCli(["export"], dir, dir);
    assert.equal(status, 0, `stderr: ${stderr}`);
    assert.ok(fs.existsSync(outPath));
    const content = fs.readFileSync(outPath, "utf8");
    assert.ok(content.includes("llmCalls"));
    assert.ok(content.includes("totals"));
    assert.ok(content.includes("1"));
  });

  it("outputs JSON with --format json", () => {
    const dir = makeTempDir();
    const outFile = path.join(dir, "metrics.json");
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
      ["export", "--format", "json", "--out", outFile],
      dir,
    );
    assert.equal(status, 0, `stderr: ${stderr}`);
    assert.ok(fs.existsSync(outFile));
    const content = fs.readFileSync(outFile, "utf8");
    const parsed = JSON.parse(content);
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
    const outFile = path.join(dir, "metrics.json");
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
    const { stderr, status } = runCli(
      ["export", "--since", "24h", "--format", "json", "--out", outFile],
      dir,
    );
    assert.equal(status, 0, `stderr: ${stderr}`);
    assert.ok(fs.existsSync(outFile));
    const content = fs.readFileSync(outFile, "utf8");
    const parsed = JSON.parse(content);
    assert.equal(parsed.totals.llmCalls, 1);
  });
});
