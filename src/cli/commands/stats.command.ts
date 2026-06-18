import { Command } from "commander";
import { homedir } from "node:os";
import { join } from "node:path";
import { readEvents } from "../reader";
import { aggregate, filterEvents, parseDuration } from "../aggregate";
import { formatMarkdown } from "../../server/metrics/formatters/markdown";
import { formatJson } from "../../server/metrics/formatters/json";

const defaultDir = join(homedir(), ".config", "opencode", ".tracing");

export function registerStatsCommand(program: Command): void {
  program
    .command("stats")
    .description("aggregate and display metrics from trace files")
    .option("--dir <path>", "trace directory", defaultDir)
    .option("--json", "output as JSON")
    .option("--markdown", "output as markdown")
    .option("--md", "output as markdown (alias)")
    .option("--since <duration>", "time filter: 1d, 24h, 7d, 30d, all", "all")
    .option("--session <id>", "filter to a specific session")
    .option("--top <n>", "show top N entries by cost", parseInt)
    .action((options) => {
      const dir: string = options.dir;
      const useJson = !!options.json;
      const since = parseDuration(options.since);
      const sessionID: string | undefined = options.session;

      const events = readEvents(dir);
      if (!events.length) {
        process.stderr.write(`No events found in ${dir}\n`);
        process.exit(1);
      }

      const filtered = filterEvents(events, since, sessionID);
      if (!filtered.length) {
        process.stderr.write("No events match the given filters\n");
        process.exit(1);
      }

      const snap = aggregate(filtered);

      if (useJson) {
        process.stdout.write(formatJson(snap) + "\n");
      } else {
        process.stdout.write(formatMarkdown(snap) + "\n");
      }
    });
}
