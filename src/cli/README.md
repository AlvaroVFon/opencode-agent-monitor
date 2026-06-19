# CLI

Extract and analyze metrics from `trace.jsonl` files without running the TUI. Useful for CI pipelines, batch reports, and data exports.

## Usage

### Via npx (no install)

```bash
npx @alvarovfon/opencode-agent-monitor <command> [options]
```

### Global install

```bash
npm install -g @alvarovfon/opencode-agent-monitor
agent-monitor <command> [options]
```

### Local development

```bash
pnpm metrics <command> [options]
```

---

### stats — aggregate and display metrics

```bash
agent-monitor stats [options]
```

| Flag                  | Default                       | Description                                  |
| --------------------- | ----------------------------- | -------------------------------------------- |
| `--dir <path>`        | `~/.config/opencode/.tracing` | Trace directory                              |
| `--json`              | —                             | JSON output                                  |
| `--markdown` / `--md` | —                             | Markdown output (default)                    |
| `--since <duration>`  | `all`                         | Time filter: `1d`, `24h`, `7d`, `30d`, `all` |
| `--session <id>`      | —                             | Filter to a specific session                 |
| `--top <n>`           | —                             | Show top N entries by cost                   |

Example:

```bash
agent-monitor stats --since 24h --top 5 --json
```

### errors — list errors

```bash
agent-monitor errors [options]
```

| Flag                 | Default                       | Description          |
| -------------------- | ----------------------------- | -------------------- |
| `--dir <path>`       | `~/.config/opencode/.tracing` | Trace directory      |
| `--since <duration>` | `all`                         | Time filter          |
| `--limit <n>`        | `50`                          | Max error entries    |
| `--type <type>`      | —                             | Filter by error type |
| `--json`             | —                             | JSON output          |

Example:

```bash
agent-monitor errors --since 7d --limit 10 --json
```

### export — export to file

```bash
agent-monitor export [options]
```

| Flag                 | Default                       | Description                              |
| -------------------- | ----------------------------- | ---------------------------------------- |
| `--dir <path>`       | `~/.config/opencode/.tracing` | Trace directory                          |
| `--format <fmt>`     | `csv`                         | Output format: `csv`, `json`, `markdown` |
| `--out <file>`       | `metrics.<format>`            | Output file path                         |
| `--since <duration>` | `all`                         | Time filter                              |

Example:

```bash
agent-monitor export --since 30d --format markdown
```

### compare — cost simulation

Compare your real spending with what it would have costed on other models (GPT-4o, Claude 3.5 Sonnet, etc.).

```bash
agent-monitor compare [options]
```

| Flag                 | Default                       | Description                  |
| -------------------- | ----------------------------- | ---------------------------- |
| `--dir <path>`       | `~/.config/opencode/.tracing` | Trace directory              |
| `--since <duration>` | `all`                         | Time filter                  |
| `--session <id>`     | —                             | Filter to a specific session |

## Output Formats

- **Markdown** (default for `stats`, available in `export`) — human-readable tables with summary, per-agent, per-tool, and errors sections.
- **JSON** — structured output consumable by scripts and tools.
- **CSV** (default for `export`) — flat table suitable for spreadsheets.
