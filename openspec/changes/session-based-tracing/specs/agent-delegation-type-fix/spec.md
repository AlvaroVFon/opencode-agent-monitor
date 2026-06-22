# AgentDelegationEvent Type Fix Specification

## Purpose

Add the explicit `sessionID: string` field to `AgentDelegationEvent` — the field is already written in practice but missing from the type definition.

## Requirements

### Requirement: AgentDelegationEvent includes explicit sessionID

The system MUST define `sessionID: string` as a required field on the `AgentDelegationEvent` type, consistent with all other trace event types.

#### Scenario: sessionID is present in the type

- GIVEN a source file importing `AgentDelegationEvent`
- WHEN accessing `event.sessionID`
- THEN TypeScript does NOT produce a type error
- AND the field is typed as `string`

#### Scenario: All TraceEvent union members have sessionID

- GIVEN the `TraceEvent` union type
- WHEN checking each member
- THEN every member (`LlmCallEvent`, `ToolCallEvent`, `SkillCallEvent`, `SessionCreatedEvent`, `SessionErrorEvent`, `AgentDelegationEvent`) includes `sessionID: string`

### Requirement: Backward compatible with existing usage

Existing code that creates `type: TraceEventType.AGENT_DELEGATION` objects without explicit `sessionID` MUST still compile (the field was already being written at runtime).

#### Scenario: Existing delegation handler not broken

- GIVEN an `AgentDelegationHandler` that constructs `{ type: "agent_delegation", sessionID, ... }`
- WHEN the type is updated
- THEN the handler continues to compile without changes
- AND the sessionID field carries through to written JSON
