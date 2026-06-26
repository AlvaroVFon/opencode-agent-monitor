#!/usr/bin/env node
import { Command } from "commander";
import { StatsCommand } from "./commands/stats.command";
import { ErrorsCommand } from "./commands/errors.command";
import { ExportCommand } from "./commands/export.command";
import { CompareCommand } from "./commands/compare.command";
import { DashboardCommand } from "./commands/dashboard.command";

export class CliApp {
  private program: Command;

  constructor() {
    this.program = new Command()
      .name("agent-monitor")
      .description("OpenCode Agent Monitor — metrics CLI")
      .version("0.0.1");
  }

  run(argv: string[]): void {
    new StatsCommand().register(this.program);
    new ErrorsCommand().register(this.program);
    new ExportCommand().register(this.program);
    new CompareCommand().register(this.program);
    new DashboardCommand().register(this.program);
    this.program.parse(argv);
  }
}

const app = new CliApp();
app.run(process.argv);
