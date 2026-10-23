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
const globalConfigDir = process.env.XDG_CONFIG_HOME
  ? join(process.env.XDG_CONFIG_HOME, "opencode")
  : join(homedir(), ".config", "opencode");
const prodDir = join(globalConfigDir, ".agent-monitor-prod");
const pluginDir = join(prodDir, "agent-monitor");

const configPath = resolve(globalConfigDir, "opencode.json");
const backupPath = `${configPath}.dev`;
const legacyCliConfig = resolve(globalConfigDir, "cli.json");
const legacyTuiEntry = join(root, "dist", "tui.js");

const devEntry = "@alvarovfon/opencode-agent-monitor";

/**
 * OpenCode V2 resolves a plugin as a *package*: one directory that exposes both
 * the server entrypoint (`exports["."]`) and the TUI entrypoint (`exports["./tui"]`).
 * The CLI reads the active plugin list from the server and loads the matching
 * `./tui` export by itself, so only `opencode.json` needs to be rewritten.
 *
 * A bare file path in `cli.json` is silently ignored by the V2 CLI, and a
 * wrapper directory that only exposes the server entry gives the CLI nothing
 * to render, so this script always generates the full package layout.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function writePluginDir(directory: string): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify(
      {
        name: "opencode-agent-monitor-local",
        private: true,
        type: "module",
        exports: { ".": "./index.js", "./tui": "./tui.js" },
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  writeFileSync(
    join(directory, "index.js"),
    `export { default } from ${JSON.stringify(`${rootURL}/dist/agent-monitor.js`)};\n`,
    "utf-8",
  );
  writeFileSync(
    join(directory, "tui.js"),
    `export { default } from ${JSON.stringify(`${rootURL}/dist/tui.js`)};\n`,
    "utf-8",
  );
}

const shouldRestore =
  process.argv.includes("--restore") || process.argv.includes("-r");

if (shouldRestore) {
  if (!existsSync(backupPath)) {
    console.log(`No backup found at ${backupPath}, skipping`);
  } else {
    const content = readFileSync(backupPath, "utf-8");
    if (content.includes(prodDir)) {
      console.warn(
        `Warning: ${basename(backupPath)} already pointed at ${prodDir}.`,
      );
      console.warn(
        `Restoring it would break plugin loading; writing ${devEntry} instead.`,
      );
      writeFileSync(
        configPath,
        JSON.stringify({ plugins: [devEntry] }, null, 2) + "\n",
        "utf-8",
      );
    } else {
      writeFileSync(configPath, content, "utf-8");
    }
    unlinkSync(backupPath);
    console.log(`Restored ${basename(configPath)} to dev config`);
  }
  rmSync(prodDir, { recursive: true, force: true });
  console.log("\nDev config restored. Run `opencode` to verify.");
  process.exit(0);
}

console.log("Building production bundle...");
execSync("pnpm build", { stdio: "inherit", cwd: root });

console.log("\nCreating local plugin package...");
writePluginDir(pluginDir);
console.log(`  ${pluginDir}`);
console.log(`    index.js -> ${join(root, "dist", "agent-monitor.js")}`);
console.log(`    tui.js   -> ${join(root, "dist", "tui.js")}`);

console.log("\nBacking up global config...");
if (existsSync(backupPath)) {
  console.log(`  Backup already exists at ${backupPath}, skipping`);
} else if (!existsSync(configPath)) {
  console.log(`  ${basename(configPath)} does not exist, will create it`);
} else {
  writeFileSync(backupPath, readFileSync(configPath, "utf-8"), "utf-8");
  console.log(`  Backed up ${basename(configPath)}`);
}

console.log("\nSwitching to production build...");
if (!existsSync(configPath)) {
  writeFileSync(
    configPath,
    JSON.stringify({ plugins: [pluginDir] }, null, 2) + "\n",
    "utf-8",
  );
  console.log(`  ${basename(configPath)}: created with ${pluginDir}`);
} else {
  let content = readFileSync(configPath, "utf-8");
  const original = content;

  // Older runs of this script generated per-surface wrappers
  // (`.agent-monitor-prod/server` and `.agent-monitor-prod/tui`); migrate those
  // paths to the single package layout.
  content = content.replace(
    new RegExp(`${escapeRegExp(prodDir)}(?:/[a-z]+)?`, "g"),
    pluginDir,
  );
  content = content.replace(devEntry, pluginDir);

  if (content === original) {
    console.log(
      `  ${basename(configPath)}: neither ${devEntry} nor an old wrapper found, leaving untouched`,
    );
  } else {
    writeFileSync(configPath, content, "utf-8");
    console.log(`  ${basename(configPath)}: -> ${pluginDir}`);
  }
}

if (existsSync(legacyCliConfig)) {
  const legacy = readFileSync(legacyCliConfig, "utf-8");
  if (legacy.includes(legacyTuiEntry)) {
    console.warn(`\nWarning: ${legacyCliConfig} points at ${legacyTuiEntry}.`);
    console.warn(
      "V2 ignores bare file paths in cli.json; remove that entry to avoid confusion.",
    );
  }
}

console.log("\n=== Production build ready for testing ===");
console.log("Run `opencode` to verify the plugin loads correctly.");
console.log("Run `pnpm test:prod --restore` to restore the dev config.");
