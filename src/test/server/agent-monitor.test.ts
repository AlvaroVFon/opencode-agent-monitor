import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AgentMonitor } from "../../server/agent-monitor";
import { makeSessionCreated } from "./fixtures/v2-events";

type AnyFn = (...args: any[]) => any;

function makeContext(
  options: Record<string, unknown>,
  directory: string,
  events: unknown[] = [],
) {
  const hooks = new Map<string, AnyFn>();

  return {
    hooks,
    ctx: {
      options,
      location: { directory },
      tool: {
        hook: async (name: string, callback: AnyFn) => {
          hooks.set(name, callback);
          return { dispose: async () => {} };
        },
      },
      event: {
        subscribe: () =>
          (async function* () {
            for (const event of events) yield event;
          })(),
      },
    },
  };
}

function delay(ms = 50) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("AgentMonitor plugin (V2)", () => {
  it("exposes a stable plugin id", () => {
    assert.equal(AgentMonitor.id, "agent-monitor");
  });

  it("registers both tool hooks during setup", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-monitor-setup-"));
    const { ctx, hooks } = makeContext({ traceDir: dir }, dir);

    const cleanup = await AgentMonitor.setup(ctx as any);

    assert.equal(typeof hooks.get("execute.before"), "function");
    assert.equal(typeof hooks.get("execute.after"), "function");
    await cleanup?.();
  });

  it("writes session.created events from the stream", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-monitor-stream-"));
    const event = makeSessionCreated(
      { sessionID: "sess-live" },
      { location: { directory: dir } },
    );
    const { ctx } = makeContext({ traceDir: dir }, dir, [event]);

    const cleanup = await AgentMonitor.setup(ctx as any);
    await delay();
    await cleanup?.();

    const content = readFileSync(join(dir, "sess-live.jsonl"), "utf-8").trim();
    const parsed = JSON.parse(content);
    assert.equal(parsed.type, "session_created");
    assert.equal(parsed.schemaVersion, 2);
  });

  it("ignores events belonging to another location", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-monitor-location-"));
    const event = makeSessionCreated(
      { sessionID: "sess-other" },
      { location: { directory: join(dir, "other-project") } },
    );
    const { ctx } = makeContext({ traceDir: dir }, dir, [event]);

    const cleanup = await AgentMonitor.setup(ctx as any);
    await delay();
    await cleanup?.();

    assert.equal(existsSync(join(dir, "sess-other.jsonl")), false);
  });

  it("processes every event when locationFilter is all", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agent-monitor-all-"));
    const event = makeSessionCreated(
      { sessionID: "sess-other" },
      { location: { directory: join(dir, "other-project") } },
    );
    const { ctx } = makeContext({ traceDir: dir, locationFilter: "all" }, dir, [
      event,
    ]);

    const cleanup = await AgentMonitor.setup(ctx as any);
    await delay();
    await cleanup?.();

    assert.equal(existsSync(join(dir, "sess-other.jsonl")), true);
  });
});
