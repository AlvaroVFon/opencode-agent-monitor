import { Command } from "commander";
import { homedir } from "node:os";
import { join } from "node:path";
import { traceReader } from "../reader";
import { cliAggregator } from "../aggregate";
import { TraceEventType } from "../../shared/enums";
import { PRICING_REGISTRY, calculateModelCost } from "../../shared/pricing";
import type { LlmCallEvent } from "../../shared/trace-events.types";

export class CompareCommand {
  private defaultDir = join(homedir(), ".config", "opencode", ".tracing");

  register(program: Command): void {
    program
      .command("compare")
      .description("compare real costs with other models")
      .option("--dir <path>", "trace directory", this.defaultDir)
      .option("--since <duration>", "time filter: 1d, 24h, 7d, 30d, all", "all")
      .option("--session <id>", "filter to a specific session")
      .action((options) => this.execute(options));
  }

  private execute(options: {
    dir: string;
    since: string;
    session?: string;
  }): void {
    const dir = options.dir;
    const since = cliAggregator.parseDuration(options.since);
    const sessionID = options.session;

    const events = traceReader.readEvents(dir);
    if (!events.length) {
      process.stderr.write(`No events found in ${dir}\n`);
      process.exit(1);
    }

    const filtered = cliAggregator.filterEvents(events, since, sessionID);
    const llmCalls = filtered.filter(
      (ev): ev is LlmCallEvent => ev.type === TraceEventType.LLM_CALL,
    );

    if (!llmCalls.length) {
      process.stderr.write("No LLM calls found matching the filters\n");
      process.exit(1);
    }

    const totalRealCost = llmCalls.reduce((sum, ev) => sum + (ev.cost || 0), 0);
    const totalUsage = llmCalls.reduce(
      (acc, ev) => {
        acc.inputTokens += ev.inputTokens || 0;
        acc.outputTokens += ev.outputTokens || 0;
        acc.cacheRead += ev.cacheRead || 0;
        acc.reasoningTokens += ev.reasoningTokens || 0;
        return acc;
      },
      {
        inputTokens: 0,
        outputTokens: 0,
        cacheRead: 0,
        reasoningTokens: 0,
      },
    );

    const comparisons = PRICING_REGISTRY.map((model) => {
      const estimatedCost = calculateModelCost(model, totalUsage);
      return {
        name: `${model.provider}/${model.model}`,
        cost: estimatedCost,
        diff: estimatedCost - totalRealCost,
        diffPct:
          totalRealCost > 0 ? (estimatedCost / totalRealCost - 1) * 100 : 0,
      };
    });

    // Sort by cost ascending
    comparisons.sort((a, b) => a.cost - b.cost);

    this.printTable(totalRealCost, comparisons);
  }

  private printTable(
    realCost: number,
    comparisons: {
      name: string;
      cost: number;
      diff: number;
      diffPct: number;
    }[],
  ) {
    process.stdout.write(`\n# Cost Comparison Report\n\n`);
    process.stdout.write(
      `**Real Cost (current models):** $${realCost.toFixed(4)}\n\n`,
    );

    process.stdout.write(`| Model | Est. Cost | Difference | % |\n`);
    process.stdout.write(`| :--- | :--- | :--- | :--- |\n`);

    for (const c of comparisons) {
      const diffStr = (c.diff >= 0 ? "+" : "") + c.diff.toFixed(4);
      const pctStr = (c.diffPct >= 0 ? "+" : "") + c.diffPct.toFixed(1) + "%";
      process.stdout.write(
        `| ${c.name} | $${c.cost.toFixed(4)} | $${diffStr} | ${pctStr} |\n`,
      );
    }
    process.stdout.write(`\n`);
  }
}
