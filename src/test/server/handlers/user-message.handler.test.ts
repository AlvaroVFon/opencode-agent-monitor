import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserMessageHandler } from "../../../server/handlers/trace/user-message.handler";

describe("UserMessageHandler", () => {
  it("updates currentAgent when message role is USER", () => {
    const currentAgent = new Map<string, string>();
    const handler = new UserMessageHandler(currentAgent);

    handler.handle({
      info: { role: "user", sessionID: "sess-1", agent: "planner" },
    });

    assert.equal(currentAgent.get("sess-1"), "planner");
  });

  it("ignores messages with non-USER role", () => {
    const currentAgent = new Map<string, string>();
    const handler = new UserMessageHandler(currentAgent);

    handler.handle({
      info: { role: "assistant", sessionID: "sess-1", agent: "planner" },
    });

    assert.equal(currentAgent.has("sess-1"), false);
  });
});
