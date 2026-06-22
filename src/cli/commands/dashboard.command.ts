import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { traceReader } from "../reader";
import { cliAggregator } from "../aggregate";
import { dashboardAggregator } from "../dashboard/dashboard-aggregator";
import { dashboardRenderer } from "../dashboard/dashboard-renderer";

export class DashboardCommand {
  private defaultDir = join(homedir(), ".config", "opencode", ".tracing");

  register(program: Command): void {
    program
      .command("dashboard [output]")
      .description("generate a self-contained HTML dashboard from trace data")
      .option("--dir <path>", "trace directory", this.defaultDir)
      .action((output: string | undefined, options: { dir: string }) => {
        const dir = options.dir ?? this.defaultDir;
        const outputPath = output ?? "./dashboard.html";

        const events = traceReader.readEvents(dir);
        const snap = cliAggregator.aggregate(events);
        const data = dashboardAggregator.build(snap, events);
        const html = dashboardRenderer.render(data);

        writeFileSync(outputPath, html, "utf-8");
        console.log(`Dashboard written to ${outputPath}`);
      });
  }
}
