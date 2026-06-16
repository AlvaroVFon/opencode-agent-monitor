import { UNKNOWN } from "../enums";

export function extractErrorMessage(data: unknown): string {
  if (data === null || data === undefined) return UNKNOWN;
  if (typeof data === "object" && "message" in data) {
    return String((data as Record<string, unknown>).message);
  }
  return JSON.stringify(data);
}
