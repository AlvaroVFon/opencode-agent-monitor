import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { TraceEvent } from "../shared/trace-events.types";

export function readEvents(dir: string): TraceEvent[] {
  const tracePath = join(dir, "trace.jsonl");
  const errorsPath = join(dir, "trace.errors.jsonl");
  return [
    ...readJsonl<TraceEvent>(tracePath),
    ...readJsonl<TraceEvent>(errorsPath),
  ];
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const out: T[] = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (t)
      try {
        out.push(JSON.parse(t) as T);
      } catch {}
  }
  return out;
}
