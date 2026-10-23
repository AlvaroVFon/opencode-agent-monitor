import { basename, relative } from "node:path";

/**
 * Generated files are excluded from formatting by `.prettierignore`, which
 * `oxfmt` honours by default. `lint-staged` still hands them to the task, and
 * `oxfmt` exits non-zero when every target is ignored, so drop them here.
 */
const GENERATED = new Set(["CHANGELOG.md"]);

const toArgs = (files) =>
  files
    .filter((file) => !GENERATED.has(basename(file)))
    .map((file) => JSON.stringify(relative(process.cwd(), file)))
    .join(" ");

/** @type {import('lint-staged').Configuration} */
export default {
  "*.{ts,tsx,js,jsx,cjs,mjs}": (files) => {
    const args = toArgs(files);
    return [`oxfmt ${args}`, `oxlint ${args}`];
  },
  "*.{json,md}": (files) => {
    const args = toArgs(files);
    return args ? `oxfmt ${args}` : "true";
  },
};
