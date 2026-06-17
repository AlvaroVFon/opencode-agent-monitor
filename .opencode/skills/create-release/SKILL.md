---
name: create-release
description: Cut a release by opening a PR from develop to main; never push directly to main
license: MIT
compatibility: opencode
metadata:
  audience: maintainers
  workflow: github
---

## What I do

Coordinate a release by opening a pull request from `develop` into `main`. The release is **never** created by pushing directly to `main` — the PR is the unit of release, and merging it triggers semantic-release + npm publish.

## When to use me

Activate whenever the user asks to "cut a release", "ship a version", "publish", or "release what's on develop". Do **not** use this for routine PRs into `develop` — use `create-pr` for that.

## The cardinal rule

**`main` is release-only and is only ever written to by merging a release PR.** This is the only path semantic-release supports in this repo. Forbidden on `main`:

- `git push` from the agent (direct push, force push, or any form).
- Force-push, history rewrite, or any operation that overwrites release commits.
- Local commits to a `main` checkout.

If a release is needed, open a PR. The release workflow in `.github/workflows/release.yml` is the only thing that should run on `main`.

## Why a PR, not a direct push

1. **Auditability** — every release is a merge commit with a clear diff and reviews.
2. **CI parity** — the release workflow re-runs `lint` and `test` on the release branch before `semantic-release` does its work, even though `prepublishOnly` would catch it again locally.
3. **Recovery** — a bad release can be reverted with a single revert PR; a bad push cannot.

## Pre-flight

1. `git fetch origin` — make sure `develop` and `main` are current.
2. `git log --oneline origin/main..origin/develop` — see what will land in this release. If there are no commits, there's nothing to release. Stop and ask the user.
3. `git rev-parse --abbrev-ref HEAD` — confirm you're on a release-prep branch (e.g. `release/v1.2.0`), **not** on `develop` or `main`.
4. If a release prep branch does not exist, create one off `develop`: `git switch -c release/$(date +%Y-%m-%d) origin/develop`.

## Local validation

Run the same gates `prepublishOnly` will run during publish. **All four must pass before opening the release PR.**

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm run lint
pnpm run format:check
pnpm test
```

If any step fails, fix it on the release prep branch, push, then re-run all four. Do not bypass with `--no-verify` or by editing `prepublishOnly`.

## Opening the release PR

```bash
gh pr create \
  --base main \
  --head release/<branch-name> \
  --title "chore(release): cut vX.Y.Z" \
  --body "<see below>"
```

### PR body template

```
## Release vX.Y.Z

Merging this PR will trigger semantic-release, which will:

1. Tag the merge commit as `vX.Y.Z`.
2. Publish `@alvarovfon/opencode-agent-monitor@X.Y.Z` to npm.
3. Create a GitHub Release with auto-generated notes.
4. Update `CHANGELOG.md` via the next release-please run on `main`.

### Included in this release

- <bullet list of features, copied from `git log origin/main..origin/develop --oneline`>
- <link to the corresponding ROADMAP.md phase if applicable>

### Pre-merge checklist

- [ ] `pnpm run build` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run format:check` passes
- [ ] `pnpm test` passes
- [ ] `ROADMAP.md` is updated and the phase is checked off
- [ ] No `feat:`/`fix:` commits are missing from the release notes draft
```

## Monitoring the release

```bash
gh pr checks --watch
```

When CI is green and the user approves, **the user merges the PR**. The agent must not merge it — merging `main` is a maintainer action.

After the merge, the release workflow will:

1. Re-run `lint` and `test`.
2. Run `pnpm dlx semantic-release`, which analyzes commit messages, bumps the version in `package.json`, regenerates `CHANGELOG.md`, tags the commit, publishes to npm via `NODE_AUTH_TOKEN`, and creates the GitHub Release.

To confirm the publish:

```bash
gh release view vX.Y.Z
npm view @alvarovfon/opencode-agent-monitor version
```

Both should report `X.Y.Z`.

## Forbidden

- Direct push to `main`. No exceptions.
- Force-push to any branch involved in a release.
- Amending the release PR after it has been reviewed.
- Editing `package.json` version manually — semantic-release owns the version field.
- Editing `CHANGELOG.md` manually — semantic-release regenerates it.
- Running `npm publish` locally. Publication is CI-only via the release workflow.
- Skipping `prepublishOnly` or any of its four steps.
- Bumping a version before the release PR is merged.

## If something goes wrong

- **CI fails on the release PR**: push fixes to the release prep branch, re-run the four local checks, push again.
- **semantic-release fails after merge**: the workflow has failed; do not attempt to fix forward by force-pushing. Revert the merge commit with a new PR (`Revert "chore(release): cut vX.Y.Z"`) and investigate the failure on the reverted `main`.
- **Wrong version published**: yank with `npm unpublish` is restricted; prefer `npm deprecate` and a follow-up patch release. Do not push a fix to `main` directly.
