import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { capitalizeName, getAgentColor } from "../../tui/formatters/agent-name";

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------
//
// The palette domain is fixed by the spec (acceptance criterion #2): exactly
// five theme color keys. We centralize it in a single `Set` so every test
// that needs to assert "output is a documented palette key" uses the same
// authoritative value.
//
// The list is intentionally frozen as a `const` (not a `Set` of expected
// values) so we can re-construct identical `Set`s in any test without
// worrying about shared mutable state.

const PALETTE_KEYS = [
  "accent",
  "secondary",
  "info",
  "success",
  "warning",
] as const;

type PaletteKey = (typeof PALETTE_KEYS)[number];

const PALETTE_SET: ReadonlySet<PaletteKey> = new Set(PALETTE_KEYS);

// ---------------------------------------------------------------------------
// capitalizeName — first character uppercased, rest unchanged
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
      capitalizeName(""),
      "",
      "an empty input must return an empty string (no .at(0) crash)",
    );
  });

  it("single lowercase letter is uppercased: 'a' -> 'A'", () => {
    assert.equal(
      capitalizeName("a"),
      "A",
      "a single lowercase char must be uppercased",
    );
  });

  it("single uppercase letter is unchanged: 'A' -> 'A' (idempotent)", () => {
    // Idempotence on a single uppercase char is a sanity check: if the
    // implementation is `s[0].toUpperCase() + s.slice(1)`, then
    // capitalizeName("A") must return "A" without accidentally double-
    // uppercasing or appending a stray character.
    assert.equal(
      capitalizeName("A"),
      "A",
      "an already-uppercase single char must be returned unchanged",
    );
  });

  it("lowercase word is capitalized: 'coder' -> 'Coder'", () => {
    // The spec's canonical happy-path example.
    assert.equal(
      capitalizeName("coder"),
      "Coder",
      "lowercase first char must be uppercased; tail must be preserved",
    );
  });

  it("already capitalized word is unchanged: 'Coder' -> 'Coder' (idempotent)", () => {
    // Second idempotence check, this time on a multi-character string. A
    // naive `toUpperCase()` of the whole word would turn "Coder" into
    // "CODER"; we explicitly forbid that.
    assert.equal(
      capitalizeName("Coder"),
      "Coder",
      "an already-capitalized word must be returned unchanged",
    );
  });

  it("hyphenated name only first letter changes: 'code-reviewer' -> 'Code-reviewer'", () => {
    // This is the critical "only the first character" test. A naive
    // implementation that splits on "-" and uppercases each segment would
    // produce "Code-Reviewer" — explicitly wrong per the spec.
    assert.equal(
      capitalizeName("code-reviewer"),
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
      capitalizeName("42bots"),
      "42bots",
      "a leading digit has no uppercase form; the string is unchanged",
    );
  });

  it("only first character is uppercased, rest untouched: 'abcDEF' -> 'AbcDEF'", () => {
    // Verifies the implementation does NOT call .toUpperCase() on the
    // whole string. "abcDEF" must become "AbcDEF", not "ABCDEF".
    assert.equal(
      capitalizeName("abcDEF"),
      "AbcDEF",
      "only s[0] may be uppercased; s[1..] is preserved verbatim",
    );
  });

  it("mixed case input: first letter uppercased, rest preserved: 'cOdEr' -> 'COdEr'", () => {
    // This is the strongest "rest untouched" check. A correct
    // implementation must not modify the existing mixed case of the tail.
    // Note the 'O' in position 1 is preserved (it was already upper).
    assert.equal(
      capitalizeName("cOdEr"),
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
      capitalizeName("the coder"),
      "The coder",
      "only the first character of the WHOLE string is changed",
    );
  });
});

// ---------------------------------------------------------------------------
// getAgentColor — deterministic, pure, well-spread, 5-color domain
// ---------------------------------------------------------------------------
//
// The contract is two-fold:
//   1. The output must be one of the 5 documented palette keys.
//   2. The output must be a pure function of the input (deterministic,
//      no wall-clock time, no PRNG, no process state).
//
// These two properties are what we test. We do NOT pin a specific input
// → color mapping, because the spec leaves the hashing strategy to the
// implementer. We DO assert that 100 distinct inputs produce at least 4
// distinct outputs, to catch implementations that collapse the entire
// palette down to 1–2 colors (which would be visually useless).

