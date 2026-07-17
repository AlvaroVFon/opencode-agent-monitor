import { relative } from "node:path";

const toArgs = (files) =>
  files.map((file) => JSON.stringify(relative(process.cwd(), file))).join(" ");

/** @type {import('lint-staged').Configuration} */
export default {
  "*.{ts,tsx,js,jsx,cjs,mjs}": (files) => {
    const args = toArgs(files);
    return [`oxfmt ${args}`, `oxlint ${args}`];
  },
  "*.{json,md}": (files) => `oxfmt ${toArgs(files)}`,
};
