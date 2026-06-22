import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { homedir } from "node:os";
import { join } from "node:path";
import type { PluginOptions } from "@opencode-ai/plugin";
import type {
  TuiPlugin,
  TuiPluginApi,
  TuiPluginMeta,
  TuiThemeCurrent,
} from "@opencode-ai/plugin/tui";
import type { TuiSlotPlugin } from "@opencode-ai/plugin/tui";
import type { MetricsSnapshot } from "../shared/metrics.types.js";
import { AggregatorStore, type TraceEvent } from "./aggregator-store.js";
import { SessionWatcher } from "./session-watcher.js";
import { sessionFS } from "../shared/session-fs.js";
import { AgentCostPanel } from "./components/agent-cost-panel.js";
import { FullscreenStatsDialog } from "./components/fullscreen-stats-dialog.js";

export const SIDEBAR_ORDER = 1;

const id = "agent-monitor-tui";

function emptySnapshot(): MetricsSnapshot {
  return {
    totals: {
      llmCalls: 0,
      llmErrors: 0,
      toolCalls: 0,
      toolErrors: 0,
      skillCalls: 0,
      skillErrors: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0 },
      cost: 0,
      workDurationMs: 0,
      sessionsCreated: 0,
      sessionErrors: 0,
    },
    byAgent: {},
    bySession: {},
    byModel: {},
    byAgentModel: {},
    byTool: {},
    bySkill: {},
    errors: [],
    window: { firstSeenAt: 0, lastSeenAt: 0 },
    lastActiveAgent: null,
  };
}

const tui: TuiPlugin = async (
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
  //    even if watcher setup fails.
  const theme = (): TuiThemeCurrent => api.theme.current;

  // Resolve trace directory once.
  const traceDir =
    typeof options?.traceDir === "string"
      ? options.traceDir
      : typeof process.env.AGENT_MONITOR_DIR === "string"
        ? process.env.AGENT_MONITOR_DIR
        : join(homedir(), ".config", "opencode", ".tracing");

  // Watcher state — managed by createEffect inside SidebarContentPanel.
  let watcher: SessionWatcher | undefined;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  let activeSessionId: string | undefined;

  const persistCursorForSession = (sid: string): void => {
    if (!watcher) return;
    const safeId = sessionFS.sanitizeSessionId(sid);
    api.kv.set(`agent_monitor_cursor_${safeId}`, watcher.cursor);
  };

  const schedulePersistCursor = (): void => {
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
      persistTimer = undefined;
      if (activeSessionId && watcher) {
        const safeId = sessionFS.sanitizeSessionId(activeSessionId);
        api.kv.set(`agent_monitor_cursor_${safeId}`, watcher.cursor);
      }
    }, 1000);
  };

  // Reactive wrapper so signal reads are tracked inside Solid's tree.
  function SidebarContentPanel(props: { sessionID?: string }) {
    const activeSnap = createMemo(() => {
      const fullSnap = snapshot() ?? store.snapshot();
      return props.sessionID
        ? store.snapshot({ sessionID: props.sessionID })
        : fullSnap;
    });

    // Reactively manage SessionWatcher lifecycle on sessionID change.
    createEffect(() => {
      const sid = props.sessionID;
      if (!sid) return;

      // Stop old watcher and persist its cursor before switching.
      if (watcher && activeSessionId) {
        persistCursorForSession(activeSessionId);
        watcher.stop();
        watcher = undefined;
      }

      // Retrieve stored cursor for the new session.
      const safeId = sessionFS.sanitizeSessionId(sid);
      const storedCursor = api.kv.get(`agent_monitor_cursor_${safeId}`, 0);
      const cursor =
        typeof storedCursor === "number"
          ? storedCursor
          : Number(storedCursor) || 0;

      // Track whether this is an initial backfill (cursor === 0).
      let backfillMode = cursor === 0;

      watcher = new SessionWatcher(traceDir, sid, {
        onLine: (line) => {
          store.ingest(
            line as TraceEvent,
            backfillMode ? { silent: true } : undefined,
          );
          schedulePersistCursor();
        },
        onError: (err) => {
          api.ui.toast({
            variant: "error",
            title: "Session watcher error",
            message: err.message,
          });
        },
      });

      activeSessionId = sid;
      watcher.start(cursor);

      // Initial backfill completes synchronously in start().
      // If we loaded from cursor 0, flush the accumulated silent batch.
      if (backfillMode) {
        backfillMode = false;
        store.flush();
      }
    });

    onCleanup(() => {
      // If this component unmounts, stop the watcher and persist cursor.
      if (watcher && activeSessionId) {
        persistCursorForSession(activeSessionId);
        watcher.stop();
        watcher = undefined;
        activeSessionId = undefined;
      }
    });

    return <AgentCostPanel snapshot={activeSnap()} theme={theme()} />;
  }

  api.slots.register({
    order: SIDEBAR_ORDER,
    slots: {
      sidebar_content: (_ctx, props) => (
        <SidebarContentPanel sessionID={props.session_id} />
      ),
    },
  } satisfies TuiSlotPlugin);

  // 3. Fullscreen dialog state.
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

  // 4. Register keymap layer.
  const unregisterKeymap = api.keymap.registerLayer({
    commands: [
      {
        name: "agent-monitor.toggle",
        title: "Toggle agent monitor",
        description: "Toggle the agent monitor fullscreen stats dialog",
        run: () => {
          if (dialogOpen) {
            closeDialog();
          } else {
            openDialog();
          }
          return true;
        },
      },
    ],
    bindings: [
      {
        key: "ctrl+a",
        cmd: "agent-monitor.toggle",
      },
    ],
  });

  // 5. Lifecycle cleanup.
  api.lifecycle.onDispose(() => {
    watcher?.stop();
    unregisterKeymap();
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = undefined;
    }
    if (watcher && activeSessionId) {
      persistCursorForSession(activeSessionId);
    }
  });
};

export default { id, tui };