describe("getAgentColor", () => {
  it("return value is one of the five palette keys (table-driven, 20 names)", () => {
    // A representative sample of plausible agent names. The test only
    // cares that every output is in the documented domain — not which
    // specific color any particular name gets.
    const names: string[] = [
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
      const color = getAgentColor(name);
      assert.ok(
        PALETTE_SET.has(color as PaletteKey),
        `getAgentColor(${JSON.stringify(name)}) must be one of ${JSON.stringify(
          PALETTE_KEYS,
        )}; got: ${JSON.stringify(color)}`,
      );
    }
  });

  it("is deterministic: same input returns same output across 1000 calls", () => {
    // Sanity: a pure function called 1000 times with the same input must
    // return the same output 1000 times. We compare against the FIRST
    // call, so the assertion is robust to any correct implementation
    // (we don't pin a specific color, only equality across calls).
    const name = "coder";
    const expected = getAgentColor(name);

    for (let i = 0; i < 1000; i++) {
      assert.equal(
        getAgentColor(name),
        expected,
        `getAgentColor(${JSON.stringify(name)}) must be deterministic on call #${i + 1}`,
      );
    }
  });

  it("is pure: result is identical across two calls separated by a short delay", async () => {
    // Catch implementations that accidentally use wall-clock time
    // (e.g. Date.now() as a hash seed) or a non-seeded PRNG
    // (e.g. Math.random() to pick a color). Both would produce
    // different outputs across time.
    //
    // We sleep for 5ms (well below the millisecond-resolution noise
    // floor) and re-call. A correct implementation must produce the
    // exact same value.
    const name = "coder";
    const before = getAgentColor(name);

    await new Promise<void>((resolve) => setTimeout(resolve, 5));

    const after = getAgentColor(name);

    assert.equal(
      after,
      before,
      `getAgentColor(${JSON.stringify(name)}) must not depend on wall-clock time; ` +
        `before=${JSON.stringify(before)}, after=${JSON.stringify(after)}`,
    );
  });

  it("spreads 100 distinct names across at least 4 distinct colors", () => {
    // Acceptance criterion: "for 100 distinct, realistic agent names, at
    // least 4 distinct colors are returned." An implementation that
    // collapses the palette to 1–2 colors is functionally useless (the
    // whole point of the helper is visual distinguishability), so we
    // explicitly forbid that.
    const names: string[] = Array.from({ length: 100 }, (_, i) => `agent-${i}`);

    const uniqueColors = new Set<string>(names.map(getAgentColor));

    assert.ok(
      uniqueColors.size >= 4,
      `100 distinct names must spread across >= 4 colors; got ${uniqueColors.size}: ` +
        JSON.stringify([...uniqueColors]),
    );
  });

  it("domain keys are exactly the documented five (subset check over 100 names)", () => {
    // The output type is the 5 documented palette keys, full stop. We
    // assert the SUBSET relationship: every output must be one of the 5
    // documented keys. (We intentionally do not assert equality between
    // the output set and the palette set — the spec does not require all
    // 5 colors to be hit by any particular input set.)
    const names: string[] = Array.from({ length: 100 }, (_, i) => `agent-${i}`);

    for (const name of names) {
      const color = getAgentColor(name);
      assert.ok(
        PALETTE_SET.has(color as PaletteKey),
        `getAgentColor(${JSON.stringify(name)}) must be a documented palette key; ` +
          `got: ${JSON.stringify(color)}`,
      );
    }
  });

  it("known input maps to a value in the documented domain: 'coder' returns a palette key", () => {
    // We do NOT pin a specific color for "coder" because the spec leaves
    // the hashing strategy to the implementer. What we DO pin is the
    // contract: the return value must be a string AND must be one of the
    // five documented palette keys. This is a focused, single-input
    // sanity check that complements the table-driven test above.
    const result = getAgentColor("coder");

    assert.equal(typeof result, "string", "getAgentColor must return a string");
    assert.ok(
      PALETTE_SET.has(result as PaletteKey),
      `getAgentColor('coder') must be a documented palette key; got: ${JSON.stringify(result)}`,
    );
  });
});
