import { Plugin } from "@opencode/plugin";
import { TraceHelper } from "./helpers/trace.helpers";
import { LocationFilter } from "./helpers/location.helper";
import { ToolHookHandler } from "./hooks/tool.hooks";
import { createEventHandler } from "./wire/handler-wiring";
import { TraceDirResolver } from "../shared/trace-dir";

/**
 * OpenCode V2 server plugin.
 *
 * Subscribes to the server event stream and the tool hooks, turning them into
 * the versioned JSONL trace consumed by the CLI and the TUI plugin.
 */
export const AgentMonitor = Plugin.define({
  id: "agent-monitor",
  async setup(ctx) {
    const traceHelper = new TraceHelper(TraceDirResolver.resolve(ctx.options));
    const eventHandler = createEventHandler(traceHelper);
    const toolHandler = new ToolHookHandler(traceHelper);
    const locationFilter = new LocationFilter(
      ctx.location?.directory,
      ctx.options.locationFilter ?? process.env.AGENT_MONITOR_LOCATION_FILTER,
    );

    await ctx.tool.hook("execute.before", (event) => toolHandler.before(event));
    await ctx.tool.hook("execute.after", (event) => toolHandler.after(event));

    const controller = new AbortController();
    const onBeforeExit = () => traceHelper.close();
    const debug = process.env.AGENT_MONITOR_DEBUG === "1";
    process.on("beforeExit", onBeforeExit);

    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({
          signal: controller.signal,
        })) {
          const matches = locationFilter.matches(event);
          if (debug) {
            process.stderr.write(
              `[AgentMonitor] ${event.type}${matches ? "" : " (filtered)"}\n`,
            );
          }
          if (!matches) continue;
          try {
            eventHandler.handle(event);
          } catch (error) {
            reportError("failed to handle event", error);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          reportError("event stream terminated", error);
        }
      }
    })();

    return () => {
      controller.abort();
      process.off("beforeExit", onBeforeExit);
      toolHandler.clear();
      traceHelper.close();
    };
  },
});

function reportError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[AgentMonitor] ${context}: ${message}\n`);
}

export default AgentMonitor;
