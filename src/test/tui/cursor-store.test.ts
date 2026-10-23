import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CursorPersistence, TuiStorageCursors } from "../../tui/cursor-store";

type CursorState = { cursors: Record<string, number> };

function makeStorage() {
  const state: CursorState = { cursors: {} };
  const storeCalls: string[] = [];

  return {
    state,
    storeCalls,
    storage: {
      store: (key: string, _options: { initial: CursorState }) => {
        storeCalls.push(key);
        return [
          state as any,
          async (mutation: (draft: CursorState) => void) => {
            mutation(state);
          },
        ] as const;
      },
    },
  };
}

describe("TuiStorageCursors", () => {
  it("creates the plugin store with the expected key and initial value", () => {
    const { storage, storeCalls } = makeStorage();

    new TuiStorageCursors(storage);

    assert.deepEqual(storeCalls, ["agent-monitor"]);
  });

  it("returns 0 for unknown sessions", () => {
    const { storage } = makeStorage();
    const cursors = new TuiStorageCursors(storage);

    assert.equal(cursors.get("missing"), 0);
  });

  it("persists and reads a cursor", async () => {
    const { storage, state } = makeStorage();
    const cursors = new TuiStorageCursors(storage);

    await cursors.set("sess-1", 128);

    assert.equal(cursors.get("sess-1"), 128);
    assert.equal(state.cursors["sess-1"], 128);
  });
});

describe("CursorPersistence", () => {
  function makePersistence(debounceMs = 0) {
    const { storage, state } = makeStorage();
    const cursors = new TuiStorageCursors(storage);
    return {
      state,
      cursors,
      persistence: new CursorPersistence(cursors, debounceMs),
    };
  }

  it("sanitizes session ids before reading and writing", async () => {
    const { state, persistence } = makePersistence();

    persistence.schedule("sess/with spaces", 42);
    await persistence.flush();

    assert.equal(state.cursors["sess_with_spaces"], 42);
    assert.equal(persistence.cursorFor("sess/with spaces"), 42);
  });

  it("flush writes every pending cursor immediately", async () => {
    const { state, persistence } = makePersistence(10_000);

    persistence.schedule("sess-1", 10);
    persistence.schedule("sess-2", 20);
    await persistence.flush();

    assert.equal(state.cursors["sess-1"], 10);
    assert.equal(state.cursors["sess-2"], 20);
  });

  it("keeps only the latest cursor per session", async () => {
    const { state, persistence } = makePersistence(10_000);

    persistence.schedule("sess-1", 10);
    persistence.schedule("sess-1", 99);
    await persistence.flush();

    assert.equal(state.cursors["sess-1"], 99);
  });

  it("debounces writes until the timer fires", async () => {
    const { state, persistence } = makePersistence(5);

    persistence.schedule("sess-1", 7);
    assert.equal(state.cursors["sess-1"], undefined);

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(state.cursors["sess-1"], 7);
  });

  it("dispose flushes pending writes", async () => {
    const { state, persistence } = makePersistence(10_000);

    persistence.schedule("sess-1", 5);
    await persistence.dispose();

    assert.equal(state.cursors["sess-1"], 5);
  });
});
