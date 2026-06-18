import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { traceReader } from "../reader";
import { cliAggregator } from "../aggregate";
import { formatJson } from "../../shared/formatters/json";
import { formatCsv } from "../../shared/formatters/csv";
import { formatMarkdown } from "../../shared/formatters/markdown";

export class ExportCommand {
  private defaultDir = join(homedir(), ".config", "opencode", ".tracing");

  register(program: Command): void {
    program
      .command("export")
      .description("export aggregated metrics to a file")
      .option("--dir <path>", "trace directory", this.defaultDir)
      .option("--format <fmt>", "output format: csv, json, markdown", "csv")
      .option("--out <file>", "output file path (default: metrics.<format>)")
      .option("--since <duration>", "time filter: 1d, 24h, 7d, 30d, all", "all")
      .action((options) => this.execute(options));
  }

  private execute(options: {
    dir: string;
    format: string;
    out?: string;
    since: string;
  }): void {
    const dir = options.dir;
    const format = options.format;
    const out = options.out ?? `metrics.${format}`;
    const since = cliAggregator.parseDuration(options.since);

    const events = traceReader.readEvents(dir);
    if (!events.length) {
      process.stderr.write(`No events found in ${dir}\n`);
      process.exit(1);
    }

    const filtered = cliAggregator.filterEvents(events, since);
    if (!filtered.length) {
      process.stderr.write("No events match the given filters\n");
      process.exit(1);
    }

    const snap = cliAggregator.aggregate(filtered);

    let output: string;
    if (format === "json") {
      output = formatJson(snap) + "\n";
    } else if (format === "markdown") {
      output = formatMarkdown(snap) + "\n";
    } else {
      output = formatCsv(snap) + "\n";
    }

    writeFileSync(out, output, "utf8");
    process.stderr.write(`Written to ${out}\n`);
  }
}
