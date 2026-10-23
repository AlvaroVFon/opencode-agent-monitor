import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const rootURL = `file://${root}`;
const globalConfigDir = join(homedir(), ".config", "opencode");
const prodDir = join(globalConfigDir, ".agent-monitor-prod");

/**
 * OpenCode V2 requires configured local plugins to be **directories**, so this
 * script generates one wrapper directory per entrypoint and points the configs
 * at them:
 *
 * - `opencode.json` (`plugins`) loads the server plugin.
 * - `cli.json` (`plugins`) loads the TUI plugin.
 */
interface Config {
  path: string;
  devPath: string;
  prodPath: string;
}

const configs: Config[] = [
  {
    path: resolve(globalConfigDir, "opencode.json"),
    devPath: "@alvarovfon/opencode-agent-monitor",
    prodPath: join(prodDir, "server"),
  },
  {
    path: resolve(globalConfigDir, "cli.json"),
    devPath: "@alvarovfon/opencode-agent-monitor",
    prodPath: join(prodDir, "tui"),
  },
];

function writeWrapper(directory: string, entry: string): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "index.js"),
    `export { default } from ${JSON.stringify(`${rootURL}/${entry}`)};\n`,
    "utf-8",
  );
}

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
  rmSync(prodDir, { recursive: true, force: true });
  if (allRestored) {
    console.log("\nDev configs restored. Run `opencode` to verify.");
  }
  process.exit(0);
}

console.log("Building production bundle...");
execSync("pnpm build", { stdio: "inherit", cwd: root });

console.log("\nCreating plugin wrapper directories...");
writeWrapper(join(prodDir, "server"), "dist/agent-monitor.js");
console.log(`  ${join(prodDir, "server")}`);
writeWrapper(join(prodDir, "tui"), "dist/tui.js");
console.log(`  ${join(prodDir, "tui")}`);

console.log("\nBacking up global configs...");
for (const config of configs) {
  if (!existsSync(config.path)) {
    console.log(`  ${basename(config.path)} does not exist, will create it`);
    continue;
  }
  const backupPath = config.path + ".dev";
  if (existsSync(backupPath)) {
    console.log(`  Backup already exists at ${backupPath}, skipping`);
    continue;
  }
  const content = readFileSync(config.path, "utf-8");
  writeFileSync(backupPath, content, "utf-8");
  console.log(`  Backed up ${basename(config.path)}`);
}

console.log("\nSwitching to production build paths...");
for (const config of configs) {
  if (!existsSync(config.path)) {
    writeFileSync(
      config.path,
      JSON.stringify({ plugins: [config.prodPath] }, null, 2) + "\n",
      "utf-8",
    );
    console.log(`  ${basename(config.path)}: created with ${config.prodPath}`);
    continue;
  }

  const content = readFileSync(config.path, "utf-8");
  if (!content.includes(config.devPath)) {
    console.log(
      `  ${basename(config.path)}: ${config.devPath} not found, leaving untouched`,
    );
    continue;
  }
  const updated = content.replace(config.devPath, config.prodPath);
  writeFileSync(config.path, updated, "utf-8");
  console.log(
    `  ${basename(config.path)}: ${config.devPath} -> ${config.prodPath}`,
  );
}

console.log("\n=== Production build ready for testing ===");
console.log("Run `opencode` to verify the plugin loads correctly.");
console.log("Run `pnpm test:prod --restore` to restore the dev configs.");
