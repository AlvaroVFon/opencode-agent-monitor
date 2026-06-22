import { createWriteStream, type WriteStream } from "node:fs";
import { sessionFS } from "../shared/session-fs";

export class Session {
  readonly #traceDir: string;
  readonly #sessionID: string;
  #stream: WriteStream | null = null;
  #closed = false;

  constructor(traceDir: string, sessionID: string) {
    this.#traceDir = traceDir;
    this.#sessionID = sessionID;
    // Stream is NOT created here — lazy init on first write()
  }

  write(event: Record<string, unknown>): void {
    if (this.#closed) return;

    if (this.#stream === null) {
      const filePath = sessionFS.sessionFilePath(
        this.#traceDir,
        this.#sessionID,
      );
      this.#stream = createWriteStream(filePath, { flags: "a" });
      this.#stream.on("error", (err: Error) => {
        process.stderr.write(
          `[AgentMonitor Session] WriteStream error: ${err.message}\n`,
        );
      });
    }

    const versionedEvent = { ...event, schemaVersion: 1 };
    this.#stream.write(JSON.stringify(versionedEvent) + "\n");
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;

    if (this.#stream !== null) {
      this.#stream.end();
      this.#stream = null;
    }
  }
}
