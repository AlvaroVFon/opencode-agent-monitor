import { Command } from "commander";
import { homedir } from "node:os";
import { join } from "node:path";
import { traceReader } from "../reader";
import { cliAggregator } from "../aggregate";
import type { TraceEvent } from "../../shared/trace-events.types";

export class ErrorsCommand {
  private defaultDir = join(homedir(), ".config", "opencode", ".tracing");

  register(program: Command): void {
    program
      .command("errors")
      .description("list errors from trace files")
      .option("--dir <path>", "trace directory", this.defaultDir)
      .option("--since <duration>", "time filter: 1d, 24h, 7d, 30d, all", "all")
      .option("--limit <n>", "max error entries", "50")
      .option("--type <type>", "filter by error type")
      .option("--json", "output as JSON")
      .action((options) => this.execute(options));
  }

  private execute(options: {
    dir: string;
    since: string;
    limit: string;
    type?: string;
    json: boolean;
  }): void {
    const dir = options.dir;
    const since = cliAggregator.parseDuration(options.since);
    const limit = parseInt(options.limit, 10) || 50;
    const typeFilter = options.type;
    const useJson = options.json;

    const events = traceReader.readEvents(dir);
    const filtered = cliAggregator.filterEvents(events, since);

    const rows = this.collectErrors(filtered, typeFilter);

    if (useJson) {
      process.stdout.write(
        JSON.stringify(rows.slice(0, limit), null, 2) + "\n",
      );
    } else {
      process.stdout.write(this.formatErrors(rows, limit));
    }
  }

  private collectErrors(
    events: TraceEvent[],
    typeFilter?: string,
  ): ErrorsRow[] {
    const rows: ErrorsRow[] = [];
    for (const ev of events) {
      if (ev.type === "session_error") {
        if (typeFilter && ev.errorType !== typeFilter) continue;
        rows.push({
          timestamp: ev.timestamp,
          sessionID: ev.sessionID,
          type: ev.errorType ?? "Unknown",
          message: ev.errorMessage ?? ev.error ?? "",
        });
      }
    }
    rows.sort((a, b) => b.timestamp - a.timestamp);
    return rows;
  }

  private formatErrors(rows: ErrorsRow[], limit: number): string {
    const limited = rows.slice(0, limit);
    if (!limited.length) return "No errors found.\n";
    const header = "Timestamp            Session     Type            Message";
    const sep = "-".repeat(header.length);
    const lines = limited.map((r) => {
      const ts = new Date(r.timestamp)
        .toISOString()
        .replace("T", " ")
        .slice(0, 19);
      const session = r.sessionID.padEnd(11).slice(0, 11);
      const type = r.type.padEnd(15).slice(0, 15);
      return `${ts}  ${session}  ${type}  ${r.message}`;
    });
    return [header, sep, ...lines, ""].join("\n");
  }
}

type ErrorsRow = {
  timestamp: number;
  sessionID: string;
  type: string;
  message: string;
};
