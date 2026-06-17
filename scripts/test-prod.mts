import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const rootURL = `file://${root}`;

interface Config {
  path: string;
  devPath: string;
  prodPath: string;
}

const configs: Config[] = [
  {
    path: resolve(root, ".opencode", "opencode.json"),
    devPath: "../src/server/agent-monitor.ts",
    prodPath: `${rootURL}/dist/agent-monitor.js`,
  },
  {
    path: resolve(root, ".opencode", "tui.json"),
    devPath: "../src/tui/agent-monitor-tui.tsx",
    prodPath: `${rootURL}/dist/tui.js`,
  },
];

const shouldRestore =
  process.argv.includes("--restore") || process.argv.includes("-r");

if (shouldRestore) {
  for (const config of configs) {
    const backupPath = config.path + ".dev";
    if (!existsSync(backupPath)) {
      console.error(`No backup found at ${backupPath}`);
      process.exit(1);
    }
    const content = readFileSync(backupPath, "utf-8");
    writeFileSync(config.path, content, "utf-8");
    unlinkSync(backupPath);
    console.log(`Restored ${basename(config.path)} to dev config`);
  }
  console.log("\nDev configs restored. Run `opencode` to verify dev setup.");
  process.exit(0);
}

console.log("Building production bundle...");
execSync("pnpm build", { stdio: "inherit", cwd: root });

console.log("\nBacking up dev configs...");
for (const config of configs) {
  const content = readFileSync(config.path, "utf-8");
  writeFileSync(config.path + ".dev", content, "utf-8");
}

console.log("Switching to production build paths...");
for (const config of configs) {
  const content = readFileSync(config.path, "utf-8");
  const updated = content.replace(config.devPath, config.prodPath);
  writeFileSync(config.path, updated, "utf-8");
  console.log(
    `  ${basename(config.path)}: ${config.devPath} -> ${config.prodPath}`,
  );
}

console.log("\n=== Production build ready for testing ===");
console.log(
  "Run `opencode` in this project to verify the plugin loads correctly.",
);
console.log(
  "After testing, run `pnpm test:prod --restore` to restore dev configs.\n",
);
