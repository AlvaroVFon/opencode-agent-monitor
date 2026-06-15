import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { EventHandler } from "../../events/events.handler";
import { EventsRegistry } from "../../events/events.registry";
import { EventType } from "../../enums";
import type { Handler } from "../../handler.interface";

describe("EventHandler", () => {
  it("dispatches event properties to every registered handler", () => {
    const registry = new EventsRegistry();
    const h1 = { handle: mock.fn<Handler["handle"]>() };
    const h2 = { handle: mock.fn<Handler["handle"]>() };

    registry.register(EventType.SESSION_CREATED, h1);
    registry.register(EventType.SESSION_CREATED, h2);

    const eventHandler = new EventHandler(
      { writeTrace: mock.fn(), writeTraceError: mock.fn(), ensureDir: () => {} } as any,
      registry,
    );

    eventHandler.handle({
      type: EventType.SESSION_CREATED,
      properties: { foo: "bar" },
    });

    assert.equal(h1.handle.mock.calls.length, 1);
    assert.equal(h2.handle.mock.calls.length, 1);
    assert.deepEqual(h1.handle.mock.calls[0].arguments, [{ foo: "bar" }]);
  });

  it("silently ignores unregistered event types", () => {
    const registry = new EventsRegistry();
    const eventHandler = new EventHandler(
      { writeTrace: mock.fn(), writeTraceError: mock.fn(), ensureDir: () => {} } as any,
      registry,
    );

    eventHandler.handle({ type: "unknown.event", properties: {} });
  });
});
