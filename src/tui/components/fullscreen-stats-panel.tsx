import { createMemo } from "solid-js";
import type { JSX } from "@opentui/solid";
import { usePlugin } from "@opencode/plugin/tui";
import type { PanelInput } from "@opencode/plugin/tui/context";
import type { TuiMonitor } from "../monitor";
import { fullscreenTableFormatter } from "../formatters/fullscreen-table.formatter.js";

/**
 * Fullscreen statistics panel hosted by the native `session.panel` slot.
 * Keyboard input is scoped to the panel while it owns focus.
 */
export function FullscreenStatsPanel(props: {
  monitor: TuiMonitor;
  panel: PanelInput;
}): JSX.Element {
  const context = usePlugin();

  context.keymap.layer(() => ({
    commands: [
      {
        id: "agent-monitor.close",
        title: "Close agent monitor",
        bind: "escape",
        run: () => props.panel.close(),
      },
    ],
  }));

  const content = createMemo(() =>
    fullscreenTableFormatter.format(
      props.monitor.snapshotFor(props.panel.sessionID),
    ),
  );

  return (
    <box
      flexDirection="column"
      padding={1}
      width="100%"
      height="100%"
      border={true}
      borderColor={props.monitor.theme.accent}
    >
      <scrollbox flexGrow={1}>
        <text>{content()}</text>
      </scrollbox>
    </box>
  );
}
