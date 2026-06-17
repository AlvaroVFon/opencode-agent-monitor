---
name: create-commit
description: Create a commit that conforms to this repo's conventional-commits, commitlint, and husky setup
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: git
---

## What I do

Create a single, well-formed commit that passes the repo's `commit-msg` and `pre-commit` hooks on the first try. Avoid the common mistakes that cause hooks to reject the message or `pnpm format` to rewrite files right after `git add`.

## When to use me

Activate whenever the user asks to commit, save, or "land" staged or unstaged changes. Do **not** use for amend, force-push, or interactive rebases unless the user explicitly asks.

## Pre-flight

Before staging or committing, inspect the working tree:

1. `git status` — what is modified, untracked, or staged.
2. `git diff` — review the actual changes (use `--staged` if needed).
3. `git log --oneline -10` — match the project's recent commit style.

Stage only the files the user intended. Never commit secrets, build artifacts, `.env*`, or `dist/`.

## Commit message format

The repo uses `@commitlint/config-conventional` (see `commitlint.config.cjs`). The rules are strict and enforced by the `commit-msg` hook.

### Allowed types

`feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `style`, `revert`. Use `feat` for user-visible features, `fix` for bug fixes, `refactor` for non-user-visible code changes.

### Subject line

- **Lower-case** — `subject-case: [2, "always", "lower-case"]`. Title-case or all-caps will be rejected.
- **Max 100 characters** including the type and colon — `header-max-length: [2, "always", 100]`.
- Format: `<type>(<optional-scope>): <subject>` where scope is optional but encouraged for `feat/fix/refactor`. Example: `feat(aggregator): add byTool map to MetricsSnapshot`.
- No trailing period. Imperative mood ("add", not "added" or "adds").

### Body and footer

- Body lines have no enforced max length (`body-max-line-length: [0]`).
- Footer lines have no enforced max length.
- Use `BREAKING CHANGE:` footer for breaking changes (semantic-release bumps major).

## What the hooks do automatically

Once you commit, you do **not** need to run formatters manually:

- `.husky/pre-commit` runs `lint-staged` (prettier on staged files) then `prettier --write .` on the whole tree. Files may be modified by this step.
- `.husky/commit-msg` runs `commitlint --edit` on the message.

If hooks rewrite your files, the commit still goes through. Do **not** use `--no-verify` to skip hooks. If a hook legitimately fails, fix the issue and create a new commit — do not amend the failed one.

## Forbidden

- `--no-verify`, `--no-hooks`, or any flag that bypasses hooks (unless the user explicitly asks).
- `--amend` on a commit that has already been pushed or shared. Use only for local-only commits when the user asks.
- `--force` / `-f` pushes.
- Empty commits.
- Squashing unrelated work into a single commit without the user's request.

## Examples

Good:

- `feat(aggregator): add byTool dimension to MetricsSnapshot`
- `fix(trace): handle missing sessionID in session_error events`
- `chore(deps): bump @opencode-ai/plugin to 1.14.51`
- `docs(readme): clarify tui.json setup steps`

Bad (will fail commitlint):

- `feat: Add new feature` → subject-case violation.
- `feat(aggregator): add byTool dimension to MetricsSnapshot and also fix the unrelated thing in metrics.mts` → too long, mixes concerns.
- `Feat(aggregator): new field` → type-case violation (only `feat` is allowed, not `Feat`).
