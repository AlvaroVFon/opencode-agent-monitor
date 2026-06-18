import { Command } from "commander";
import { homedir } from "node:os";
import { join } from "node:path";
import { traceReader } from "../reader";
import { cliAggregator } from "../aggregate";
import { formatMarkdown } from "../../server/metrics/formatters/markdown";
import { formatJson } from "../../server/metrics/formatters/json";
import type { MetricsSnapshot } from "../../shared/metrics.types";
import type { TraceEvent } from "../../shared/trace-events.types";
import { TraceEventType } from "../../shared/enums";

export class StatsCommand {
  private defaultDir = join(homedir(), ".config", "opencode", ".tracing");

  register(program: Command): void {
    program
      .command("stats")
      .description("aggregate and display metrics from trace files")
      .option("--dir <path>", "trace directory", this.defaultDir)
      .option("--json", "output as JSON")
      .option("--markdown", "output as markdown")
      .option("--md", "output as markdown (alias)")
      .option("--since <duration>", "time filter: 1d, 24h, 7d, 30d, all", "all")
      .option("--session <id>", "filter to a specific session")
      .option("--top <n>", "show top N entries by cost", parseInt)
      .action((options) => this.execute(options));
  }

  private execute(options: {
    dir: string;
    json: boolean;
    since: string;
    session?: string;
    top?: number;
  }): void {
    const dir = options.dir;
    const useJson = options.json;
    const since = cliAggregator.parseDuration(options.since);
    const sessionID = options.session;
    const top = options.top;

    const events = traceReader.readEvents(dir);
    if (!events.length) {
      process.stderr.write(`No events found in ${dir}\n`);
      process.exit(1);
    }

    let filtered = cliAggregator.filterEvents(events, since, sessionID);
    if (!filtered.length) {
      process.stderr.write("No events match the given filters\n");
      process.exit(1);
    }

    if (top && top > 0) {
      filtered = this.applyTopFilter(filtered, top);
      if (!filtered.length) {
        process.stderr.write("No events match the given filters\n");
        process.exit(1);
      }
    }

    const snap = cliAggregator.aggregate(filtered);
    this.writeOutput(snap, useJson);
  }

  private applyTopFilter(events: TraceEvent[], top: number): TraceEvent[] {
    const full = cliAggregator.aggregate(events);
    const topAgents = new Set(
      Object.entries(full.byAgent)
        .sort(([, a], [, b]) => b.cost - a.cost)
        .slice(0, top)
        .map(([name]) => name),
    );

    const topSessions = new Set<string>();
    for (const ev of events) {
      if (ev.type === TraceEventType.LLM_CALL && topAgents.has(ev.agent)) {
        topSessions.add(ev.sessionID);
      }
    }

    return events.filter((ev) => {
      if (ev.type === TraceEventType.LLM_CALL) return topAgents.has(ev.agent);
      if ("sessionID" in ev)
        return topSessions.has((ev as { sessionID: string }).sessionID);
      return true;
    });
  }

  private writeOutput(snap: MetricsSnapshot, useJson: boolean): void {
    if (useJson) {
      process.stdout.write(formatJson(snap) + "\n");
    } else {
      process.stdout.write(formatMarkdown(snap) + "\n");
    }
  }
}
