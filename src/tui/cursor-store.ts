import { untrack } from "solid-js";
import type { Store } from "solid-js/store";
import { sessionFS } from "../shared/session-fs";

export interface CursorStorage {
  get(sessionID: string): number;
  set(sessionID: string, cursor: number): Promise<void> | void;
}

type CursorState = { cursors: Record<string, number> };

type StoreFactory = <Value extends object>(
  key: string,
  options: { initial: Value },
) => readonly [
  Store<Value>,
  (mutation: (draft: Value) => void) => Promise<void>,
];

export const CURSOR_STORE_KEY = "agent-monitor";

/**
 * Durable cursor storage backed by the V2 TUI plugin store.
 *
 * Reads are untracked on purpose: cursor values are written while the watcher
 * runs, and a reactive read inside a component effect would retrigger it.
 */
export class TuiStorageCursors implements CursorStorage {
  private readonly state: Store<CursorState>;
  private readonly update: (
    mutation: (draft: CursorState) => void,
  ) => Promise<void>;

  constructor(storage: { store: StoreFactory }) {
    const [state, update] = storage.store<CursorState>(CURSOR_STORE_KEY, {
      initial: { cursors: {} },
    });
    this.state = state;
    this.update = update;
  }

  get(sessionID: string): number {
    return untrack(() => this.state.cursors[sessionID]) ?? 0;
  }

  set(sessionID: string, cursor: number): Promise<void> {
    return this.update((draft) => {
      draft.cursors[sessionID] = cursor;
    });
  }
}

/**
 * Debounces cursor writes and guarantees a flush on session switch and plugin
 * teardown, mirroring the V1 `api.kv` behaviour.
 */
export class CursorPersistence {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly pending = new Map<string, number>();

  constructor(
    private readonly storage: CursorStorage,
    private readonly debounceMs = 1_000,
  ) {}

  cursorFor(sessionID: string): number {
    return this.storage.get(this.key(sessionID));
  }

  schedule(sessionID: string, cursor: number): void {
    this.pending.set(this.key(sessionID), cursor);
    if (this.timer) return;

    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.debounceMs);
    this.timer.unref?.();
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }

    const entries = [...this.pending.entries()];
    this.pending.clear();
    for (const [sessionID, cursor] of entries) {
      await this.storage.set(sessionID, cursor);
    }
  }

  async dispose(): Promise<void> {
    await this.flush();
  }

  private key(sessionID: string): string {
    return sessionFS.sanitizeSessionId(sessionID);
  }
}
