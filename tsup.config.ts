import { defineConfig } from "tsup";
import { solidPlugin } from "esbuild-plugin-solid";

export default defineConfig({
  entry: {
    "agent-monitor": "src/server/agent-monitor.ts",
    "tui-detect": "src/tui/tui-detect.ts",
    "agent-monitor-tui": "src/tui/agent-monitor-tui.tsx",
  },
  format: ["cjs"],
  target: "node20",
  splitting: false,
  dts: true,
  clean: true,
  sourcemap: true,
  esbuildPlugins: [solidPlugin()],
  external: [
    "@opencode-ai/plugin",
    "@opencode-ai/plugin/tui",
    "@opencode-ai/sdk",
    "@opentui/core",
    "@opentui/keymap",
    "@opentui/solid",
    "solid-js",
  ],
});
