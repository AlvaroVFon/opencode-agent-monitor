import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sessionTimerFormatter } from "../../tui/formatters/session-timer.formatter.js";

// ---------------------------------------------------------------------------
// format — elapsed wall-clock time for the sidebar panel
// ---------------------------------------------------------------------------
//
// Per the spec, SessionTimerFormatter.format computes elapsed time from
// firstSeenAt and delegates to DurationFormatter for rendering. Edge cases
// for 0/future timestamps are handled by the formatter, not the delegate.
//
// The helper is a pure function: no I/O, no side effects, no hidden state.
// These tests pin the contract for the implementer.

describe("SessionTimerFormatter", () => {
  it("returns '--' when firstSeenAt is 0", () => {
    assert.equal(
      sessionTimerFormatter.format(0, 5000),
      "--",
      "firstSeenAt === 0 must return '--' regardless of now",
    );
  });

  it("returns '0s' when now is before firstSeenAt (future timestamp)", () => {
    // firstSeenAt is 5000ms in the future relative to now
    const firstSeenAt = 10_000;
    const now = 5_000;
    assert.equal(
      sessionTimerFormatter.format(firstSeenAt, now),
      "0s",
      "elapsed <= 0 must clamp to '0s'",
    );
  });

  it("delegates to DurationFormatter for positive elapsed time", () => {
    // 600,000ms = 10 minutes → durationFormatter should produce "10m0s"
    const firstSeenAt = 100_000;
    const now = 700_000;
    const result = sessionTimerFormatter.format(firstSeenAt, now);
    // DurationFormatter.format(600_000) should produce "10m0s"
    assert.equal(
      result,
      "10m0s",
      "positive elapsed must delegate to durationFormatter",
    );
  });

  it("defaults now to Date.now() when not provided", () => {
    const firstSeenAt = Date.now() - 10_000;
    const result = sessionTimerFormatter.format(firstSeenAt);
    // The result should be a non-empty string that does NOT start with '--'
    assert.ok(
      typeof result === "string" && result.length > 0,
      "must return a non-empty string",
    );
    assert.ok(
      result !== "--",
      "when firstSeenAt is non-zero and recent, must not return '--'",
    );
  });

  it("passes through sub-second elapsed to DurationFormatter", () => {
    // 500ms elapsed → durationFormatter.format(500) returns "500ms"
    const firstSeenAt = 1_000;
    const now = 1_500;
    assert.equal(
      sessionTimerFormatter.format(firstSeenAt, now),
      "500ms",
      "sub-second elapsed must delegate to durationFormatter",
    );
  });

  it("formats minute-scale elapsed correctly", () => {
    // 5 minutes = 300,000ms → "5m0s"
    const firstSeenAt = 100_000;
    const now = 400_000;
    assert.equal(
      sessionTimerFormatter.format(firstSeenAt, now),
      "5m0s",
      "minute-scale elapsed must delegate correctly",
    );
  });

  it("formats hour-scale elapsed correctly", () => {
    // 2 hours = 7,200,000ms → "2h0m"
    const firstSeenAt = 100_000;
    const now = 7_300_000;
    assert.equal(
      sessionTimerFormatter.format(firstSeenAt, now),
      "2h0m",
      "hour-scale elapsed must delegate correctly",
    );
  });
});
