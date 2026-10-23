import { createEffect, createMemo, onCleanup, Show } from "solid-js";
import { homedir } from "node:os";
import { join } from "node:path";
import { Plugin } from "@opencode/plugin/tui";
import type { Context } from "@opencode/plugin/tui/context";
import { AgentCostPanel } from "./components/agent-cost-panel";
import { FullscreenStatsPanel } from "./components/fullscreen-stats-panel";
import { CursorPersistence, TuiStorageCursors } from "./cursor-store";
import { TuiMonitor } from "./monitor";
import { createV2PanelTheme } from "./theme.adapter";

export const PLUGIN_ID = "agent-monitor.tui";
export const SIDEBAR_SLOT = "sidebar.content";
export const PANEL_SLOT = "session.panel";
export const PANEL_NAME = "agent-monitor.stats";
export const TOGGLE_COMMAND = "agent-monitor.toggle";

function resolveTraceDir(options: Readonly<Record<string, unknown>>): string {
  if (typeof options.traceDir === "string") return options.traceDir;
  if (typeof process.env.AGENT_MONITOR_DIR === "string") {
    return process.env.AGENT_MONITOR_DIR;
  }
  return join(homedir(), ".config", "opencode", ".tracing");
}

function togglePanel(context: Context): void {
  if (context.ui.panel.current()?.name === PANEL_NAME) {
    context.ui.panel.close();
    return;
  }

  if (!context.ui.panel.open(PANEL_NAME, { presentation: "fullscreen" })) {
    context.ui.toast.show({
      variant: "info",
      message: "Open a session to show the agent monitor",
    });
  }
}

function SidebarContentPanel(props: {
  monitor: TuiMonitor;
  sessionID?: string;
}) {
  createEffect(() => {
    const sessionID = props.sessionID;
    if (sessionID) {
      props.monitor.switchSession(sessionID);
    }
  });

  onCleanup(() => props.monitor.stopSession());

  const snapshot = createMemo(() => props.monitor.snapshotFor(props.sessionID));

  return <AgentCostPanel snapshot={snapshot()} theme={props.monitor.theme} />;
}

const plugin = Plugin.define({
  id: PLUGIN_ID,
  setup(context) {
    const cursors = new CursorPersistence(
      new TuiStorageCursors(context.storage),
    );
    const monitor = new TuiMonitor({
      traceDir: resolveTraceDir(context.options),
      theme: createV2PanelTheme(context.theme),
      cursors,
      onError: (error) =>
        context.ui.toast.show({
          variant: "error",
          title: "Session watcher error",
          message: error.message,
        }),
    });

    const unregisterSidebar = context.ui.slot({
      append: SIDEBAR_SLOT,
      render: ({ sessionID }) => (
        <SidebarContentPanel monitor={monitor} sessionID={sessionID} />
      ),
    });

    const unregisterPanel = context.ui.slot({
      append: PANEL_SLOT,
      render: (panel) => (
        <Show when={panel.name === PANEL_NAME}>
          <FullscreenStatsPanel monitor={monitor} panel={panel} />
        </Show>
      ),
    });

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: TOGGLE_COMMAND,
          title: "Toggle agent monitor",
          description: "Toggle the agent monitor statistics panel",
          group: "Agent Monitor",
          bind: "ctrl+a",
          palette: true,
          run: () => togglePanel(context),
        },
      ],
    }));

    return async () => {
      unregisterSidebar();
      unregisterPanel();
      await monitor.dispose();
    };
  },
});

export default plugin;
