import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertPassName,
  assertEnvKey,
  redactSecret,
  listPassEntries,
} from "../lib/secret.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("secret guards", () => {
  it("requires allowPrefixes", () => {
    assert.throws(() => assertPassName("a/b", []), /allowPrefixes/);
  });
  it("allows prefixed entry", () => {
    assert.equal(assertPassName("Work/token", ["Work"]), "Work/token");
  });
  it("rejects outside prefix", () => {
    assert.throws(() => assertPassName("Other/x", ["Work"]), /not under/);
  });
  it("redacts by default", () => {
    assert.match(redactSecret("abcdefghij", false), /len=10/);
    assert.equal(redactSecret("abcdefghij", true), "abcdefghij");
  });
  it("validates env keys", () => {
    assert.equal(assertEnvKey("OPENROUTER_API_KEY"), "OPENROUTER_API_KEY");
    assert.throws(() => assertEnvKey("PATH"), /refusing/);
    assert.throws(() => assertEnvKey("bad-key"), /invalid/);
  });
  it("lists only allowlisted gpg entries", () => {
    const dir = mkdtempSync(join(tmpdir(), "dsh-secret-"));
    const prev = process.env.PASSWORD_STORE_DIR;
    try {
      process.env.PASSWORD_STORE_DIR = dir;
      mkdirSync(join(dir, "dsh"), { recursive: true });
      mkdirSync(join(dir, "other"), { recursive: true });
      writeFileSync(join(dir, "dsh", "openrouter.gpg"), "x");
      writeFileSync(join(dir, "other", "secret.gpg"), "x");
      const list = listPassEntries(["dsh"]);
      assert.deepEqual(list, ["dsh/openrouter"]);
    } finally {
      if (prev === undefined) delete process.env.PASSWORD_STORE_DIR;
      else process.env.PASSWORD_STORE_DIR = prev;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
