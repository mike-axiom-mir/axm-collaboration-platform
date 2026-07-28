import test from "node:test";
import assert from "node:assert/strict";
import {
  compileStyleIntent,
  parseStylePhrase,
  sha256Hex,
  stableStringify,
  validateSkinPack
} from "../src/index.mjs";

const intent = {
  type: "axm.style-intent",
  version: "1.0",
  name: "Test Style",
  seed: "fixed-seed",
  scope: ["global"],
  keywords: ["dark", "neon", "paper"],
  intensity: 0.7,
  accessibility: { highContrast: true, reducedMotion: false }
};

test("same structured intent is canonical and deterministic", () => {
  const first = compileStyleIntent(intent);
  const second = compileStyleIntent(structuredClone(intent));
  assert.equal(stableStringify(first), stableStringify(second));
});

test("a different seed creates a recorded variation", () => {
  const first = compileStyleIntent(intent);
  const second = compileStyleIntent({ ...intent, seed: "different-seed" });
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.materials["character.player"].baseColor, second.materials["character.player"].baseColor);
});

test("phrase grammar reports unknown words instead of guessing them", () => {
  const parsed = parseStylePhrase("dark neon banana mysticism reduced motion", intent);
  assert.deepEqual(parsed.intent.keywords, ["dark", "neon"]);
  assert(parsed.unrecognized.includes("banana"));
  assert(parsed.unrecognized.includes("mysticism"));
  assert.equal(parsed.intent.accessibility.reducedMotion, true);
});

test("compiler output validates under local policy", () => {
  const report = validateSkinPack(compileStyleIntent(intent));
  assert.equal(report.ok, true, stableStringify(report.errors, 2));
});

test("reduced motion removes recipe motion", () => {
  const pack = compileStyleIntent({
    ...intent,
    accessibility: { highContrast: false, reducedMotion: true }
  });
  assert.equal(pack.tokens.motion.pulseSpeed, 0);
  assert.equal(pack.tokens.motion.shimmerSpeed, 0);
});

test("scope normalization is unique and unknown scopes fail closed", () => {
  const pack = compileStyleIntent({
    ...intent,
    scope: ["world", "world", "interface"]
  });
  assert.deepEqual(pack.scopes, ["world", "interface"]);
  assert.equal(validateSkinPack(pack).ok, true);
  assert.throws(
    () => compileStyleIntent({ ...intent, scope: ["gameplay"] }),
    /Unknown style scope/
  );
});

test("direct compiler mold metadata fails closed and cannot escape declared scope", () => {
  assert.throws(
    () =>
      compileStyleIntent({
        ...intent,
        scope: ["effects"],
        generator: { moldId: "does-not-exist" }
      }),
    /Unknown skin mold/
  );
  assert.throws(
    () =>
      compileStyleIntent({
        ...intent,
        scope: ["world"],
        generator: { moldId: "effects-stage" }
      }),
    /outside the declared scope/
  );
});

test("changed scoped compiler records the v6 compiler identity", () => {
  assert.equal(compileStyleIntent(intent).provenance.compiler, "axm.style-recipe.v6");
});

test("SHA-256 implementation matches the standard abc vector", async () => {
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
});
