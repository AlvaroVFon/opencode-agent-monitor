---
name: update-roadmap
description: Update ROADMAP.md when closing phases, completing tasks, or changing priorities
license: MIT
compatibility: opencode
metadata:
  audience: maintainers
  workflow: planning
---

## What I do

Update the project's `ROADMAP.md` living document after closing a phase, completing a task, or reprioritising work. The ROADMAP is referenced in every PR body and release template — keeping it current ensures the team and the agent share an accurate view of project state.

## When to use me

Activate whenever a phase is completed, a task is checked off, or a decision changes the execution order or open questions. This typically happens:

- After merging a PR that closes a phase (update Current state + mark phase completed + update Execution order).
- After a planning decision changes priorities (update Open questions, Execution order).
- Before a release PR (ensure ROADMAP.md reflects the upcoming release's content).

Do **not** use this for routine code changes — only for structural updates to the roadmap.

## ROADMAP.md structure

The document has five main sections:

| Section                           | Format                                                             |
| --------------------------------- | ------------------------------------------------------------------ |
| **Current state** (top)           | Bullet list with prefix symbols: `✅`, `❌`, `⏸`, `🔜`             |
| **Key Metrics** (table)           | Markdown table with `Estado` column                                |
| **Phases** (main body)            | `## Phase N — Title` followed by goal, checklist, closure criteria |
| **Execution order** (near bottom) | Numbered list with status prefixes                                 |
| **Open questions** (bottom)       | Bullet list with `✅`, `❌`, `⏸` prefixes                          |

## Status symbols

| Symbol  | Meaning                 | When to use                                        |
| ------- | ----------------------- | -------------------------------------------------- |
| `✅`    | Completed               | Task/phase is done and merged                      |
| `❌`    | Removed / won't do      | Explicitly cancelled, replaced, or descoped        |
| `🔜`    | Next up / high priority | High priority, planned for current or next release |
| `⏸`     | Paused / under study    | Deferred, needs more research, blocked             |
| `- [x]` | Checklist done          | Within a phase subsection                          |
| `- [ ]` | Checklist pending       | Within a phase subsection                          |

## Updating each section

### 1. Current state

Update the date in the heading: `## Current state (snapshot as of YYYY-MM-DD)`

Add or update bullet points using the correct prefix:

```markdown
- ✅ Feature implemented (Phase N): brief description
- ❌ Feature removed (rationale)
- 🔜 Next feature planned
- ⏸ Feature under study
```

Group related items. Keep the list scannable — about 15–30 entries max. Remove stale or redundant entries.

### 2. Key Metrics table

Update the `Estado` column cells. Valid values: `✅`, `🔜 N.N`, `❌`.

A metric with no implementation target yet uses `❌`. One planned for a specific phase uses `🔜 **N.N**`.

### 3. Phases

Each phase follows a consistent structure. Update it based on what changed:

#### Marking a phase as completed

Change the heading from:

```markdown
## Phase N — Title (vX.Y.Z)
```

to:

```markdown
## Phase N — Title ✅ **completed (YYYY-MM-DD)**
```

Check off all remaining sub-items (` ` `- [ ]` → `- [x]`).

Ensure `**Closure criteria:**` lists everything that was delivered.

Ensure the Goal reflects what was achieved, not aspirational.

#### Adding a new phase

Insert it in order below existing phases. Follow the existing structure:

```markdown
## Phase N — Title (vX.Y.Z)

**Goal:** one-sentence description of what this phase delivers.

### N.1 Sub-section

- [ ] Task one
- [ ] Task two

### N.2 Tests

- [ ] Test coverage expected

**Closure criteria:** measurable criteria that define when this phase is done.
```

Use `###` sub-sections for logical groupings. Use `- [ ]` for individual tasks.

### 4. Execution order

Update the numbered list at the bottom. Add new items following the pattern:

```markdown
N. ✅ **Phase N** (description) → completed
N. 🔜 **Phase N** (description) → current or next
N. ⏸ **Phase N** (description) → deferred
N. ❌ **Phase N** (description) → removed
```

Keep the list sequential. When a phase is completed (`✅`), move it below the remaining items or leave it in place with its status. Do not delete completed entries — they provide release history.

### 5. Open questions / pending decisions

Add or update bullet points with the status prefix. Follow the existing format:

```markdown
- ✅ Question resolved and decision documented
- ❌ Question closed (no action needed)
- ⏸ Question under study
```

Include the reasoning or a reference to where the decision is documented.

## Examples

### Marking a phase complete (before → after)

Before:

```
## Phase 2.7 — Skill usage tracking (alta prioridad)

### 2.7.1 Nuevos tipos de evento

- [ ] `SKILL_CALL` / `SKILL_RESULT` en `TraceEventType`
- [ ] `SkillCallEvent` / `SkillResultEvent` en la unión `TraceEvent`
```

After:

```
## Phase 2.7 — Skill usage tracking ✅ **completed (2026-06-20)**

### 2.7.1 Nuevos tipos de evento

- [x] `SKILL_CALL` / `SKILL_RESULT` en `TraceEventType`
- [x] `SkillCallEvent` / `SkillResultEvent` en la unión `TraceEvent`
```

### Adding a Current state entry

```markdown
- ✅ Skill usage tracking (Phase 2.7): `bySkill` in snapshot, CLI, TUI
```

## Validation

After editing, verify:

1. The file is valid Markdown (no broken table pipes, no missing spaces after `-`).
2. All `[x]` and `[ ]` checkboxes have a space after the brackets.
3. No merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
4. The date in the Current state heading is today's date (not stale).
5. Version references (vX.Y.Z) in phase headings match `package.json`.

## Forbidden

- Deleting completed phases (they preserve history).
- Changing the structure conventions (phases are referenced by number in PRs and discussions).
- Adding tasks to a completed phase — create a new phase instead.
- Removing the `**Closure criteria:**` section from a phase.
- Breaking the markdown table syntax in Key Metrics (pipes alignment).
