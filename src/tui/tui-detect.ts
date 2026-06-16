import type { PluginOptions } from "@opencode-ai/plugin";
import type {
  TuiPlugin,
  TuiPluginMeta,
  TuiPluginModule,
} from "@opencode-ai/plugin/tui";

const id = "agent-monitor-tui";

const tui: TuiPlugin = async (api, options, _meta: TuiPluginMeta) => {
  const { tui: realTui } = await import("./agent-monitor-tui.tsx");
  return realTui(api, options, _meta);
};

export default { id, tui } satisfies TuiPluginModule;
