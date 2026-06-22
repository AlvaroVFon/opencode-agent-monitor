import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Session } from "../session";

export class TraceHelper {
  private readonly traceDir: string;
  private readonly sessions = new Map<string, Session>();
  private dirEnsured = false;

  constructor(traceDir?: string) {
    this.traceDir =
      traceDir ?? join(homedir(), ".config", "opencode", ".tracing");
  }

  ensureDir() {
    if (this.dirEnsured) return;
    if (!existsSync(this.traceDir)) {
      mkdirSync(this.traceDir, { recursive: true });
    }
    this.dirEnsured = true;
  }

  writeTrace(event: Record<string, unknown>) {
    const sessionID = event.sessionID as string | undefined;
    if (typeof sessionID !== "string" || sessionID === "") return;

    let session = this.sessions.get(sessionID);
    if (session === undefined) {
      this.ensureDir();
      session = new Session(this.traceDir, sessionID);
      this.sessions.set(sessionID, session);
    }

    session.write(event);
  }

  close() {
    for (const session of this.sessions.values()) {
      session.close();
    }
    this.sessions.clear();
  }
}
