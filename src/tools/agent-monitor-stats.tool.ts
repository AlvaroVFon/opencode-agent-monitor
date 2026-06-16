import { z } from "zod";
import type { ToolResult } from "@opencode-ai/plugin/tool";
import type { MetricsAggregator } from "../metrics/metrics.aggregator";
import type { StatsToolArgs } from "./agent-monitor-stats.interface";
import { StatsFormatter } from "./agent-monitor-stats.helper";

const StatsArgsSchema = z.object({
  since: z.enum(["1h", "24h", "7d", "all"]).default("24h"),
  groupBy: z.enum(["agent", "model", "tool"]).optional(),
  sessionID: z.string().optional(),
  format: z.enum(["markdown", "json"]).default("markdown"),
});

export function createAgentMonitorStatsTool(aggregator: MetricsAggregator) {
  const formatter = new StatsFormatter();

  return {
    description: [
      "Get aggregated monitoring metrics for the current OpenCode session.",
      "Returns token usage, cost, LLM call counts, and tool usage counts.",
      "Optionally group by agent or model, or filter to a specific session.",
    ].join(" "),
    args: StatsArgsSchema.shape,
    execute: async (
      args: StatsToolArgs,
      _context: unknown,
    ): Promise<ToolResult> => {
      const snap = aggregator.snapshot();
      const filtered = formatter.filterSnapshot(snap, args);

      if (args.format === "json") {
        return {
          output: JSON.stringify(formatter.toJson(filtered, args), null, 2),
        };
      }

      return formatter.toMarkdown(filtered, args);
    },
  };
}
