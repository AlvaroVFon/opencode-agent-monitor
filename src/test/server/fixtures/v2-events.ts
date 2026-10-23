type AnyRecord = Record<string, unknown>;

/**
 * Builders for the OpenCode V2 events consumed by the server plugin.
 *
 * Tests only exercise the fields the handlers read, so fixtures are structural
 * and intentionally loose instead of reproducing the full Effect schemas.
 */
export function makeEvent(
  type: string,
  data: AnyRecord,
  overrides: AnyRecord = {},
) {
  return {
    id: `evt-${type}`,
    created: 1_000,
    type,
    data,
    ...overrides,
  };
}

export function makeSessionCreated(
  data: AnyRecord = {},
  overrides: AnyRecord = {},
) {
  return makeEvent(
    "session.created",
    {
      sessionID: "sess-1",
      projectID: "proj-1",
      location: { directory: "/work" },
      agent: "coder",
      slug: "session",
      version: "2.0.0",
      ...data,
    },
    overrides,
  );
}

export function makeExecutionFailed(
  data: AnyRecord = {},
  overrides: AnyRecord = {},
) {
  return makeEvent(
    "session.execution.failed",
    {
      sessionID: "sess-1",
      error: { type: "provider.invalid-request", message: "bad request" },
      ...data,
    },
    overrides,
  );
}

export function makeAgentSelected(
  data: AnyRecord = {},
  overrides: AnyRecord = {},
) {
  return makeEvent(
    "session.agent.selected",
    { sessionID: "sess-1", agent: "coder", ...data },
    overrides,
  );
}

export function makeStepStarted(
  data: AnyRecord = {},
  overrides: AnyRecord = {},
) {
  return makeEvent(
    "session.step.started",
    {
      sessionID: "sess-1",
      assistantMessageID: "msg-1",
      agent: "coder",
      model: { providerID: "anthropic", id: "claude-sonnet-4-5" },
      started: 900,
      ...data,
    },
    overrides,
  );
}

export function makeStepEnded(data: AnyRecord = {}, overrides: AnyRecord = {}) {
  return makeEvent(
    "session.step.ended",
    {
      sessionID: "sess-1",
      assistantMessageID: "msg-1",
      finish: "stop",
      cost: 0.002,
      tokens: {
        input: 10,
        output: 20,
        reasoning: 3,
        cache: { read: 4, write: 5 },
      },
      ...data,
    },
    overrides,
  );
}

export function makeStepFailed(
  data: AnyRecord = {},
  overrides: AnyRecord = {},
) {
  return makeEvent(
    "session.step.failed",
    {
      sessionID: "sess-1",
      assistantMessageID: "msg-1",
      error: { type: "rate-limit", message: "too many requests" },
      ...data,
    },
    overrides,
  );
}

export function makeCompactionEnded(
  data: AnyRecord = {},
  overrides: AnyRecord = {},
) {
  return makeEvent(
    "session.compaction.ended",
    {
      sessionID: "sess-1",
      reason: "auto",
      model: { providerID: "anthropic", id: "claude-haiku-4-5" },
      text: "summary",
      cost: 0.001,
      tokens: {
        input: 100,
        output: 50,
        reasoning: 0,
        cache: { read: 10, write: 0 },
      },
      ...data,
    },
    overrides,
  );
}

export function makeCompactionFailed(
  data: AnyRecord = {},
  overrides: AnyRecord = {},
) {
  return makeEvent(
    "session.compaction.failed",
    {
      sessionID: "sess-1",
      reason: "auto",
      error: { type: "context-overflow", message: "too large" },
      ...data,
    },
    overrides,
  );
}

export function makeSkillActivated(
  data: AnyRecord = {},
  overrides: AnyRecord = {},
) {
  return makeEvent(
    "session.skill.activated",
    {
      sessionID: "sess-1",
      id: "review",
      name: "Review",
      text: "Review the changes",
      ...data,
    },
    overrides,
  );
}

export function makeToolEvent(
  status: "completed" | "error",
  overrides: AnyRecord = {},
) {
  const base = {
    tool: "bash",
    sessionID: "sess-1",
    agent: "coder",
    messageID: "msg-1",
    id: "call-1",
    input: { command: "ls" },
    ...overrides,
  };

  return status === "completed"
    ? { ...base, status, result: { content: "ok" } }
    : { ...base, status, error: { message: "command failed" } };
}
