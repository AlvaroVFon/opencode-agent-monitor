import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export class SessionFS {
  sanitizeSessionId(raw: string): string {
    return raw.replace(/[^A-Za-z0-9._-]/g, "_");
  }

  sessionFilePath(dir: string, sessionId: string): string {
    return join(dir, this.sanitizeSessionId(sessionId) + ".jsonl");
  }

  listSessionFiles(dir: string): string[] {
    try {
      const entries = readdirSync(dir);
      return entries
        .filter((e) => e.endsWith(".jsonl"))
        .map((e) => join(dir, e))
        .sort();
    } catch (err: unknown) {
      if (SessionFS.#isNodeError(err) && err.code === "ENOENT") {
        return [];
      }
      throw err;
    }
  }

  readSessionFile(path: string): unknown[] {
    let content: string;
    try {
      content = readFileSync(path, "utf-8");
    } catch (err: unknown) {
      if (SessionFS.#isNodeError(err) && err.code === "ENOENT") {
        return [];
      }
      throw err;
    }

    const events: unknown[] = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      try {
        events.push(JSON.parse(trimmed));
      } catch {
        // silently skip malformed lines
      }
    }
    return events;
  }

  static #isNodeError(err: unknown): err is NodeJS.ErrnoException {
    return err instanceof Error && "code" in err;
  }
}

export const sessionFS = new SessionFS();
