import { readFileSync, statSync, watch } from "node:fs";
import type { FSWatcher } from "node:fs";
import { sessionFS } from "../shared/session-fs.js";

const DEFAULT_POLL_INTERVAL_MS = 250;

export class SessionWatcher {
  private readonly traceDir: string;
  private readonly sessionID: string;
  private readonly filePath: string;
  private readonly pollIntervalMs: number;
  private readonly onLine?: (line: unknown) => void;
  private readonly onError?: (err: Error) => void;

  private cursorPosition = 0;
  private lastSize = 0;
  private buffer = "";
  private head?: string;
  private watcher?: FSWatcher;
  private pollTimer?: ReturnType<typeof setInterval>;
  private started = false;

  constructor(
    traceDir: string,
    sessionID: string,
    opts?: {
      pollIntervalMs?: number;
      onLine?: (line: unknown) => void;
      onError?: (err: Error) => void;
    },
  ) {
    this.traceDir = traceDir;
    this.sessionID = sessionID;
    this.filePath = sessionFS.sessionFilePath(traceDir, sessionID);
    this.pollIntervalMs = opts?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.onLine = opts?.onLine;
    this.onError = opts?.onError;
  }

  get cursor(): number {
    return this.cursorPosition;
  }

  start(cursor?: number): void {
    if (this.started) return;

    if (cursor !== undefined) {
      this.cursorPosition = cursor;
      this.lastSize = cursor;
      this.buffer = "";
    }

    this.started = true;

    try {
      this.watcher = watch(this.filePath, (eventType) => {
        if (eventType === "change" || eventType === "rename") {
          this.read();
        }
      });
      this.watcher.on("error", (err) => this.emitError(this.toError(err)));
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code !== "ENOENT") {
        this.emitError(this.toError(err));
      }
    }

    this.pollTimer = setInterval(() => this.read(), this.pollIntervalMs);
    this.read();
  }

  stop(): void {
    this.started = false;

    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private read(): void {
    try {
      const stats = this.statFile();
      if (!stats) return;

      if (this.isTruncated(stats.size)) {
        this.reset();
      }

      if (stats.size === this.lastSize) {
        return;
      }

      const text = readFileSync(this.filePath, "utf8");

      if (this.isRotated(text)) {
        this.reset();
      }

      this.ingestNewBytes(text, stats.size);
    } catch (err) {
      this.emitError(this.toError(err));
    }
  }

  private statFile(): { size: number } | null {
    try {
      const stats = statSync(this.filePath);
      if (!stats.isFile()) {
        this.emitError(new Error(`Not a file: ${this.filePath}`));
        return null;
      }
      return { size: stats.size };
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code !== "ENOENT") {
        this.emitError(this.toError(err));
      }
      return null;
    }
  }

  private isTruncated(statsSize: number): boolean {
    return statsSize < this.cursorPosition;
  }

  private isRotated(text: string): boolean {
    if (this.head === undefined) return false;
    const firstNewline = text.indexOf("\n");
    const firstLine = (
      firstNewline === -1 ? text : text.slice(0, firstNewline)
    ).trim();
    return firstLine !== this.head;
  }

  private ingestNewBytes(text: string, statsSize: number): void {
    const chunk = Buffer.from(text, "utf8")
      .slice(this.lastSize, statsSize)
      .toString("utf8");
    this.buffer += chunk;

    this.flushLines();

    this.cursorPosition = statsSize - Buffer.byteLength(this.buffer);
    this.lastSize = statsSize;

    const firstNewline = text.indexOf("\n");
    if (firstNewline !== -1) {
      this.head = text.slice(0, firstNewline).trim();
    }
  }

  private flushLines(): void {
    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      newlineIndex = this.buffer.indexOf("\n");

      const trimmed = line.trim();
      if (trimmed.length === 0) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed);
        this.onLine?.(parsed);
      } catch {
        // Skip malformed lines without invoking onError.
      }
    }
  }

  private reset(): void {
    this.cursorPosition = 0;
    this.lastSize = 0;
    this.buffer = "";
    this.head = undefined;
  }

  private emitError(err: Error): void {
    try {
      this.onError?.(err);
    } catch {
      // Consumer callbacks must not crash the watcher.
    }
  }

  private toError(err: unknown): Error {
    return err instanceof Error ? err : new Error(String(err));
  }
}
