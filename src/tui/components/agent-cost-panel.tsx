import { createMemo, For } from "solid-js";
import type { JSX } from "@opentui/solid";
import type { RGBA } from "@opentui/core";
import type { MetricsSnapshot } from "../../metrics/metrics.aggregator.interface.js";
import { formatAgentRows } from "../formatters/format-agent-row.js";

export function AgentCostPanel(props: {
  snapshot: MetricsSnapshot;
  sessionId?: string;
  accentColor: RGBA;
}): JSX.Element {
  const rows = createMemo(() => formatAgentRows(props.snapshot.byAgent));

  return (
    <box flexDirection="column" padding={1}>
      {rows().length === 0 ? (
        <text>No data yet</text>
      ) : (
        <For each={rows()}>
          {(row) => {
            const parts = row.split("  ");
            const agent = parts[0] ?? "";
            const cost = parts[1] ?? "";
            const rest = parts.slice(2).join("  ");

            return (
              <text>
                <span>{agent}</span>
                <span>{"  "}</span>
                <span style={{ fg: props.accentColor }}>{cost}</span>
                <span>{"  "}</span>
                <span>{rest}</span>
              </text>
            );
          }}
        </For>
      )}
    </box>
  );
}
