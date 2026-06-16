import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractErrorMessage } from "../../../server/helpers/error.helpers";
import { UNKNOWN } from "../../../server/enums";

describe("extractErrorMessage", () => {
  it("returns UNKNOWN for null", () => {
    assert.equal(extractErrorMessage(null), UNKNOWN);
  });

  it("returns UNKNOWN for undefined", () => {
    assert.equal(extractErrorMessage(undefined), UNKNOWN);
  });

  it("extracts message from object with message property", () => {
    assert.equal(
      extractErrorMessage({ message: "something went wrong" }),
      "something went wrong",
    );
  });

  it("returns JSON string for object without message", () => {
    assert.equal(
      extractErrorMessage({ foo: "bar" }),
      JSON.stringify({ foo: "bar" }),
    );
  });

  it("returns JSON string for a number", () => {
    assert.equal(extractErrorMessage(42), JSON.stringify(42));
  });

  it("returns JSON string for a plain string", () => {
    assert.equal(extractErrorMessage("error"), JSON.stringify("error"));
  });
});
