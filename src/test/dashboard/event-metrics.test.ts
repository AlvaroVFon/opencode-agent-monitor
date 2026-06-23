import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aggregateEventMetrics } from "../../cli/dashboard/panels/event-metrics";
import type { TimelineRow } from "../../cli/dashboard/dashboard.types";

describe("aggregateEventMetrics", () => {
  it("returns per-type counts from timeline data", () => {
    const timeline: TimelineRow[] = [
      { sessionID: "s1", type: "llm_call", durationMs: 500, timestamp: 100 },
      { sessionID: "s1", type: "llm_call", durationMs: 300, timestamp: 200 },
      { sessionID: "s1", type: "tool_call", durationMs: 100, timestamp: 150 },
      {
        sessionID: "s2",
        type: "session_created",
        durationMs: 0,
        timestamp: 50,
      },
    ];

    const result = aggregateEventMetrics(timeline);

    assert.equal(result.hasData, true);
    assert.equal(result.typeCounts.length, 3);

    const llmCall = result.typeCounts.find((t) => t.type === "llm_call");
    assert.ok(llmCall);
    assert.equal(llmCall.count, 2);

    const toolCall = result.typeCounts.find((t) => t.type === "tool_call");
    assert.ok(toolCall);
    assert.equal(toolCall.count, 1);

    const sessionCreated = result.typeCounts.find(
      (t) => t.type === "session_created",
    );
    assert.ok(sessionCreated);
    assert.equal(sessionCreated.count, 1);
  });

  it("computes average duration per event type", () => {
    const timeline: TimelineRow[] = [
      { sessionID: "s1", type: "llm_call", durationMs: 500, timestamp: 100 },
      { sessionID: "s1", type: "llm_call", durationMs: 300, timestamp: 200 },
      { sessionID: "s1", type: "tool_call", durationMs: 100, timestamp: 150 },
    ];

    const result = aggregateEventMetrics(timeline);

    const llmCall = result.typeCounts.find((t) => t.type === "llm_call");
    assert.ok(llmCall);
    assert.equal(llmCall.avgDurationMs, 400); // (500 + 300) / 2

    const toolCall = result.typeCounts.find((t) => t.type === "tool_call");
    assert.ok(toolCall);
    assert.equal(toolCall.avgDurationMs, 100); // 100 / 1
  });

  it("identifies the top 5 slowest events", () => {
    const timeline: TimelineRow[] = [
      { sessionID: "s1", type: "a", durationMs: 10, timestamp: 1 },
      { sessionID: "s1", type: "b", durationMs: 200, timestamp: 2 },
      { sessionID: "s1", type: "c", durationMs: 50, timestamp: 3 },
      { sessionID: "s1", type: "d", durationMs: 500, timestamp: 4 },
      { sessionID: "s1", type: "e", durationMs: 30, timestamp: 5 },
      { sessionID: "s1", type: "f", durationMs: 1000, timestamp: 6 },
      { sessionID: "s1", type: "g", durationMs: 5, timestamp: 7 },
    ];

    const result = aggregateEventMetrics(timeline);

    assert.ok(result.top5Slowest);
    assert.equal(result.top5Slowest.length, 5);
    // Sorted descending by durationMs
    assert.equal(result.top5Slowest[0].durationMs, 1000);
    assert.equal(result.top5Slowest[1].durationMs, 500);
    assert.equal(result.top5Slowest[2].durationMs, 200);
    assert.equal(result.top5Slowest[3].durationMs, 50);
    assert.equal(result.top5Slowest[4].durationMs, 30);
  });

  it("returns hasData false with 'No events recorded' when timeline is empty", () => {
    const result = aggregateEventMetrics([]);

    assert.equal(result.hasData, false);
    assert.equal(result.typeCounts.length, 0);
    assert.equal(result.emptyMessage, "No events recorded");
  });

  it("does not include individual raw row data in the result", () => {
    const timeline: TimelineRow[] = [
      { sessionID: "s1", type: "llm_call", durationMs: 500, timestamp: 100 },
      { sessionID: "s1", type: "tool_call", durationMs: 100, timestamp: 150 },
    ];

    const result = aggregateEventMetrics(timeline);

    // Result should be aggregated — no raw rows
    assert.ok(!("rows" in result));
    // typeCounts should have summary data, not individual rows
    for (const tc of result.typeCounts) {
      assert.equal(typeof tc.count, "number");
      assert.equal(typeof tc.avgDurationMs, "number");
      assert.ok(!("sessionID" in tc));
      assert.ok(!("timestamp" in tc));
    }
  });
});
