import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_PALETTE_SIZE,
  agentNameFormatter,
} from "../../tui/formatters/agent-name.formatter";

// ---------------------------------------------------------------------------
// capitalize — first character uppercased, rest unchanged
// ---------------------------------------------------------------------------
//
// The spec is intentionally narrow: only the FIRST character is transformed.
// Everything from index 1 onward must be returned byte-for-byte unchanged.
// We pin the contract with both "spec example" cases ("" → "", "coder" →
// "Coder") and a handful of tricky inputs that distinguish a correct
// implementation from a naive one (e.g. a naive `toUpperCase()` of the whole
// string would fail the "mixed case" and "multi-word" cases).

describe("capitalizeName", () => {
  it("empty string returns empty string: '' -> ''", () => {
    assert.equal(
      agentNameFormatter.capitalize(""),
      "",
      "an empty input must return an empty string (no .at(0) crash)",
    );
  });

  it("single lowercase letter is uppercased: 'a' -> 'A'", () => {
    assert.equal(
      agentNameFormatter.capitalize("a"),
      "A",
      "a single lowercase char must be uppercased",
    );
  });

  it("single uppercase letter is unchanged: 'A' -> 'A' (idempotent)", () => {
    // Idempotence on a single uppercase char is a sanity check: if the
    // implementation is `s[0].toUpperCase() + s.slice(1)`, then
    // agentNameFormatter.capitalize("A") must return "A" without accidentally double-
    // uppercasing or appending a stray character.
    assert.equal(
      agentNameFormatter.capitalize("A"),
      "A",
      "an already-uppercase single char must be returned unchanged",
    );
  });

  it("lowercase word is capitalized: 'coder' -> 'Coder'", () => {
    // The spec's canonical happy-path example.
    assert.equal(
      agentNameFormatter.capitalize("coder"),
      "Coder",
      "lowercase first char must be uppercased; tail must be preserved",
    );
  });

  it("already capitalized word is unchanged: 'Coder' -> 'Coder' (idempotent)", () => {
    // Second idempotence check, this time on a multi-character string. A
    // naive `toUpperCase()` of the whole word would turn "Coder" into
    // "CODER"; we explicitly forbid that.
    assert.equal(
      agentNameFormatter.capitalize("Coder"),
      "Coder",
      "an already-capitalized word must be returned unchanged",
    );
  });

  it("hyphenated name only first letter changes: 'code-reviewer' -> 'Code-reviewer'", () => {
    // This is the critical "only the first character" test. A naive
    // implementation that splits on "-" and uppercases each segment would
    // produce "Code-Reviewer" — explicitly wrong per the spec.
    assert.equal(
      agentNameFormatter.capitalize("code-reviewer"),
      "Code-reviewer",
      "only the first character may change; the rest is preserved verbatim",
    );
  });

  it("leading digit is preserved unchanged: '42bots' -> '42bots'", () => {
    // The spec calls this case out explicitly: a leading digit is "nothing
    // to capitalize", so the input must be returned as-is. This also
    // guards against implementations that try to call `.toUpperCase()` on
    // a digit (which would either no-op or, in some locales, produce an
    // unrelated Unicode character).
    assert.equal(
      agentNameFormatter.capitalize("42bots"),
      "42bots",
      "a leading digit has no uppercase form; the string is unchanged",
    );
  });

  it("only first character is uppercased, rest untouched: 'abcDEF' -> 'AbcDEF'", () => {
    // Verifies the implementation does NOT call .toUpperCase() on the
    // whole string. "abcDEF" must become "AbcDEF", not "ABCDEF".
    assert.equal(
      agentNameFormatter.capitalize("abcDEF"),
      "AbcDEF",
      "only s[0] may be uppercased; s[1..] is preserved verbatim",
    );
  });

  it("mixed case input: first letter uppercased, rest preserved: 'cOdEr' -> 'COdEr'", () => {
    // This is the strongest "rest untouched" check. A correct
    // implementation must not modify the existing mixed case of the tail.
    // Note the 'O' in position 1 is preserved (it was already upper).
    assert.equal(
      agentNameFormatter.capitalize("cOdEr"),
      "COdEr",
      "the tail is preserved byte-for-byte; only s[0] is uppercased",
    );
  });

  it("multi-word: only first letter of entire string changes: 'the coder' -> 'The coder'", () => {
    // The spec is explicit: capitalize ONLY the first character of the
    // string, not the first character of each word. "the coder" must
    // become "The coder" — NOT "The Coder". A split-on-whitespace
    // implementation would over-capitalize here.
    assert.equal(
      agentNameFormatter.capitalize("the coder"),
      "The coder",
      "only the first character of the WHOLE string is changed",
    );
  });
});

// ---------------------------------------------------------------------------
// colorIndex — deterministic palette index in [0, AGENT_PALETTE_SIZE)
// ---------------------------------------------------------------------------
//
// The V2 theme exposes an array of categorical colors, so the formatter
// returns an index instead of a V1 token name. The contract is:
//   1. Output is an integer in [0, AGENT_PALETTE_SIZE).
//   2. Output is a pure function of the input.
//   3. 100 distinct names spread across at least 4 indexes.

describe("colorIndex", () => {
  it("returns an in-range integer for 20 representative names", () => {
    const names = [
      "coder",
      "reviewer",
      "scout",
      "planner",
      "tester",
      "alice",
      "bob",
      "carol",
      "dave",
      "eve",
      "frank",
      "grace",
      "heidi",
      "ivan",
      "judy",
      "kurt",
      "liam",
      "mia",
      "noah",
      "olivia",
    ];

    for (const name of names) {
      const index = agentNameFormatter.colorIndex(name);
      assert.ok(Number.isInteger(index), `${name} must map to an integer`);
      assert.ok(
        index >= 0 && index < AGENT_PALETTE_SIZE,
        `${name} must map inside [0, ${AGENT_PALETTE_SIZE}); got ${index}`,
      );
    }
  });

  it("is deterministic across 1000 calls", () => {
    const expected = agentNameFormatter.colorIndex("coder");

    for (let i = 0; i < 1000; i++) {
      assert.equal(agentNameFormatter.colorIndex("coder"), expected);
    }
  });

  it("is pure across a short delay", async () => {
    const before = agentNameFormatter.colorIndex("coder");
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    assert.equal(agentNameFormatter.colorIndex("coder"), before);
  });

  it("spreads 100 distinct names across at least 4 indexes", () => {
    const names = Array.from({ length: 100 }, (_, i) => `agent-${i}`);
    const unique = new Set(
      names.map((name) => agentNameFormatter.colorIndex(name)),
    );

    assert.ok(
      unique.size >= 4,
      `100 distinct names must spread across >= 4 indexes; got ${unique.size}`,
    );
  });

  it("empty name maps to an in-range index", () => {
    const index = agentNameFormatter.colorIndex("");
    assert.ok(index >= 0 && index < AGENT_PALETTE_SIZE);
  });
});
