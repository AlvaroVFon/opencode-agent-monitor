import { durationFormatter } from "./duration.formatter.js";

export class SessionTimerFormatter {
  format(firstSeenAt: number, now: number = Date.now()): string {
    if (firstSeenAt === 0) return "--";
    const elapsed = now - firstSeenAt;
    if (elapsed <= 0) return "0s";
    return durationFormatter.format(elapsed);
  }
}

export const sessionTimerFormatter = new SessionTimerFormatter();
