import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  MetricsSnapshot,
  Aggregate,
  ToolStats,
  ErrorEntry,
} from "../src/shared/metrics.types";
import { formatMarkdown } from "../src/server/metrics/formatters/markdown";
import { formatJson } from "../src/server/metrics/formatters/json";

type LlmCallEvent = {
  type: "llm_call";
  sessionID: string;
  agent: string;
  model: string;
  finish: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheRead: number;
  cost: number;
  durationMs: number;
  timestamp: number;
};
type ToolCallEvent = {
  type: "tool_call";
  sessionID: string;
  tool: string;
  callID: string;
  status: "completed" | "error";
  durationMs: number;
  error?: string;
  timestamp: number;
};
type SessionCreatedEvent = {
  type: "session_created";
  sessionID: string;
  parentID: string | null;
  timestamp: number;
};
type SessionErrorEvent = {
  type: "session_error";
  sessionID: string;
  errorType?: string;
  errorMessage?: string;
  error?: string;
  timestamp: number;
};
type TraceEvent =
  | LlmCallEvent
  | ToolCallEvent
  | SessionCreatedEvent
  | SessionErrorEvent;

const emptyAgg = (): Aggregate => ({
  llmCalls: 0,
  llmErrors: 0,
  toolCalls: 0,
  toolErrors: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
  cost: 0,
  workDurationMs: 0,
});
const emptyTool = (): ToolStats => ({ calls: 0, errors: 0, durationMs: 0 });
const getOr = <K, V>(m: Map<K, V>, k: K, f: () => V): V =>
  m.get(k) ?? (m.set(k, f()), m.get(k)!);

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
  const totals = { ...emptyAgg(), sessionsCreated: 0, sessionErrors: 0 };
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
  const add = (a: Aggregate, b: Aggregate): void => {
    a.llmCalls += b.llmCalls;
    a.llmErrors += b.llmErrors;
    a.toolCalls += b.toolCalls;
    a.toolErrors += b.toolErrors;
    a.cost += b.cost;
    a.tokens.input += b.tokens.input;
    a.tokens.output += b.tokens.output;
    a.tokens.reasoning += b.tokens.reasoning;
    a.tokens.cacheRead += b.tokens.cacheRead;
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
      add(totals, inc);
      add(getOr(byAgent, ev.agent, emptyAgg), inc);
      add(getOr(bySession, ev.sessionID, emptyAgg), inc);
    } else if (ev.type === "tool_call") {
      totals.toolCalls++;
      if (ev.status === "error") totals.toolErrors++;
      const t = getOr(byTool, ev.tool, emptyTool);
      t.calls++;
      if (ev.status === "error") t.errors++;
      t.durationMs += ev.durationMs;
      getOr(bySession, ev.sessionID, emptyAgg).toolCalls++;
    } else if (ev.type === "session_created") {
      totals.sessionsCreated++;
      getOr(bySession, ev.sessionID, emptyAgg);
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
