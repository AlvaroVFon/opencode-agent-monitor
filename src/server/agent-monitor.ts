import type { Plugin } from "@opencode-ai/plugin";
import { UNKNOWN } from "./enums";
import { TraceHelper } from "./helpers/trace.helpers";
import { createEventHandler } from "./wire/handler-wiring";
import { createMetricsAggregator } from "./wire/aggregator-wiring";

export const AgentMonitor: Plugin = async (_input, options) => {
  const currentAgent = new Map<string, string>();
  const traceDir =
    typeof options?.traceDir === "string" ? options.traceDir : undefined;
  const traceHelper = new TraceHelper(traceDir);
  const eventHandler = createEventHandler(traceHelper, currentAgent);
  const metricsAggregator = createMetricsAggregator();

  return {
    "chat.params": async (input) => {
      currentAgent.set(input.sessionID, input.agent);
    },

    event: async ({ event }) => {
      const snapshot = new Map(currentAgent);
      const getAgent = (sessionID: string) =>
        snapshot.get(sessionID) ?? UNKNOWN;

      eventHandler.handle(event, getAgent);
      metricsAggregator.ingest(event, getAgent);
    },
  };
};
