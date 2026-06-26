import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const CLI_ENTRY = "src/cli/main.ts";
const tempDirs: string[] = [];
const tempFiles: string[] = [];

const PROJECT_ROOT = new URL("../../..", import.meta.url).pathname;

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashboard-cmd-test-"));
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

function runCli(args: string[]): {
  stdout: string;
  stderr: string;
  status: number | null;
} {
  const result = spawnSync("node", ["--import", "tsx", CLI_ENTRY, ...args], {
    encoding: "utf8",
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}

afterEach(() => {
  for (const file of tempFiles) {
    try {
      fs.rmSync(file, { force: true });
    } catch {}
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {}
    }
  }
});

describe("dashboard command", () => {
  it("writes to default ./dashboard.html when no output arg is given", () => {
    const traceDir = makeTempDir();
    writeTrace(traceDir, [
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

    const defaultOut = path.join(PROJECT_ROOT, "dashboard.html");
    tempFiles.push(defaultOut);

    const { stdout, stderr, status } = runCli(["dashboard", "--dir", traceDir]);
    assert.equal(status, 0, `stderr: ${stderr}`);
    assert.ok(fs.existsSync(defaultOut), "default output file should exist");
    const content = fs.readFileSync(defaultOut, "utf-8");
    assert.ok(content.includes("Agent Monitor Dashboard"));
    assert.ok(stdout.includes("Dashboard written to"));
  });

  it("writes to custom output path", () => {
    const traceDir = makeTempDir();
    const outDir = makeTempDir();
    const outPath = path.join(outDir, "report.html");
    writeTrace(traceDir, [
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
    const { stdout, stderr, status } = runCli([
      "dashboard",
      outPath,
      "--dir",
      traceDir,
    ]);
    assert.equal(status, 0, `stderr: ${stderr}`);
    assert.ok(fs.existsSync(outPath), "custom output file should exist");
    const content = fs.readFileSync(outPath, "utf-8");
    assert.ok(content.includes("Agent Monitor Dashboard"));
    assert.ok(stdout.includes("Dashboard written to"));
  });

  it("--theme dark injects dark palette CSS vars in output", () => {
    const traceDir = makeTempDir();
    const outDir = makeTempDir();
    const outPath = path.join(outDir, "dark.html");
    writeTrace(traceDir, [
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
    const { stdout, stderr, status } = runCli([
      "dashboard",
      outPath,
      "--dir",
      traceDir,
      "--theme",
      "dark",
    ]);
    assert.equal(status, 0, `stderr: ${stderr}`);
    const content = fs.readFileSync(outPath, "utf-8");
    // Dark theme CSS vars
    assert.ok(content.includes("#111827"), "dark bg color present");
    assert.ok(content.includes("#f9fafb"), "dark text color present");
    // Theme toggle script should be present
    assert.ok(
      content.includes("dashboard-theme"),
      "theme toggle localStorage key in output",
    );
    assert.ok(stdout.includes("Dashboard written to"));
  });

  it("handles empty trace directory — exit 0 with 'No session data'", () => {
    const traceDir = makeTempDir();
    const outDir = makeTempDir();
    const outPath = path.join(outDir, "empty.html");
    const { stdout, stderr, status } = runCli([
      "dashboard",
      outPath,
      "--dir",
      traceDir,
    ]);
    assert.equal(status, 0, `stderr: ${stderr}`);
    assert.ok(
      fs.existsSync(outPath),
      "output file should exist even when empty",
    );
    const content = fs.readFileSync(outPath, "utf-8");
    assert.ok(content.includes("No session data"));
    assert.ok(stdout.includes("Dashboard written to"));
  });
});
