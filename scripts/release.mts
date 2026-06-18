import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const PACKAGE_JSON = resolve(ROOT, "package.json");

function exec(cmd: string): string {
  return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
}

function bump(level: string, current: string): string {
  const [major, minor, patch] = current.split(".").map(Number);
  if (level === "major") return `${major + 1}.0.0`;
  if (level === "minor") return `${major}.${minor + 1}.0`;
  if (level === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump level: ${level}`);
}

function main(): void {
  const level = exec("npx conventional-recommended-bump --preset angular");
  console.log(`bump level: ${level}`);

  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8"));
  const currentVersion = pkg.version;
  const newVersion = bump(level, currentVersion);
  console.log(`${currentVersion} → ${newVersion}`);

  pkg.version = newVersion;
  writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + "\n");

  exec("npx conventional-changelog --preset angular -i CHANGELOG.md -s");
  exec(`git add package.json CHANGELOG.md`);
  exec(`git commit -m "chore(release): v${newVersion}"`);
  exec(`git tag "v${newVersion}"`);

  console.log(`\nRelease v${newVersion} ready.`);
  console.log(`Run: git push origin $(git branch --show-current) --tags`);
}

main();
