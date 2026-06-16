import { createSignal } from "solid-js";
import { homedir } from "node:os";
import { join } from "node:path";
import type { PluginOptions } from "@opencode-ai/plugin";
import type {
  TuiPlugin,
  TuiPluginApi,
  TuiPluginMeta,
  TuiPluginModule,
  TuiThemeCurrent,
} from "@opencode-ai/plugin/tui";
import type { TuiSlotPlugin } from "@opencode-ai/plugin/tui";
import type { MetricsSnapshot } from "../metrics/metrics.aggregator.interface.js";
import { AggregatorStore, type TraceEvent } from "./aggregator-store.js";
import { JsonlTailer } from "./jsonl-tailer.js";
import { AgentCostPanel } from "./components/agent-cost-panel.js";
import { FullscreenStatsDialog } from "./components/fullscreen-stats-dialog.js";

const id = "agent-monitor-tui";

function emptySnapshot(): MetricsSnapshot {
  return {
    totals: {
      llmCalls: 0,
      llmErrors: 0,
      toolCalls: 0,
      toolErrors: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
      cost: 0,
      sessionsCreated: 0,
    },
    byAgent: {},
    bySession: {},
    byModel: {},
    byAgentModel: {},
    window: { firstSeenAt: 0, lastSeenAt: 0 },
  };
}

export const tui: TuiPlugin = async (
  api: TuiPluginApi,
  options?: PluginOptions,
  _meta?: TuiPluginMeta,
) => {
  // 1. Create Solid signal and AggregatorStore (no-io, always succeeds).
  const [snapshot, setSnapshot] =
    createSignal<MetricsSnapshot>(emptySnapshot());
  const store = new AggregatorStore({
    onSnapshot: (s) => setSnapshot(() => s),
  });
  setSnapshot(() => store.snapshot());

  // 2. Register sidebar slot FIRST so the panel always appears,
  //    even if tailer setup fails.
  const theme = (): TuiThemeCurrent => api.theme.current;

  api.slots.register({
    order: 200,
    slots: {
      sidebar_content: (_ctx, props) => (
        <AgentCostPanel
          snapshot={snapshot() ?? store.snapshot()}
          sessionId={props.session_id}
          theme={theme()}
        />
      ),
    },
  } satisfies TuiSlotPlugin);

  // 3. Tailer setup — guarded so an io error doesn't prevent the
  //    sidebar panel from rendering.
  let tailer: JsonlTailer | undefined;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;

  try {
    const traceDir =
      typeof options?.traceDir === "string"
        ? options.traceDir
        : typeof process.env.AGENT_MONITOR_DIR === "string"
          ? process.env.AGENT_MONITOR_DIR
          : join(homedir(), ".config", "opencode", ".tracing");

    const schedulePersistCursor = () => {
      if (persistTimer) return;
      persistTimer = setTimeout(() => {
        persistTimer = undefined;
        api.kv.set("agent_monitor_cursor", tailer!.cursor);
      }, 1000);
    };

    tailer = new JsonlTailer(join(traceDir, "trace.jsonl"), {
      onLine: (line) => {
        store.ingest(line as TraceEvent);
        schedulePersistCursor();
      },
      onError: (err) => {
        api.ui.toast({
          variant: "error",
          title: "Agent monitor tailer error",
          message: err.message,
        });
      },
    });

    const storedCursor = api.kv.get("agent_monitor_cursor", 0);
    const cursor =
      typeof storedCursor === "number"
        ? storedCursor
        : Number(storedCursor) || 0;

    tailer.start(cursor);
  } catch (err) {
    api.ui.toast({
      variant: "error",
      title: "Agent monitor setup failed",
      message: String(err),
    });
  }

  // 4. Fullscreen dialog state.
  let dialogOpen = false;

  const closeDialog = () => {
    dialogOpen = false;
    api.ui.dialog.clear();
  };

  const openDialog = () => {
    if (dialogOpen) return;
    dialogOpen = true;
    api.ui.dialog.replace(
      () => (
        <FullscreenStatsDialog
          snapshot={snapshot() ?? store.snapshot()}
          onClose={closeDialog}
          theme={theme()}
        />
      ),
      () => {
        dialogOpen = false;
      },
    );
  };

  // 5. Register keymap layer.
  const unregisterKeymap = api.keymap.registerLayer({
    commands: [
      {
        name: "agent-monitor.toggle",
        title: "Toggle agent monitor",
        description: "Toggle the agent monitor fullscreen stats dialog",
        run: () => {
          openDialog();
          return true;
        },
      },
    ],
    bindings: [
      {
        key: "ctrl+a",
        command: "agent-monitor.toggle",
      },
    ],
  });

  // 6. Lifecycle cleanup.
  api.lifecycle.onDispose(() => {
    tailer?.stop();
    unregisterKeymap();
    if (persistTimer) {
      clearTimeout(persistTimer);
      if (tailer) {
        api.kv.set("agent_monitor_cursor", tailer.cursor);
      }
    }
  });
};

export default { id, tui } satisfies TuiPluginModule;
