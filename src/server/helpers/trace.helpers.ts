import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Session } from "../session";

export class TraceHelper {
  private readonly traceDir: string;
  private readonly sessions = new Map<string, Session>();
  private readonly parentMap = new Map<string, string>();
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

    // Track parent-child relationships so child events route to the parent file.
    const parentID = event.parentID as string | undefined;
    if (typeof parentID === "string" && parentID !== "") {
      this.parentMap.set(sessionID, parentID);
    }

    const effectiveSessionID = this.parentMap.get(sessionID) ?? sessionID;

    let session = this.sessions.get(effectiveSessionID);
    if (session === undefined) {
      this.ensureDir();
      session = new Session(this.traceDir, effectiveSessionID);
      this.sessions.set(effectiveSessionID, session);
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
