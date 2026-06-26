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

Coordinate a release by opening a pull request from a `release/vX.Y.Z` branch into `main`. The release is **never** created by pushing directly to `main` — the PR is the unit of release, and merging it triggers the release workflow which publishes to npm and creates a GitHub Release.

## When to use me

Activate whenever the user asks to "cut a release", "ship a version", "publish", or "release what's on develop". Do **not** use this for routine PRs into `develop` — use `create-pr` for that.

## The cardinal rule

**`main` is release-only and is only ever written to by merging a release PR.** Forbidden on `main`:

- `git push` from the agent (direct push, force push, or any form).
- Force-push, history rewrite, or any operation that overwrites release commits.
- Local commits to a `main` checkout.

If a release is needed, open a PR. The release workflow in `.github/workflows/release.yml` is the only thing that should run on `main`.

## Why a PR, not a direct push

1. **Auditability** — every release is a merge commit with a clear diff and reviews.
2. **CI parity** — `prepublishOnly` runs build → lint → format:check → test locally, and again in CI before publish.
3. **Recovery** — a bad release can be reverted with a single revert PR; a bad push cannot.

## Release process overview

1. Create a release branch from `develop`.
2. Run `pnpm prepare-release` — bumps version, generates CHANGELOG, commits, and tags.
3. Push branch + tags.
4. Open a PR from `release/vX.Y.Z` to `main`.
5. Merge the PR → CI publishes to npm and creates a GitHub Release.

## Pre-flight

1. `git fetch origin` — make sure `develop` and `main` are current.
2. `git log --oneline origin/main..origin/develop` — see what will land in this release. If there are no commits, there's nothing to release. Stop and ask the user.
3. `git rev-parse --abbrev-ref HEAD` — confirm you're on a release branch (e.g. `release/v0.2.0`), **not** on `develop` or `main`.
4. If a release branch does not exist, create one off `develop`:
   ```
   git switch -c release/vX.Y.Z origin/develop
   ```
   Determine `X.Y.Z` by checking the current version in `package.json` and the commits since the last release — ask the user if unsure.

## Prepare the release

Run the `prepare-release` script which automates version bumping, changelog generation, and tagging:

```bash
pnpm prepare-release
```

This script:

1. Detects the bump level (`major`/`minor`/`patch`) via `conventional-recommended-bump`.
2. Bumps the version in `package.json`.
3. Generates/updates `CHANGELOG.md` via `conventional-changelog`.
4. Commits as `chore(release): vX.Y.Z`.
5. Creates an annotated tag `vX.Y.Z`.

Verify the result:

```bash
node -p "require('./package.json').version"
git log --oneline -3
git tag --list 'v*' | tail -1
```

## Push

Push the branch and tags:

```bash
git push origin release/vX.Y.Z --tags
```

## Resolve conflicts with main

After pushing, merge `main` into the release branch to catch any conflicts early (they occur when both `main` and the release branch modify `package.json` and `CHANGELOG.md`):

```bash
git merge origin/main
```

If there are conflicts, they will be in `package.json` and `CHANGELOG.md`. Resolve them by keeping the release branch version:

- **`package.json`**: keep `"version": "X.Y.Z"` from the release branch (HEAD).
- **`CHANGELOG.md`**: keep the regenerated changelog from `prepare-release` (HEAD). Remove all conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).

Then stage and commit:

```bash
git add package.json CHANGELOG.md
git commit -m "chore(release): resolve merge conflicts with main"
git push origin release/vX.Y.Z
```

## Local validation

Run the same gates `prepublishOnly` will run during publish. **All four must pass before opening the release PR.**

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm run lint
pnpm run format:check
pnpm test
```

If any step fails, fix it on the release branch, amend the release commit (only if local-only), and re-run all four. Do not bypass with `--no-verify` or by editing `prepublishOnly`.

## Opening the release PR

```bash
gh pr create \
  --base main \
  --head release/vX.Y.Z \
  --title "chore(release): vX.Y.Z" \
  --body "<see below>"
```

### PR body template

```
## Release vX.Y.Z

Merging this PR will trigger the release workflow, which will:

1. Run `pnpm publish` (via `prepublishOnly`: build → lint → format:check → test).
2. Publish `@alvarovfon/opencode-agent-monitor@X.Y.Z` to npm.
3. Create a GitHub Release with auto-generated notes.

### Included in this release

- <bullet list of features, copied from `git log origin/main..origin/develop --oneline`>
- <link to the corresponding ROADMAP.md phase if applicable>

### Pre-merge checklist

- [ ] `pnpm run build` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run format:check` passes
- [ ] `pnpm test` passes
- [ ] `ROADMAP.md` is updated and the phase is checked off
```

## Monitoring the release

```bash
gh pr checks --watch
```

When CI is green and the user approves, **the user merges the PR**. The agent must not merge it — merging `main` is a maintainer action.

After the merge, the release workflow in `.github/workflows/release.yml` will:

1. Check out the code with full history (`fetch-depth: 0`).
2. Install dependencies (`pnpm install --frozen-lockfile`).
3. Run `pnpm publish`, which first triggers `prepublishOnly` (build → lint → format:check → test).
4. Create a GitHub Release via `gh release create vX.Y.Z --generate-notes`.

To confirm the publish:

```bash
gh release view vX.Y.Z
npm view @alvarovfon/opencode-agent-monitor version
```

Both should report `X.Y.Z`.

## Post-release: sync main back to develop

After the release PR merges, `main` has commits that `develop` doesn't (the release commit and merge commit). **Sync `main` back to `develop` via a PR** — never by merging locally, because local merges produce unsigned commits that get rejected by `develop`'s branch protection rules (signed commits required).

```bash
# Ensure develop is up to date with the remote
git fetch origin
git branch -D develop
git checkout -b develop origin/develop

# Create a PR from main → develop. This creates signed commits via GitHub.
gh pr create \
  --base develop \
  --head main \
  --title "chore: sync main back to develop after vX.Y.Z" \
  --body "Sync release vX.Y.Z changes back to develop.

This PR is the post-release sync step to keep branches aligned."
```

After creating the PR, paste the URL and ask the user to merge it (same policy — the agent does not merge PRs into protected branches).

**Why a PR and not a local merge**: `develop` requires signed commits and PR-based changes (GH013 rule). A local `git merge main` creates unsigned commits that get rejected on push. A GitHub PR creates a signed merge commit automatically.

## Forbidden

- Direct push to `main`. No exceptions.
- Force-push to any branch involved in a release.
- Amending the release PR after it has been reviewed.
- Editing `package.json` version manually — `prepare-release` owns the version bump.
- Editing `CHANGELOG.md` manually — `prepare-release` regenerates it.
- Running `npm publish` locally. Publication is CI-only via the release workflow.
- Skipping `prepublishOnly` or any of its four steps.
- Running `pnpm prepare-release` after the PR is already open (version must be final before).

## If something goes wrong

- **`pnpm prepare-release` fails**: the bump detection or changelog generation failed. Fix the issue on the release branch and re-run.
- **CI fails on the release PR**: push fixes to the release branch, re-run the four local checks, push again. Do not amend the release commit if it has been pushed — use a follow-up fix commit.
- **Release workflow fails after merge**: the workflow has failed (`pnpm publish` or `gh release create`). Do not attempt to fix forward by force-pushing. Revert the merge commit with a new PR (`Revert "chore(release): vX.Y.Z"`) and investigate the failure on the reverted `main`.
- **Wrong version published**: yank with `npm unpublish` is restricted; prefer `npm deprecate` and a follow-up patch release. Do not push a fix to `main` directly.
