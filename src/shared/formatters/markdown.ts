import type { MetricsSnapshot } from "../metrics.types";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

export function formatMarkdown(snap: MetricsSnapshot): string {
  const lines: string[] = [];
  const t = snap.totals;

  lines.push("# Agent Monitor Metrics", "");
  lines.push("## Summary", "");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| LLM Calls | ${fmt(t.llmCalls)} |`);
  lines.push(`| LLM Errors | ${fmt(t.llmErrors)} |`);
  lines.push(`| Tool Calls | ${fmt(t.toolCalls)} |`);
  lines.push(`| Tool Errors | ${fmt(t.toolErrors)} |`);
  lines.push(`| Sessions Created | ${fmt(t.sessionsCreated)} |`);
  lines.push(`| Session Errors | ${fmt(t.sessionErrors)} |`);
  lines.push(`| Input Tokens | ${fmt(t.tokens.input)} |`);
  lines.push(`| Output Tokens | ${fmt(t.tokens.output)} |`);
  lines.push(`| Reasoning Tokens | ${fmt(t.tokens.reasoning)} |`);
  lines.push(`| Cache Read Tokens | ${fmt(t.tokens.cacheRead)} |`);
  lines.push(`| Total Cost | ${fmtCost(t.cost)} |`);
  lines.push("");

  const agentKeys = Object.keys(snap.byAgent).sort();
  if (agentKeys.length > 0) {
    lines.push("## By Agent", "");
    lines.push("| Agent | LLM Calls | LLM Errors | Cost |");
    lines.push("|-------|-----------|------------|------|");
    for (const k of agentKeys) {
      const a = snap.byAgent[k]!;
      lines.push(
        `| ${k} | ${fmt(a.llmCalls)} | ${fmt(a.llmErrors)} | ${fmtCost(a.cost)} |`,
      );
    }
    lines.push("");
  }

  const toolKeys = Object.keys(snap.byTool).sort();
  if (toolKeys.length > 0) {
    lines.push("## By Tool", "");
    lines.push("| Tool | Calls | Errors | Error Rate | Duration (ms) |");
    lines.push("|------|-------|--------|------------|---------------|");
    for (const k of toolKeys) {
      const ts = snap.byTool[k]!;
      const rate =
        ts.calls > 0 ? ((ts.errors / ts.calls) * 100).toFixed(1) : "0.0";
      lines.push(
        `| ${k} | ${fmt(ts.calls)} | ${fmt(ts.errors)} | ${rate}% | ${fmt(ts.durationMs)} |`,
      );
    }
    lines.push("");
  }

  if (snap.errors.length > 0) {
    lines.push(`## Errors (${snap.errors.length})`, "");
    lines.push("| Session | Type | Message |");
    lines.push("|---------|------|---------|");
    for (const e of snap.errors) {
      const msg =
        e.message.length > 80 ? e.message.slice(0, 77) + "..." : e.message;
      lines.push(`| ${e.sessionID} | ${e.type} | ${msg} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
