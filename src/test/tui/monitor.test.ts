import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TuiMonitor } from "../../tui/monitor";
import { CursorPersistence } from "../../tui/cursor-store";
import type { PanelTheme } from "../../tui/theme.adapter";
import { TraceEventType } from "../../shared/enums";

const THEME: PanelTheme = {
  text: "text",
  muted: "muted",
  faint: "faint",
  border: "border",
  accent: "accent",
  success: "success",
  warning: "warning",
  info: "info",
  error: "error",
  categorical: () => "categorical",
} as any;

function makeMonitor(traceDir: string) {
  const state: { cursors: Record<string, number> } = { cursors: {} };
  const persistence = new CursorPersistence({
    get: (id: string) => state.cursors[id] ?? 0,
    set: async (id: string, cursor: number) => {
      state.cursors[id] = cursor;
    },
  });
  return {
    state,
    monitor: new TuiMonitor({
      traceDir,
      theme: THEME,
      cursors: persistence,
    }),
    persistence,
  };
}

function writeTrace(dir: string, sessionID: string, events: object[]) {
  writeFileSync(
    join(dir, `${sessionID}.jsonl`),
    events.map((event) => JSON.stringify(event)).join("\n") + "\n",
    "utf-8",
  );
}

function llmCall(overrides: Record<string, unknown> = {}) {
  return {
    type: TraceEventType.LLM_CALL,
    sessionID: "sess-1",
    agent: "coder",
    model: "anthropic/claude-sonnet-4-5",
    finish: "stop",
    inputTokens: 10,
    outputTokens: 20,
    reasoningTokens: 0,
    cacheRead: 0,
    cost: 0.01,
    durationMs: 100,
    timestamp: 1_000,
    ...overrides,
  };
}

function delay(ms = 60) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("TuiMonitor", () => {
  it("starts from an empty snapshot", () => {
    const dir = mkdtempSync(join(tmpdir(), "tui-monitor-empty-"));
    const { monitor } = makeMonitor(dir);

    const snapshot = monitor.snapshot();
    assert.equal(snapshot.totals.llmCalls, 0);
    assert.deepEqual(snapshot.byAgent, {});
  });

  it("ingests backfilled events from the session file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tui-monitor-backfill-"));
    writeTrace(dir, "sess-1", [llmCall(), llmCall({ timestamp: 2_000 })]);
    const { monitor } = makeMonitor(dir);

    monitor.switchSession("sess-1");
    await delay();

    const snapshot = monitor.snapshotFor("sess-1");
    assert.equal(snapshot.totals.llmCalls, 2);
    assert.equal(snapshot.byAgent.coder.llmCalls, 2);
    assert.equal(snapshot.byAgent.coder.cost, 0.02);

    monitor.stopSession();
  });

  it("persists the cursor on stop and resumes without double counting", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tui-monitor-cursor-"));
    writeTrace(dir, "sess-1", [llmCall()]);
    const { monitor, state } = makeMonitor(dir);

    monitor.switchSession("sess-1");
    await delay();
    monitor.stopSession();
    await delay(20);

    assert.ok((state.cursors["sess-1"] ?? 0) > 0);

    monitor.switchSession("sess-1");
    await delay();

    assert.equal(monitor.snapshotFor("sess-1").totals.llmCalls, 1);
    monitor.stopSession();
  });

  it("picks up new lines appended after the initial read", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tui-monitor-live-"));
    writeTrace(dir, "sess-1", [llmCall()]);
    const { monitor } = makeMonitor(dir);

    monitor.switchSession("sess-1");
    await delay();

    writeFileSync(
      join(dir, "sess-1.jsonl"),
      JSON.stringify(llmCall({ timestamp: 2_000 })) + "\n",
      { encoding: "utf-8", flag: "a" },
    );
    await delay(400);

    assert.equal(monitor.snapshotFor("sess-1").totals.llmCalls, 2);
    monitor.stopSession();
  });

  it("dispose stops the watcher and flushes cursors", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tui-monitor-dispose-"));
    writeTrace(dir, "sess-1", [llmCall()]);
    const { monitor, state } = makeMonitor(dir);

    monitor.switchSession("sess-1");
    await monitor.dispose();

    assert.ok((state.cursors["sess-1"] ?? 0) > 0);
  });
});
