import type { TraceEvent } from "../shared/trace-events.types";
import { sessionFS } from "../shared/session-fs";

const LEGACY_FILES = new Set(["trace.jsonl", "trace.errors.jsonl"]);

function isNotLegacy(filePath: string): boolean {
  const basename = filePath.split("/").pop() ?? "";
  return !LEGACY_FILES.has(basename);
}

export class TraceReader {
  readEvents(dir: string): TraceEvent[] {
    const files = sessionFS.listSessionFiles(dir).filter(isNotLegacy);
    const events: TraceEvent[] = [];
    for (const file of files) {
      events.push(...(sessionFS.readSessionFile(file) as TraceEvent[]));
    }
    events.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    return events;
  }

  readJsonl<T>(path: string): T[] {
    return sessionFS.readSessionFile(path) as T[];
  }
}

export const traceReader = new TraceReader();
