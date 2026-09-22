import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertPassName, redactSecret } from "../lib/secret.js";

describe("secret guards", () => {
  it("requires allowPrefixes", () => {
    assert.throws(() => assertPassName("a/b", []), /allowPrefixes/);
  });
  it("allows prefixed entry", () => {
    assert.equal(assertPassName("Work/token", ["Work"]), "Work/token");
  });
  it("redacts by default", () => {
    assert.match(redactSecret("abcdefghij", false), /len=10/);
    assert.equal(redactSecret("abcdefghij", true), "abcdefghij");
  });
});
