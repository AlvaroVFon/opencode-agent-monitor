import { readFileSync, statSync, watch } from "node:fs";
import type { FSWatcher } from "node:fs";

export class JsonlTailer {
  private readonly filePath: string;
  private readonly pollIntervalMs: number;
  private readonly onLine?: (line: unknown) => void;
  private readonly onError?: (err: Error) => void;

  private _cursor = 0;
  private _lastSize = 0;
  private _buffer = "";
  private _head?: string;
  private _watcher?: FSWatcher;
  private _pollTimer?: ReturnType<typeof setInterval>;
  private _started = false;

  constructor(
    filePath: string,
    opts?: {
      pollIntervalMs?: number;
      onLine?: (line: unknown) => void;
      onError?: (err: Error) => void;
    },
  ) {
    this.filePath = filePath;
    this.pollIntervalMs = opts?.pollIntervalMs ?? 250;
    this.onLine = opts?.onLine;
    this.onError = opts?.onError;
  }

  get cursor(): number {
    return this._cursor;
  }

  start(cursor?: number): void {
    if (this._started) return;

    if (cursor !== undefined) {
      this._cursor = cursor;
      this._lastSize = cursor;
      this._buffer = "";
    }

    this._started = true;

    try {
      this._watcher = watch(this.filePath, (eventType) => {
        if (eventType === "change" || eventType === "rename") {
          this._read();
        }
      });
      this._watcher.on("error", (err) => this._emitError(this._toError(err)));
    } catch (err) {
      this._emitError(this._toError(err));
    }

    this._pollTimer = setInterval(() => this._read(), this.pollIntervalMs);
    this._read();
  }

  stop(): void {
    this._started = false;

    if (this._watcher) {
      this._watcher.close();
      this._watcher = undefined;
    }

    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = undefined;
    }
  }

  private _read(): void {
    try {
      let stats;
      try {
        stats = statSync(this.filePath);
      } catch (err) {
        this._emitError(this._toError(err));
        return;
      }

      if (!stats.isFile()) {
        this._emitError(new Error(`Not a file: ${this.filePath}`));
        return;
      }

      if (stats.size < this._cursor) {
        this._reset();
      }

      if (stats.size === this._lastSize) {
        return;
      }

      const text = readFileSync(this.filePath, { encoding: "utf8" });
      const firstNewline = text.indexOf("\n");
      const firstLine = (
        firstNewline === -1 ? text : text.slice(0, firstNewline)
      ).trim();

      if (this._head !== undefined && firstLine !== this._head) {
        this._reset();
      }

      const chunk = Buffer.from(text, "utf8")
        .slice(this._lastSize, stats.size)
        .toString("utf8");
      this._buffer += chunk;

      let newlineIndex = this._buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = this._buffer.slice(0, newlineIndex);
        this._buffer = this._buffer.slice(newlineIndex + 1);
        newlineIndex = this._buffer.indexOf("\n");

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

      this._cursor = stats.size - Buffer.byteLength(this._buffer);
      this._lastSize = stats.size;

      if (firstNewline !== -1) {
        this._head = firstLine;
      }
    } catch (err) {
      this._emitError(this._toError(err));
    }
  }

  private _reset(): void {
    this._cursor = 0;
    this._lastSize = 0;
    this._buffer = "";
  }

  private _emitError(err: Error): void {
    try {
      this.onError?.(err);
    } catch {
      // Consumer callbacks must not crash the tailer.
    }
  }

  private _toError(err: unknown): Error {
    return err instanceof Error ? err : new Error(String(err));
  }
}
