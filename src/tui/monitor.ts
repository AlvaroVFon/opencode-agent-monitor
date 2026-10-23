import { createSignal } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import type { MetricsSnapshot } from "../shared/metrics.types";
import { AggregatorStore, type TraceEvent } from "./aggregator-store";
import { SessionWatcher } from "./session-watcher";
import type { CursorPersistence } from "./cursor-store";
import type { PanelTheme } from "./theme.adapter";

export function emptySnapshot(): MetricsSnapshot {
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

export type TuiMonitorOptions = {
  traceDir: string;
  theme: PanelTheme;
  cursors: CursorPersistence;
  onError?: (error: Error) => void;
};

/**
 * Owns the live trace pipeline for the TUI: one session watcher at a time, an
 * in-memory aggregator, and debounced cursor persistence.
 */
export class TuiMonitor {
  readonly theme: PanelTheme;

  private readonly traceDir: string;
  private readonly cursors: CursorPersistence;
  private readonly onError?: (error: Error) => void;
  private readonly store: AggregatorStore;
  private readonly snapshotSignal: Accessor<MetricsSnapshot>;
  private readonly setSnapshotSignal: Setter<MetricsSnapshot>;
  private watcher: SessionWatcher | undefined;
  private activeSessionID: string | undefined;

  constructor(options: TuiMonitorOptions) {
    this.traceDir = options.traceDir;
    this.theme = options.theme;
    this.cursors = options.cursors;
    this.onError = options.onError;
    const [snapshotSignal, setSnapshotSignal] =
      createSignal<MetricsSnapshot>(emptySnapshot());
    this.snapshotSignal = snapshotSignal;
    this.setSnapshotSignal = setSnapshotSignal;
    this.store = new AggregatorStore({
      onSnapshot: (snapshot) => this.setSnapshot(snapshot),
    });
    this.setSnapshot(this.store.snapshot());
  }

  /** Full snapshot; reactive when read inside a Solid computation. */
  snapshot(): MetricsSnapshot {
    return this.snapshotSignal();
  }

  /** Session-scoped snapshot (includes delegated child sessions). */
  snapshotFor(sessionID?: string): MetricsSnapshot {
    // Subscribe before computing so ingest() invalidates memo consumers.
    this.snapshotSignal();
    return sessionID
      ? this.store.snapshot({ sessionID })
      : this.store.snapshot();
  }

  switchSession(sessionID: string): void {
    if (this.activeSessionID === sessionID && this.watcher) return;
    this.stopSession();

    const cursor = this.cursors.cursorFor(sessionID);
    const backfill = cursor === 0;

    const watcher = new SessionWatcher(this.traceDir, sessionID, {
      onLine: (line) => {
        this.store.ingest(
          line as TraceEvent,
          backfill ? { silent: true } : undefined,
        );
        this.cursors.schedule(sessionID, watcher.cursor);
      },
      onError: (error) => this.onError?.(error),
    });

    this.watcher = watcher;
    this.activeSessionID = sessionID;

    try {
      watcher.start(cursor);
      // The initial backfill is read synchronously by start().
      if (backfill) this.store.flush();
    } catch (error) {
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  stopSession(): void {
    if (this.watcher && this.activeSessionID) {
      this.cursors.schedule(this.activeSessionID, this.watcher.cursor);
      void this.cursors.flush();
      this.watcher.stop();
    }
    this.watcher = undefined;
    this.activeSessionID = undefined;
  }

  async dispose(): Promise<void> {
    this.stopSession();
    await this.cursors.dispose();
  }

  private setSnapshot(snapshot: MetricsSnapshot): void {
    this.setSnapshotSignal(() => snapshot);
  }
}
