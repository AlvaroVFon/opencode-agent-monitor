#!/usr/bin/env node
import { Command } from "commander";
import { registerStatsCommand } from "./commands/stats.command";
import { registerErrorsCommand } from "./commands/errors.command";
import { registerExportCommand } from "./commands/export.command";

const program = new Command()
  .name("agent-monitor")
  .description("OpenCode Agent Monitor — metrics CLI")
  .version("0.0.1");

registerStatsCommand(program);
registerErrorsCommand(program);
registerExportCommand(program);

program.parse(process.argv);
