import { defineConfig } from "tsup";
import { solidPlugin } from "esbuild-plugin-solid";

export default defineConfig({
  entry: {
    "agent-monitor": "src/server/agent-monitor.ts",
    tui: "src/tui/agent-monitor-tui.tsx",
    cli: "src/cli/main.ts",
  },
  format: ["esm"],
  target: "node24",
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
    "@opencode/plugin",
    "@opencode/plugin/*",
    "@opencode/client",
    "@opencode/theme",
    "@opencode/theme/*",
    "@opentui/core",
    "@opentui/solid",
    "solid-js",
  ],
});
