import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

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

type Aggregate = {
  llmCalls: number;
  llmErrors: number;
  toolCalls: number;
  toolErrors: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cacheRead: number;
  };
  cost: number;
  durationMs: { sum: number; count: number; min: number; max: number };
};

type ToolStats = {
  calls: number;
  errors: number;
  durationMs: { sum: number; count: number; min: number; max: number };
};

type SessionInfo = {
  llmCalls: number;
  toolCalls: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cacheRead: number;
  };
  cost: number;
  errors: number;
};

type ErrorEntry = {
  sessionID: string;
  type: string;
  message: string;
  timestamp: number;
};

type Snapshot = {
  totals: Aggregate & { sessionsCreated: number; sessionErrors: number };
  byAgent: Record<string, Aggregate>;
  byTool: Record<string, ToolStats>;
  bySession: Record<string, SessionInfo>;
  errors: ErrorEntry[];
  window: { firstSeenAt: number; lastSeenAt: number };
};

function emptyAggregate(): Aggregate {
  return {
    llmCalls: 0,
    llmErrors: 0,
    toolCalls: 0,
    toolErrors: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
    cost: 0,
    durationMs: { sum: 0, count: 0, min: Infinity, max: -Infinity },
  };
}

function emptySession(): SessionInfo {
  return {
    llmCalls: 0,
    toolCalls: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
    cost: 0,
    errors: 0,
  };
}

function addDuration(
  slot: { sum: number; count: number; min: number; max: number },
  value: number,
): void {
  if (!Number.isFinite(value)) return;
  slot.sum += value;
  slot.count += 1;
  if (value < slot.min) slot.min = value;
  if (value > slot.max) slot.max = value;
}

function addLlm(agg: Aggregate, ev: LlmCallEvent): void {
  agg.llmCalls += 1;
  agg.tokens.input += ev.inputTokens;
  agg.tokens.output += ev.outputTokens;
  agg.tokens.reasoning += ev.reasoningTokens;
  agg.tokens.cacheRead += ev.cacheRead;
  agg.cost += ev.cost;
  addDuration(agg.durationMs, ev.durationMs);
}

function addTool(agg: Aggregate, ev: ToolCallEvent): void {
  agg.toolCalls += 1;
  if (ev.status === "error") agg.toolErrors += 1;
  addDuration(agg.durationMs, ev.durationMs);
}

function getOrCreate<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  let v = map.get(key);
  if (!v) {
    v = factory();
    map.set(key, v);
  }
  return v;
}

function parseArgs(argv: string[]): {
  dir: string;
  format: "markdown" | "json";
} {
  let dir = join(homedir(), ".config", "opencode", ".tracing");
  let format: "markdown" | "json" = "markdown";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dir") {
      const next = argv[i + 1];
      if (!next) throw new Error("--dir requires a value");
      dir = next;
      i++;
    } else if (arg === "--json") {
      format = "json";
    } else if (arg === "--markdown" || arg === "--md") {
      format = "markdown";
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { dir, format };
}

function printUsage(): void {
  process.stdout.write(
    [
      "Usage: tsx scripts/metrics.mts [--dir <path>] [--json|--markdown]",
      "",
      "Options:",
      "  --dir <path>   Trace directory (default: ~/.config/opencode/.tracing)",
      "  --json         Output aggregated metrics as JSON",
      "  --markdown     Output aggregated metrics as Markdown (default)",
      "  -h, --help     Show this help",
      "",
    ].join("\n"),
  );
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  const out: T[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {}
  }
  return out;
}

