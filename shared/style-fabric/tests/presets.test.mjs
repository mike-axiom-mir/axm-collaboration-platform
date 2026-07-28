import test from "node:test";
import assert from "node:assert/strict";
import {
  PRESKIN_FAMILIES,
  PRESKINS,
  applyPreskin,
  blendPreskins,
  chooseDeterministicPreskin,
  compileStyleIntent,
  createHarmonyPalette,
  getPreskin,
  listPreskins,
  stableStringify,
  validateSkinPack
} from "../src/index.mjs";

const base = {
  type: "axm.style-intent",
  version: "1.0",
  name: "Base",
  seed: "preskin-test-seed",
  scope: ["character.player"],
  keywords: ["dark"],
  intensity: 0.5,
  sharing: {
    license: "LicenseRef-Test",
    remixAllowed: true,
    attribution: "Test Creator"
  }
};

test("catalog exposes 25 unique editable preskins across six families", () => {
  assert.equal(PRESKINS.length, 25);
  assert.equal(new Set(PRESKINS.map((preset) => preset.id)).size, PRESKINS.length);
  assert.deepEqual(new Set(PRESKINS.map((preset) => preset.family)), new Set(PRESKIN_FAMILIES));
  assert(PRESKINS.every((preset) => preset.swatches.length === 3));
});

test("catalog reads return clones instead of mutable shared definitions", () => {
  const first = listPreskins();
  first[0].name = "Mutated";
  assert.notEqual(getPreskin(PRESKINS[0].id).name, "Mutated");
});

test("applying a preskin preserves user authority fields", () => {
  const result = applyPreskin(base, "axm-balanced");
  assert.equal(result.seed, base.seed);
  assert.deepEqual(result.scope, base.scope);
  assert.deepEqual(result.sharing, base.sharing);
  assert.equal(result.preset.primary, "axm-balanced");
});

test("preskin fusion is deterministic and records both sources", () => {
  const first = blendPreskins(base, "axm-balanced", "world-ember-foundry", 0.37);
  const second = blendPreskins(base, "axm-balanced", "world-ember-foundry", 0.37);
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(first.preset.primary, "axm-balanced");
  assert.equal(first.preset.secondary, "world-ember-foundry");
  assert.equal(first.preset.blend, 0.37);
});

test("preskin fusion endpoints retain endpoint palettes", () => {
  const primary = getPreskin("arcade-neon-circuit");
  const secondary = getPreskin("clarity-clean-day");
  assert.deepEqual(
    blendPreskins(base, primary.id, secondary.id, 0).palette,
    primary.intent.palette
  );
  assert.deepEqual(
    blendPreskins(base, primary.id, secondary.id, 1).palette,
    secondary.intent.palette
  );
});

test("surprise choice is stable for the same seed and family", () => {
  const first = chooseDeterministicPreskin("stable-surprise", "Worlds");
  const second = chooseDeterministicPreskin("stable-surprise", "Worlds");
  assert.equal(first.id, second.id);
  assert.equal(first.family, "Worlds");
});

test("every built-in preskin compiles into a valid presentation-only pack", () => {
  for (const preset of PRESKINS) {
    const pack = compileStyleIntent(applyPreskin(base, preset.id));
    const report = validateSkinPack(pack);
    assert.equal(report.ok, true, `${preset.id}: ${stableStringify(report.errors)}`);
    assert.equal(pack.release, "0.5.0");
    assert.equal(pack.provenance.compiler, "axm.style-recipe.v5");
  }
});

test("palette harmonies are deterministic six-digit colors", () => {
  for (const harmony of [
    "complementary",
    "analogous",
    "triadic",
    "split-complementary",
    "monochrome"
  ]) {
    const first = createHarmonyPalette("#38e8ff", harmony);
    const second = createHarmonyPalette("#38e8ff", harmony);
    assert.deepEqual(first, second);
    assert(Object.values(first).every((color) => /^#[0-9a-f]{6}$/.test(color)));
  }
});

test("unknown preskin requests fail closed", () => {
  assert.throws(() => applyPreskin(base, "not-a-preskin"), /Unknown preskin/);
  assert.throws(
    () => chooseDeterministicPreskin("seed", "Missing family"),
    /No preskins exist/
  );
});
