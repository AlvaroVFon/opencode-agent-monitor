import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { EventHandler } from "../../../server/events/events.handler";
import { EventsRegistry } from "../../../server/events/events.registry";
import { EventType } from "../../../server/enums";
import { makeSessionCreated } from "../fixtures/v2-events";

describe("EventHandler (V2)", () => {
  it("dispatches the event to every handler registered for its type", () => {
    const registry = new EventsRegistry();
    const h1 = { handle: mock.fn() };
    const h2 = { handle: mock.fn() };

    registry.register(EventType.SESSION_CREATED, h1);
    registry.register(EventType.SESSION_CREATED, h2);

    const eventHandler = new EventHandler(registry);
    const event = makeSessionCreated();

    eventHandler.handle(event as any);

    assert.equal(h1.handle.mock.calls.length, 1);
    assert.equal(h2.handle.mock.calls.length, 1);
    assert.deepEqual(h1.handle.mock.calls[0].arguments, [event]);
  });

  it("silently ignores unregistered event types", () => {
    const eventHandler = new EventHandler(new EventsRegistry());

    assert.doesNotThrow(() =>
      eventHandler.handle({ type: "unknown.event", data: {} } as any),
    );
  });
});
