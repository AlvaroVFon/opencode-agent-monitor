import { createMemo } from "solid-js";
import { useKeyboard, type JSX } from "@opentui/solid";
import type { RGBA } from "@opentui/core";
import type { MetricsSnapshot } from "../../metrics/metrics.aggregator.interface.js";
import { formatFullscreenTable } from "../formatters/format-fullscreen-table.js";

export function FullscreenStatsDialog(props: {
  snapshot: MetricsSnapshot;
  onClose: () => void;
  accentColor: RGBA;
}): JSX.Element {
  const content = createMemo(() => formatFullscreenTable(props.snapshot));

  useKeyboard((event) => {
    if (event.name === "escape") {
      props.onClose();
    }
  });

  return (
    <box
      flexDirection="column"
      padding={1}
      width="100%"
      height="100%"
      border={true}
      borderColor={props.accentColor}
    >
      <scrollbox flexGrow={1}>
        <text>{content()}</text>
      </scrollbox>
    </box>
  );
}
