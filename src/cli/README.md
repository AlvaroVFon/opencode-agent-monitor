# CLI

Extract and analyze metrics from `trace.jsonl` files without running the TUI. Useful for CI pipelines, batch reports, and data exports.

## Usage

```bash
pnpm metrics <command> [options]
```

### stats — aggregate and display metrics

```bash
pnpm metrics stats [options]
```

| Flag                 | Default                       | Description                                  |
| -------------------- | ----------------------------- | -------------------------------------------- |
| `--dir <path>`       | `~/.config/opencode/.tracing` | Trace directory                              |
| `--json`             | —                             | JSON output (default: markdown)              |
| `--since <duration>` | `all`                         | Time filter: `1d`, `24h`, `7d`, `30d`, `all` |
| `--session <id>`     | —                             | Filter to a specific session                 |
| `--top <n>`          | —                             | Show top N entries by cost                   |

Example:

```bash
pnpm metrics stats --since 24h --top 5 --json
```

### errors — list errors

```bash
pnpm metrics errors [options]
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
pnpm metrics errors --since 7d --limit 10 --json
```

### export — export to file

```bash
pnpm metrics export [options]
```

| Flag                 | Default                       | Description                  |
| -------------------- | ----------------------------- | ---------------------------- |
| `--dir <path>`       | `~/.config/opencode/.tracing` | Trace directory              |
| `--format <fmt>`     | `csv`                         | Output format: `csv`, `json` |
| `--out <file>`       | stdout                        | Output file path             |
| `--since <duration>` | `all`                         | Time filter                  |

Example:

```bash
pnpm metrics export --format csv --out report.csv --since 30d
```

## Output Formats

- **Markdown** (default for `stats`) — human-readable tables with summary, per-agent, per-tool, and errors sections.
- **JSON** — structured output consumable by scripts and tools.
- **CSV** (default for `export`) — flat table suitable for spreadsheets.
