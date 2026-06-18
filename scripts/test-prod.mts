import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const rootURL = `file://${root}`;
const globalConfigDir = join(homedir(), ".config", "opencode");

interface Config {
  path: string;
  devPath: string;
  prodPath: string;
}

const configs: Config[] = [
  {
    path: resolve(globalConfigDir, "opencode.json"),
    devPath: "@alvarovfon/opencode-agent-monitor",
    prodPath: `${rootURL}/dist/agent-monitor.js`,
  },
  {
    path: resolve(globalConfigDir, "tui.json"),
    devPath: "@alvarovfon/opencode-agent-monitor",
    prodPath: `${rootURL}/dist/tui.js`,
  },
];

const shouldRestore =
  process.argv.includes("--restore") || process.argv.includes("-r");

if (shouldRestore) {
  let allRestored = true;
  for (const config of configs) {
    const backupPath = config.path + ".dev";
    if (!existsSync(backupPath)) {
      console.log(`No backup found at ${backupPath}, skipping`);
      continue;
    }
    const content = readFileSync(backupPath, "utf-8");
    writeFileSync(config.path, content, "utf-8");
    unlinkSync(backupPath);
    console.log(`Restored ${basename(config.path)} to dev config`);
  }
  if (allRestored) {
    console.log("\nDev configs restored. Run `opencode` to verify.");
  }
  process.exit(0);
}

console.log("Building production bundle...");
execSync("pnpm build", { stdio: "inherit", cwd: root });

console.log("\nBacking up global configs...");
for (const config of configs) {
  const backupPath = config.path + ".dev";
  if (existsSync(backupPath)) {
    console.log(`  Backup already exists at ${backupPath}, skipping`);
    continue;
  }
  const content = readFileSync(config.path, "utf-8");
  writeFileSync(backupPath, content, "utf-8");
  console.log(`  Backed up ${basename(config.path)}`);
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
console.log("Run `opencode` to verify the plugin loads correctly.");
console.log(
  "After testing, run `pnpm test:prod --restore` to restore dev configs.\n",
);
