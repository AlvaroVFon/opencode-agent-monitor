import type { Plugin } from "@opencode-ai/plugin";
import { TraceHelper } from "./helpers/trace.helpers";
import { createEventHandler } from "./wire/handler-wiring";
import { createMetricsAggregator } from "./wire/aggregator-wiring";

const currentAgent = new Map<string, string>();

export const AgentMonitor: Plugin = async (_input, options) => {
  const traceDir =
    typeof options?.traceDir === "string" ? options.traceDir : undefined;
  const traceHelper = new TraceHelper(traceDir);
  const eventHandler = createEventHandler(traceHelper, currentAgent);
  const metricsAggregator = createMetricsAggregator(currentAgent);

  return {
    "chat.params": async (input) => {
      currentAgent.set(input.sessionID, input.agent);
    },

    event: async ({ event }) => {
      eventHandler.handle(event);
      metricsAggregator.ingest(event);
    },
  };
};
