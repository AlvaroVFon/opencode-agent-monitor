import { createMemo } from "solid-js";
import { useKeyboard, type JSX } from "@opentui/solid";
import type { TuiThemeCurrent } from "@opencode-ai/plugin/tui";
import type { MetricsSnapshot } from "../../shared/metrics.types.js";
import { formatFullscreenTable } from "../formatters/format-fullscreen-table.js";

export function FullscreenStatsDialog(props: {
  snapshot: MetricsSnapshot;
  onClose: () => void;
  theme: TuiThemeCurrent;
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
      borderColor={props.theme.accent}
    >
      <scrollbox flexGrow={1}>
        <text>{content()}</text>
      </scrollbox>
    </box>
  );
}
