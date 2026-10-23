import { homedir } from "node:os";
import { join } from "node:path";

type Env = { XDG_CONFIG_HOME?: string; AGENT_MONITOR_DIR?: string };

/**
 * Resolves the trace directory shared by the server plugin, the TUI plugin and
 * the local-development tooling.
 *
 * Order: explicit `traceDir` option → `AGENT_MONITOR_DIR` → OpenCode config
 * directory. `XDG_CONFIG_HOME` is honoured to match OpenCode's own resolution.
 */
export class TraceDirResolver {
  static defaultDir(env: Env = process.env): string {
    const configHome = env.XDG_CONFIG_HOME || join(homedir(), ".config");
    return join(configHome, "opencode", ".tracing");
  }

  static resolve(
    options: Readonly<Record<string, unknown>> = {},
    env: Env = process.env,
  ): string {
    const optionDir = options.traceDir;
    if (typeof optionDir === "string" && optionDir !== "") return optionDir;

    const envDir = env.AGENT_MONITOR_DIR;
    if (typeof envDir === "string" && envDir !== "") return envDir;

    return this.defaultDir(env);
  }
}
