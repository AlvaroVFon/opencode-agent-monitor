import type {
  Aggregate,
  MetricsSnapshot,
} from "../metrics/metrics.aggregator.interface";
import type {
  FilteredSnapshot,
  StatsGroupBy,
  StatsToolArgs,
} from "./agent-monitor-stats.interface";

export class StatsFormatter {
  toMarkdown(snapshot: FilteredSnapshot, args: StatsToolArgs): string {
    const lines: string[] = ["## Agent Monitor Stats\n"];

    this.appendTotals(lines, snapshot);

    if (args.groupBy === "agent") {
      this.appendBreakdown(lines, "Agent", snapshot.byAgent);
    } else if (args.groupBy === "model") {
      this.appendBreakdown(lines, "Model", snapshot.byModel);
    }

    return lines.join("\n");
  }

  toJson(
    snapshot: FilteredSnapshot,
    args: StatsToolArgs,
  ): {
    totals: MetricsSnapshot["totals"];
    breakdown?: Record<string, Aggregate>;
  } {
    const result: {
      totals: MetricsSnapshot["totals"];
      breakdown?: Record<string, Aggregate>;
    } = {
      totals: snapshot.totals,
    };

    if (args.groupBy === "agent") {
      result.breakdown = snapshot.byAgent;
    } else if (args.groupBy === "model") {
      result.breakdown = snapshot.byModel;
    }

    return result;
  }

  filterSnapshot(snap: MetricsSnapshot, args: StatsToolArgs): FilteredSnapshot {
    const filtered: FilteredSnapshot = {
      totals: snap.totals,
      bySession: snap.bySession,
      byAgent: snap.byAgent,
      byModel: snap.byModel,
      window: snap.window,
    };

    if (args.sessionID) {
      filtered.bySession =
        args.sessionID in filtered.bySession
          ? { [args.sessionID]: filtered.bySession[args.sessionID] }
          : {};
    }

    return filtered;
  }

  private appendTotals(lines: string[], snapshot: FilteredSnapshot): void {
    const t = snapshot.totals;
    lines.push("| Metric | Value |");
    lines.push("|--------|-------|");
    lines.push(`| Sessions Created | ${t.sessionsCreated} |`);
    lines.push(`| LLM Calls | ${t.llmCalls} |`);
    lines.push(`| LLM Errors | ${t.llmErrors} |`);
    lines.push(`| Tool Calls | ${t.toolCalls} |`);
    lines.push(`| Tool Errors | ${t.toolErrors} |`);
    lines.push(`| Tokens (Input) | ${t.tokens.input.toLocaleString()} |`);
    lines.push(`| Tokens (Output) | ${t.tokens.output.toLocaleString()} |`);
    lines.push(
      `| Tokens (Reasoning) | ${t.tokens.reasoning.toLocaleString()} |`,
    );
    lines.push(
      `| Tokens (Cache Read) | ${t.tokens.cacheRead.toLocaleString()} |`,
    );
    lines.push(`| Cost | $${t.cost.toFixed(4)} |`);
  }

  private appendBreakdown(
    lines: string[],
    label: string,
    data: Record<string, Aggregate>,
  ): void {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    lines.push("");
    lines.push(`### By ${label}`);
    lines.push("");
    lines.push(
      `| ${label} | LLM Calls | LLM Errors | Tool Calls | Tool Errors | Cost |`,
    );
    lines.push("|---|---|---|---|---|---|");

    for (const key of keys) {
      const a = data[key];
      lines.push(
        `| ${key} | ${a.llmCalls} | ${a.llmErrors} | ${a.toolCalls} | ${a.toolErrors} | $${a.cost.toFixed(4)} |`,
      );
    }
  }
}
