import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { TraceEvent } from "../shared/trace-events.types";

export class TraceReader {
  readEvents(dir: string): TraceEvent[] {
    const tracePath = join(dir, "trace.jsonl");
    const errorsPath = join(dir, "trace.errors.jsonl");
    return [
      ...this.readJsonl<TraceEvent>(tracePath),
      ...this.readJsonl<TraceEvent>(errorsPath),
    ];
  }

  private readJsonl<T>(path: string): T[] {
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
}

export const traceReader = new TraceReader();
