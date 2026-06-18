import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readEvents } from "../reader";
import { aggregate, filterEvents, parseDuration } from "../aggregate";
import { formatJson } from "../../server/metrics/formatters/json";
import { formatCsv } from "../../server/metrics/formatters/csv";

const defaultDir = join(homedir(), ".config", "opencode", ".tracing");

export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description("export aggregated metrics to a file")
    .option("--dir <path>", "trace directory", defaultDir)
    .option("--format <fmt>", "output format: csv, json", "csv")
    .option("--out <file>", "output file path (default: stdout)")
    .option("--since <duration>", "time filter: 1d, 24h, 7d, 30d, all", "all")
    .action((options) => {
      const dir: string = options.dir;
      const format: string = options.format;
      const out: string | undefined = options.out;
      const since = parseDuration(options.since);

      const events = readEvents(dir);
      if (!events.length) {
        process.stderr.write(`No events found in ${dir}\n`);
        process.exit(1);
      }

      const filtered = filterEvents(events, since);
      if (!filtered.length) {
        process.stderr.write("No events match the given filters\n");
        process.exit(1);
      }

      const snap = aggregate(filtered);

      let output: string;
      if (format === "json") {
        output = formatJson(snap) + "\n";
      } else {
        output = formatCsv(snap) + "\n";
      }

      if (out) {
        writeFileSync(out, output, "utf8");
        process.stderr.write(`Written to ${out}\n`);
      } else {
        process.stdout.write(output);
      }
    });
}
