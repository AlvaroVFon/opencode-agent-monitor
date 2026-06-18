import { Command } from "commander";
import { homedir } from "node:os";
import { join } from "node:path";
import { traceReader } from "../reader";
import { cliAggregator } from "../aggregate";
import { formatMarkdown } from "../../server/metrics/formatters/markdown";
import { formatJson } from "../../server/metrics/formatters/json";

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
  }): void {
    const dir = options.dir;
    const useJson = options.json;
    const since = cliAggregator.parseDuration(options.since);
    const sessionID = options.session;

    const events = traceReader.readEvents(dir);
    if (!events.length) {
      process.stderr.write(`No events found in ${dir}\n`);
      process.exit(1);
    }

    const filtered = cliAggregator.filterEvents(events, since, sessionID);
    if (!filtered.length) {
      process.stderr.write("No events match the given filters\n");
      process.exit(1);
    }

    const snap = cliAggregator.aggregate(filtered);

    if (useJson) {
      process.stdout.write(formatJson(snap) + "\n");
    } else {
      process.stdout.write(formatMarkdown(snap) + "\n");
    }
  }
}