function aggregate(events: TraceEvent[]): Snapshot {
  const totals = {
    ...emptyAggregate(),
    sessionsCreated: 0,
    sessionErrors: 0,
  };
  const byAgent = new Map<string, Aggregate>();
  const byTool = new Map<string, ToolStats>();
  const bySession = new Map<string, SessionInfo>();
  const errors: ErrorEntry[] = [];
  let firstSeenAt = 0;
  let lastSeenAt = 0;

  const touch = (ts: number): void => {
    if (firstSeenAt === 0 || ts < firstSeenAt) firstSeenAt = ts;
    if (ts > lastSeenAt) lastSeenAt = ts;
  };

  for (const ev of events) {
    touch(ev.timestamp);

    switch (ev.type) {
      case "llm_call": {
        addLlm(totals, ev);
        addLlm(getOrCreate(byAgent, ev.agent, emptyAggregate), ev);

        const session = getOrCreate(bySession, ev.sessionID, emptySession);
        session.llmCalls += 1;
        session.tokens.input += ev.inputTokens;
        session.tokens.output += ev.outputTokens;
        session.tokens.reasoning += ev.reasoningTokens;
        session.tokens.cacheRead += ev.cacheRead;
        session.cost += ev.cost;
        break;
      }

      case "tool_call": {
        addTool(totals, ev);
        const tool = getOrCreate(byTool, ev.tool, () => ({
          calls: 0,
          errors: 0,
          durationMs: { sum: 0, count: 0, min: Infinity, max: -Infinity },
        }));
        tool.calls += 1;
        if (ev.status === "error") tool.errors += 1;
        addDuration(tool.durationMs, ev.durationMs);

        const session = getOrCreate(bySession, ev.sessionID, emptySession);
        session.toolCalls += 1;
        break;
      }

      case "session_created": {
        totals.sessionsCreated += 1;
        getOrCreate(bySession, ev.sessionID, emptySession);
        break;
      }

      case "session_error": {
        totals.sessionErrors += 1;
        const session = getOrCreate(bySession, ev.sessionID, emptySession);
        session.errors += 1;
        errors.push({
          sessionID: ev.sessionID,
          type: ev.errorType ?? "Unknown",
          message: ev.errorMessage ?? ev.error ?? "",
          timestamp: ev.timestamp,
        });
        break;
      }
    }
  }

  const finalize = (a: Aggregate): Aggregate => {
    if (a.durationMs.count === 0) {
      a.durationMs.min = 0;
      a.durationMs.max = 0;
    }
    return a;
  };

  for (const a of byAgent.values()) finalize(a);
  finalize(totals);

  for (const t of byTool.values()) {
    if (t.durationMs.count === 0) {
      t.durationMs.min = 0;
      t.durationMs.max = 0;
    }
  }

  return {
    totals,
    byAgent: Object.fromEntries(
      Array.from(byAgent, ([k, v]) => [k, finalize(v)]),
    ),
    byTool: Object.fromEntries(byTool),
    bySession: Object.fromEntries(bySession),
    errors,
    window: { firstSeenAt, lastSeenAt },
  };
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function formatDuration(slot: {
  sum: number;
  count: number;
  min: number;
  max: number;
}): { avg: string; min: string; max: string } {
  if (slot.count === 0) return { avg: "0", min: "0", max: "0" };
  const avg = Math.round(slot.sum / slot.count);
  return {
    avg: `${formatNumber(avg)}ms`,
    min: `${formatNumber(slot.min)}ms`,
    max: `${formatNumber(slot.max)}ms`,
  };
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatTimestamp(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toISOString();
}

function formatWindow(window: {
  firstSeenAt: number;
  lastSeenAt: number;
}): string {
  if (!window.firstSeenAt || !window.lastSeenAt) return "—";
  const start = new Date(window.firstSeenAt);
  const end = new Date(window.lastSeenAt);
  const diffMs = end.getTime() - start.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${start.toISOString()} → ${end.toISOString()} (${hours}h ${minutes}m)`;
}

function formatMarkdown(snap: Snapshot): string {
  const lines: string[] = [];
  const totals = snap.totals;
  const llmDur = formatDuration(totals.durationMs);

  lines.push("# Agent Monitor Metrics", "");
  lines.push(`**Window:** ${formatWindow(snap.window)}`, "");

  lines.push("## Summary", "");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| LLM Calls | ${formatNumber(totals.llmCalls)} |`);
  lines.push(`| LLM Errors | ${formatNumber(totals.llmErrors)} |`);
  lines.push(`| Tool Calls | ${formatNumber(totals.toolCalls)} |`);
  lines.push(`| Tool Errors | ${formatNumber(totals.toolErrors)} |`);
  lines.push(`| Sessions Created | ${formatNumber(totals.sessionsCreated)} |`);
  lines.push(`| Session Errors | ${formatNumber(totals.sessionErrors)} |`);
  lines.push(`| Input Tokens | ${formatNumber(totals.tokens.input)} |`);
  lines.push(`| Output Tokens | ${formatNumber(totals.tokens.output)} |`);
  lines.push(`| Reasoning Tokens | ${formatNumber(totals.tokens.reasoning)} |`);
  lines.push(
    `| Cache Read Tokens | ${formatNumber(totals.tokens.cacheRead)} |`,
  );
  lines.push(`| Total Cost | ${formatCost(totals.cost)} |`);
  lines.push(`| LLM Avg Duration | ${llmDur.avg} |`);
  lines.push(`| LLM Max Duration | ${llmDur.max} |`);
  lines.push("");

  const agentKeys = Object.keys(snap.byAgent).sort();
  if (agentKeys.length > 0) {
    lines.push("## By Agent", "");
    lines.push(
      "| Agent | LLM Calls | LLM Errors | Input Tokens | Output Tokens | Cost | Avg Duration |",
    );
    lines.push(
      "|-------|-----------|------------|--------------|---------------|------|--------------|",
    );
    for (const k of agentKeys) {
      const a = snap.byAgent[k]!;
      const d = formatDuration(a.durationMs);
      lines.push(
        `| ${k} | ${formatNumber(a.llmCalls)} | ${formatNumber(a.llmErrors)} | ${formatNumber(a.tokens.input)} | ${formatNumber(a.tokens.output)} | ${formatCost(a.cost)} | ${d.avg} |`,
      );
    }
    lines.push("");
  }

  const toolKeys = Object.keys(snap.byTool).sort();
  if (toolKeys.length > 0) {
    lines.push("## By Tool", "");
    lines.push(
      "| Tool | Calls | Errors | Error Rate | Avg Duration | Max Duration |",
    );
    lines.push(
      "|------|-------|--------|------------|--------------|--------------|",
    );
    for (const k of toolKeys) {
      const t = snap.byTool[k]!;
      const d = formatDuration(t.durationMs);
      const rate =
        t.calls > 0 ? ((t.errors / t.calls) * 100).toFixed(1) : "0.0";
      lines.push(
        `| ${k} | ${formatNumber(t.calls)} | ${formatNumber(t.errors)} | ${rate}% | ${d.avg} | ${d.max} |`,
      );
    }
    lines.push("");
  }

  const sessionEntries = Object.entries(snap.bySession)
    .map(([id, s]) => {
      const totalTokens =
        s.tokens.input +
        s.tokens.output +
        s.tokens.reasoning +
        s.tokens.cacheRead;
      return { id, s, totalTokens };
    })
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 10);
  if (sessionEntries.length > 0) {
    lines.push(`## Top Sessions by Tokens (${sessionEntries.length})`, "");
    lines.push(
      "| Session | LLM Calls | Tool Calls | Errors | Total Tokens | Cost |",
    );
    lines.push(
      "|---------|-----------|-----------|--------|--------------|------|",
    );
    for (const { id, s, totalTokens } of sessionEntries) {
      lines.push(
        `| ${id} | ${formatNumber(s.llmCalls)} | ${formatNumber(s.toolCalls)} | ${formatNumber(s.errors)} | ${formatNumber(totalTokens)} | ${formatCost(s.cost)} |`,
      );
    }
    lines.push("");
  }

  if (snap.errors.length > 0) {
    lines.push(`## Errors (${snap.errors.length})`, "");
    lines.push("| Session | Type | Message | Timestamp |");
    lines.push("|---------|------|---------|-----------|");
    for (const e of snap.errors) {
      const message =
        e.message.length > 80 ? e.message.slice(0, 77) + "..." : e.message;
      lines.push(
        `| ${e.sessionID} | ${e.type} | ${message} | ${formatTimestamp(e.timestamp)} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function toJsonSafe(snap: Snapshot): unknown {
  const toNum = (a: Aggregate) => ({
    llmCalls: a.llmCalls,
    llmErrors: a.llmErrors,
    toolCalls: a.toolCalls,
    toolErrors: a.toolErrors,
    tokens: a.tokens,
    cost: a.cost,
    durationMs:
      a.durationMs.count > 0
        ? {
            sum: a.durationMs.sum,
            count: a.durationMs.count,
            min: a.durationMs.min,
            max: a.durationMs.max,
            avg: Math.round(a.durationMs.sum / a.durationMs.count),
          }
        : { sum: 0, count: 0, min: 0, max: 0, avg: 0 },
  });

  const toolSafe: Record<string, unknown> = {};
  for (const [k, t] of Object.entries(snap.byTool)) {
    toolSafe[k] = {
      calls: t.calls,
      errors: t.errors,
      durationMs:
        t.durationMs.count > 0
          ? {
              sum: t.durationMs.sum,
              count: t.durationMs.count,
              min: t.durationMs.min,
              max: t.durationMs.max,
              avg: Math.round(t.durationMs.sum / t.durationMs.count),
            }
          : { sum: 0, count: 0, min: 0, max: 0, avg: 0 },
    };
  }

  return {
    totals: toNum(snap.totals),
    byAgent: Object.fromEntries(
      Object.entries(snap.byAgent).map(([k, v]) => [k, toNum(v)]),
    ),
    byTool: toolSafe,
    bySession: snap.bySession,
    errors: snap.errors,
    window: {
      firstSeenAt: snap.window.firstSeenAt,
      lastSeenAt: snap.window.lastSeenAt,
      firstSeenAtIso: formatTimestamp(snap.window.firstSeenAt),
      lastSeenAtIso: formatTimestamp(snap.window.lastSeenAt),
    },
  };
}

function main(): void {
  let args: { dir: string; format: "markdown" | "json" };
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n\n`);
    printUsage();
    process.exit(1);
  }

  const tracePath = join(args.dir, "trace.jsonl");
  const errorsPath = join(args.dir, "trace.errors.jsonl");

  const main = readJsonl<TraceEvent>(tracePath);
  const errs = readJsonl<TraceEvent>(errorsPath);
  const all = [...main, ...errs];

  if (all.length === 0) {
    process.stderr.write(`No events found in ${tracePath} or ${errorsPath}\n`);
    process.exit(1);
  }

  const snap = aggregate(all);
  const out =
    args.format === "json"
      ? JSON.stringify(toJsonSafe(snap), null, 2)
      : formatMarkdown(snap);

  process.stdout.write(out + "\n");
}

main();
