import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  MetricsSnapshot,
  Aggregate,
  ToolStats,
  ErrorEntry,
} from "../src/shared/metrics.types";
import type { TraceEvent } from "../src/shared/trace-events.types";
import {
  emptyAggregate,
  emptyToolStats,
  getOrCreateMapEntry,
  addToAggregate,
} from "../src/shared/aggregate.helpers";
import { formatMarkdown } from "../src/server/metrics/formatters/markdown";
import { formatJson } from "../src/server/metrics/formatters/json";

function parseArgs(argv: string[]): {
  dir: string;
  format: "markdown" | "json";
} {
  let dir = join(homedir(), ".config", "opencode", ".tracing");
  let format: "markdown" | "json" = "markdown";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const n = argv[i + 1];
    if (a === "--dir") {
      if (!n) throw new Error("--dir requires a value");
      dir = n;
      i++;
    } else if (a === "--json") {
      format = "json";
    } else if (a === "--markdown" || a === "--md") {
      format = "markdown";
    } else if (a === "--help" || a === "-h") {
      process.stdout.write(
        "Usage: tsx scripts/metrics.mts [--dir <path>] [--json|--markdown]\n",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  return { dir, format };
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const out: T[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (t)
      try {
        out.push(JSON.parse(t) as T);
      } catch {}
  }
  return out;
}

function aggregate(events: TraceEvent[]): MetricsSnapshot {
  const totals = { ...emptyAggregate(), sessionsCreated: 0, sessionErrors: 0 };
  const byAgent = new Map<string, Aggregate>();
  const byTool = new Map<string, ToolStats>();
  const bySession = new Map<string, Aggregate>();
  const errors: ErrorEntry[] = [];
  let firstSeenAt = 0;
  let lastSeenAt = 0;

  const touch = (ts: number): void => {
    if (!firstSeenAt || ts < firstSeenAt) firstSeenAt = ts;
    if (ts > lastSeenAt) lastSeenAt = ts;
  };

  for (const ev of events) {
    touch(ev.timestamp);
    if (ev.type === "llm_call") {
      const inc: Aggregate = {
        llmCalls: 1,
        llmErrors: 0,
        toolCalls: 0,
        toolErrors: 0,
        tokens: {
          input: ev.inputTokens,
          output: ev.outputTokens,
          reasoning: ev.reasoningTokens,
          cacheRead: ev.cacheRead,
        },
        cost: ev.cost,
        workDurationMs: 0,
      };
      addToAggregate(totals, inc);
      addToAggregate(
        getOrCreateMapEntry(byAgent, ev.agent, emptyAggregate),
        inc,
      );
      addToAggregate(
        getOrCreateMapEntry(bySession, ev.sessionID, emptyAggregate),
        inc,
      );
    } else if (ev.type === "tool_call") {
      totals.toolCalls++;
      if (ev.status === "error") totals.toolErrors++;
      const t = getOrCreateMapEntry(byTool, ev.tool, emptyToolStats);
      t.calls++;
      if (ev.status === "error") t.errors++;
      t.durationMs += ev.durationMs;
      getOrCreateMapEntry(bySession, ev.sessionID, emptyAggregate).toolCalls++;
    } else if (ev.type === "session_created") {
      totals.sessionsCreated++;
      getOrCreateMapEntry(bySession, ev.sessionID, emptyAggregate);
    } else if (ev.type === "session_error") {
      totals.sessionErrors++;
      errors.push({
        sessionID: ev.sessionID,
        type: ev.errorType ?? "Unknown",
        message: ev.errorMessage ?? ev.error ?? "",
        timestamp: ev.timestamp,
      });
    }
  }

  return {
    totals,
    byAgent: Object.fromEntries(byAgent),
    byTool: Object.fromEntries(byTool),
    bySession: Object.fromEntries(bySession),
    byModel: {},
    byAgentModel: {},
    errors,
    window: { firstSeenAt, lastSeenAt },
    lastActiveAgent: null,
  };
}

function main(): void {
  let args: { dir: string; format: "markdown" | "json" };
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }
  const tracePath = join(args.dir, "trace.jsonl");
  const errorsPath = join(args.dir, "trace.errors.jsonl");
  const all = [
    ...readJsonl<TraceEvent>(tracePath),
    ...readJsonl<TraceEvent>(errorsPath),
  ];
  if (!all.length) {
    process.stderr.write(`No events found in ${tracePath} or ${errorsPath}\n`);
    process.exit(1);
  }
  process.stdout.write(
    (args.format === "json"
      ? formatJson(aggregate(all))
      : formatMarkdown(aggregate(all))) + "\n",
  );
}

main();
