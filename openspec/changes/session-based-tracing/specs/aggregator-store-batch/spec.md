# AggregatorStore Batch Specification

## Purpose

Add silent ingest (no snapshot emission) and explicit `flush()` to the TUI `AggregatorStore` so the `SessionWatcher` can batch-load historical events without triggering per-event UI updates.

## Requirements

### Requirement: ingest(event, { silent: true }) processes without emitting snapshot

The system MUST process the event into all internal maps but skip the `onSnapshot` call when `silent: true` is passed.

#### Scenario: Silent ingest updates state silently

- GIVEN an AggregatorStore with `onSnapshot` wired
- WHEN `ingest(event, { silent: true })` is called
- THEN the event is fully processed (maps updated)
- AND `onSnapshot` is NOT called

#### Scenario: Standard ingest still emits snapshot

- GIVEN an AggregatorStore with `onSnapshot` wired
- WHEN `ingest(event)` is called (no opts)
- THEN the event is processed
- AND `onSnapshot` IS called
- (Backward compatibility verified)

### Requirement: flush() emits accumulated snapshot

The system MUST call `onSnapshot` with the current state after one or more silent ingests.

#### Scenario: Flush after silent batch

- GIVEN an AggregatorStore with 5 silent ingests
- WHEN `flush()` is called
- THEN `onSnapshot` is called once with a snapshot containing all 5 events

#### Scenario: Flush with no pending changes

- GIVEN an AggregatorStore with no events ingested
- WHEN `flush()` is called
- THEN `onSnapshot` is called with an empty/zeroed snapshot (no throw)
