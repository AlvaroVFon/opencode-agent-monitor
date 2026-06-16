import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventsRegistry } from "../../../server/events/events.registry";
import { EventType } from "../../../server/enums";
import type { Handler } from "../../../server/handler.interface";

function dummy(): Handler {
  return { handle: () => {} };
}

describe("EventsRegistry", () => {
  it("stores a handler under the given event type", () => {
    const registry = new EventsRegistry();
    const h = dummy();
    registry.register(EventType.SESSION_CREATED, h);
    assert.deepEqual(registry.get(EventType.SESSION_CREATED), [h]);
  });

  it("supports multiple handlers for the same event type", () => {
    const registry = new EventsRegistry();
    const h1 = dummy();
    const h2 = dummy();
    registry.register(EventType.MESSAGE_UPDATED, h1);
    registry.register(EventType.MESSAGE_UPDATED, h2);
    assert.deepEqual(registry.get(EventType.MESSAGE_UPDATED), [h1, h2]);
  });

  it("supports multiple event types independently", () => {
    const registry = new EventsRegistry();
    const h1 = dummy();
    const h2 = dummy();
    registry.register(EventType.SESSION_CREATED, h1);
    registry.register(EventType.SESSION_ERROR, h2);
    assert.deepEqual(registry.get(EventType.SESSION_CREATED), [h1]);
    assert.deepEqual(registry.get(EventType.SESSION_ERROR), [h2]);
  });

  it("returns undefined for an unregistered event type", () => {
    assert.equal(new EventsRegistry().get("nonexistent"), undefined);
  });

  it("supports fluent chaining", () => {
    const registry = new EventsRegistry();
    const result = registry
      .register(EventType.SESSION_CREATED, dummy())
      .register(EventType.SESSION_ERROR, dummy());
    assert(result instanceof EventsRegistry);
    assert.equal(registry.get(EventType.SESSION_CREATED)!.length, 1);
    assert.equal(registry.get(EventType.SESSION_ERROR)!.length, 1);
  });
});
