import { appendFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { TraceEventType } from "../enums";

export class TraceHelper {
  private readonly traceDir: string;
  private readonly traceFilePath: string;
  private readonly traceErrorsPath: string;
  private dirEnsured = false;

  constructor(traceDir?: string) {
    this.traceDir =
      traceDir ?? join(homedir(), ".config", "opencode", ".tracing");
    this.traceFilePath = join(this.traceDir, "trace.jsonl");
    this.traceErrorsPath = join(this.traceDir, "trace.errors.jsonl");
  }

  ensureDir() {
    if (this.dirEnsured) return; // ← cache
    if (!existsSync(this.traceDir)) {
      mkdirSync(this.traceDir, { recursive: true });
    }
    this.dirEnsured = true;
  }

  writeTrace(event: Record<string, unknown>) {
    try {
      this.ensureDir();
      const versionedEvent = { ...event, schemaVersion: 1 };
      appendFileSync(
        this.traceFilePath,
        JSON.stringify(versionedEvent) + "\n",
        "utf-8",
      );
    } catch (err) {
      this.writeTraceError({
        type: TraceEventType.WRITE_TRACE_ERROR,
        originalEventType: event.type,
        error: String(err),
        timestamp: Date.now(),
        schemaVersion: 1,
      });
    }
  }

  writeTraceError(event: Record<string, unknown>) {
    try {
      this.ensureDir();
      const versionedEvent = { ...event, schemaVersion: 1 };
      appendFileSync(
        this.traceErrorsPath,
        JSON.stringify(versionedEvent) + "\n",
        "utf-8",
      );
    } catch {
      // swallow error, we can't do anything about it
    }
  }
}
