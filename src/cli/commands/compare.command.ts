import { Command } from "commander";
import { homedir } from "node:os";
import { join } from "node:path";
import { traceReader } from "../reader";
import { cliAggregator } from "../aggregate";
import { TraceEventType } from "../../shared/enums";
import {
  PRICING_REGISTRY,
  calculateModelCost,
  type ModelPricing,
  type Usage,
} from "../../shared/pricing";
import {
  DynamicPricingFetcher,
  mergePricingRegistries,
} from "../../shared/dynamic-pricing";
import type { LlmCallEvent } from "../../shared/trace-events.types";

interface ComparisonRow {
  name: string;
  cost: number;
  diff: number;
  diffPct: number;
}

export class CompareCommand {
  private defaultDir = join(homedir(), ".config", "opencode", ".tracing");
  private fetcher: DynamicPricingFetcher;

  constructor(fetcher?: DynamicPricingFetcher) {
    this.fetcher = fetcher ?? new DynamicPricingFetcher();
  }

  register(program: Command): void {
    program
      .command("compare")
      .description("compare real costs with other models")
      .option("--dir <path>", "trace directory", this.defaultDir)
      .option("--since <duration>", "time filter: 1d, 24h, 7d, 30d, all", "all")
      .option("--session <id>", "filter to a specific session")
      .option(
        "--static-pricing",
        "use the built-in pricing registry only (skip opencode lookup)",
      )
      .action((options) => {
        this.execute(options).catch((err) => {
          process.stderr.write(`Error: ${String(err)}\n`);
          process.exit(1);
        });
      });
  }

  private async execute(options: {
    dir: string;
    since: string;
    session?: string;
    staticPricing?: boolean;
  }): Promise<void> {
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
    const sessionIDs = new Set(llmCalls.map((ev) => ev.sessionID));

    const registry = await this.resolveRegistry(options.staticPricing === true);

    const comparisons = registry.map((model) =>
      this.simulateModel(model, llmCalls),
    );
    comparisons.sort((a, b) => a.cost - b.cost);

    this.printTable(
      totalRealCost,
      comparisons,
      options.staticPricing === true,
      llmCalls.length,
      sessionIDs.size,
    );
  }

  simulateModel(model: ModelPricing, llmCalls: LlmCallEvent[]): ComparisonRow {
    const estimatedCost = llmCalls.reduce((sum, ev) => {
      const usage: Usage = {
        inputTokens: ev.inputTokens,
        outputTokens: ev.outputTokens,
        cacheRead: ev.cacheRead,
        reasoningTokens: ev.reasoningTokens,
      };
      return sum + calculateModelCost(model, usage);
    }, 0);

    return {
      name: `${model.provider}/${model.model}`,
      cost: estimatedCost,
      diff: estimatedCost - totalRealCost(llmCalls),
      diffPct: diffPct(estimatedCost, totalRealCost(llmCalls)),
    };
  }

  private async resolveRegistry(useStatic: boolean): Promise<ModelPricing[]> {
    if (useStatic) {
      return PRICING_REGISTRY;
    }

    const dynamic = await this.fetcher.getPricing();
    if (!dynamic || dynamic.length === 0) {
      return PRICING_REGISTRY;
    }

    return mergePricingRegistries(PRICING_REGISTRY, dynamic);
  }

  private printTable(
    realCost: number,
    comparisons: ComparisonRow[],
    usedStatic: boolean,
    callCount: number,
    sessionCount: number,
  ): void {
    process.stdout.write(`\n# Cost Comparison Report\n\n`);
    process.stdout.write(
      `**Real Cost (current models):** $${realCost.toFixed(4)}\n`,
    );
    process.stdout.write(
      `_Scope: ${callCount} LLM call${callCount === 1 ? "" : "s"} across ${sessionCount} session${sessionCount === 1 ? "" : "s"}_\n\n`,
    );
    if (!usedStatic) {
      process.stdout.write(
        `_Pricing source: opencode models (with built-in fallback)_\n\n`,
      );
    } else {
      process.stdout.write(`_Pricing source: built-in static registry_\n\n`);
    }

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

function totalRealCost(llmCalls: LlmCallEvent[]): number {
  return llmCalls.reduce((sum, ev) => sum + (ev.cost || 0), 0);
}

function diffPct(estimated: number, real: number): number {
  if (real <= 0) return 0;
  return (estimated / real - 1) * 100;
}
