import { defineConfig } from "tsup";
import { solidPlugin } from "esbuild-plugin-solid";

export default defineConfig({
  entry: {
    "agent-monitor": "src/server/agent-monitor.ts",
    tui: "src/tui/agent-monitor-tui.tsx",
    cli: "src/cli/main.ts",
  },
  format: ["esm"],
  target: "node22",
  splitting: false,
  dts: true,
  clean: true,
  sourcemap: true,
  esbuildPlugins: [
    solidPlugin({
      solid: { generate: "universal", moduleName: "@opentui/solid" },
    }),
  ],
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
