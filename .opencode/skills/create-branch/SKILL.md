---
name: create-branch
description: Create a feature/fix/refactor branch from develop with a standardised name
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: git
---

## What I do

Start from `develop`, pull the latest changes, and create a new branch with a standardised name following Git Flow conventions. The branch name encodes the type of work and a brief description, making it easy to understand at a glance.

## When to use me

Activate whenever the user asks to start a new task, create a branch, or begin working on something. Run this **before** any development work, regardless of whether code has already been written. Do **not** use this for release branches — use `create-release` for that.

## Branch naming convention

Format: `<type>/<kebab-case-description>`

### Allowed types

| Type       | When to use                                |
| ---------- | ------------------------------------------ |
| `feat`     | New feature or user-visible enhancement    |
| `fix`      | Bug fix                                    |
| `refactor` | Code restructuring, no user-facing change  |
| `chore`    | Tooling, dependencies, CI, maintenance     |
| `docs`     | Documentation changes                      |
| `test`     | Adding or updating tests                   |
| `style`    | Formatting, whitespace (rarely used alone) |
| `perf`     | Performance improvement                    |
| `build`    | Build system or packaging changes          |
| `ci`       | CI configuration                           |
| `revert`   | Reverting a previous commit                |

### Description rules

- kebab-case (lowercase, hyphens between words).
- Max 50 characters.
- No special characters (`@`, `#`, `!`, etc.).
- Brief but descriptive — enough to identify the task without reading the full spec.

### Examples

- `feat/add-dark-mode`
- `fix/login-redirect-loop`
- `refactor/parse-utils`
- `chore/update-prettier-config`
- `docs/api-endpoints`

## Pre-flight

1. `git status` — the working tree must be clean. If there are uncommitted changes, ask the user how to handle them (stash, commit, or discard). Do not proceed with a dirty tree.
2. `git fetch origin` — ensure remote references are up to date.

## Process

1. Switch to `develop`:

   ```
   git switch develop
   ```

2. Pull latest changes with fast-forward only:

   ```
   git pull --ff-only origin develop
   ```

   If this fails, `develop` has local commits or diverged — something unexpected happened. Stop and ask the user to investigate. Do not use `--rebase` or merge as a fallback.

3. Determine the branch type and description by asking the user or inferring from the task description. Use the table above to pick the correct type.

4. Create the branch:
   ```
   git switch -c <type>/<description>
   ```

## Validation

Confirm the branch was created correctly:

```
git rev-parse --abbrev-ref HEAD
```

The output must match `<type>/<description>` and the branch must be based on the latest `origin/develop`.

## Forbidden

- Creating a branch from `main` — `main` is release-only.
- Pushing directly to `develop` — use a feature branch and a PR.
- Branch names without a type (e.g. `my-feature`).
- Branch names with special characters, mixed case, or spaces.
- Using `--no-ff` on `git pull` — `--ff-only` is the only safe mode here.
