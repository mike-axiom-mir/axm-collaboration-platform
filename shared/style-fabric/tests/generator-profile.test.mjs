import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPerformanceProfile,
  compileStyleIntent,
  generateStyleIntent,
  getSkinMold,
  listGeneratorMoods,
  listPerformanceProfiles,
  stableStringify,
  validateSkinPack
} from "../src/index.mjs";

test("mold maker is deterministic for the same visible inputs", () => {
  const options = {
    seed: "same-seed",
    name: "Same Style",
    moldId: "full-presentation",
    mood: "wonder",
    complexity: 0.73
  };
  assert.equal(
    stableStringify(generateStyleIntent(options)),
    stableStringify(generateStyleIntent(options))
  );
});

test("mold maker exposes bounded moods and compiles valid packs", () => {
  assert.deepEqual(listGeneratorMoods(), [
    "balanced",
    "wonder",
    "playful",
    "grounded",
    "dramatic",
    "luxurious"
  ]);
  for (const mood of listGeneratorMoods()) {
    const pack = compileStyleIntent(
      generateStyleIntent({
        seed: `mood-${mood}`,
        name: mood,
        moldId: "universal-core",
        mood,
        complexity: 0.65
      })
    );
    assert.equal(validateSkinPack(pack).ok, true, mood);
  }
});

test("mold-grown packs contain exactly the mold surfaces and only referenced materials", () => {
  for (const moldId of ["universal-core", "effects-stage", "arcade-arena", "full-presentation"]) {
    const mold = getSkinMold(moldId);
    const pack = compileStyleIntent(
      generateStyleIntent({
        seed: `scope-${moldId}`,
        name: `Scoped ${moldId}`,
        moldId,
        mood: "balanced",
        complexity: 0.5
      })
    );
    assert.deepEqual(
      pack.bindings.map((binding) => binding.target).sort(),
      [...mold.slots].sort(),
      moldId
    );
    assert.deepEqual(
      Object.keys(pack.materials).sort(),
      [...new Set(pack.bindings.map((binding) => binding.material))].sort(),
      `${moldId} carries no unused material organs`
    );
  }
});

test("generated capabilities describe only content that is actually present", () => {
  const effects = compileStyleIntent(
    generateStyleIntent({
      seed: "effects-capabilities",
      name: "Effects Only",
      moldId: "effects-stage",
      mood: "wonder",
      complexity: 0.7
    })
  );
  assert(effects.capabilities.includes("fx-preset.v1"));
  assert.equal(effects.capabilities.includes("character-parts.v1"), false);
  assert.equal(effects.capabilities.includes("ui-theme.v1"), false);
  assert.equal(effects.capabilities.includes("vehicle-presentation.v1"), false);
  assert.deepEqual(effects.characterBlueprints, {});
});

test("different seeds create different deterministic recipes", () => {
  const base = { name: "Seed", moldId: "arcade-arena", mood: "balanced" };
  assert.notEqual(
    stableStringify(generateStyleIntent({ ...base, seed: "a" })),
    stableStringify(generateStyleIntent({ ...base, seed: "b" }))
  );
});

test("all performance profiles preserve structural validity", () => {
  const source = compileStyleIntent(
    generateStyleIntent({
      seed: "profile-source",
      name: "Profile Source",
      moldId: "full-presentation",
      mood: "wonder",
      complexity: 1
    })
  );
  for (const profile of listPerformanceProfiles()) {
    const result = applyPerformanceProfile(source, profile.id);
    assert.equal(validateSkinPack(result.pack).ok, true, profile.id);
    assert.equal(result.pack.provenance.performanceProfile, profile.id);
  }
});

test("legacy and reduced-motion profiles stop material animation", () => {
  const source = compileStyleIntent(
    generateStyleIntent({
      seed: "motion-source",
      name: "Motion Source",
      moldId: "effects-stage",
      mood: "dramatic",
      complexity: 1
    })
  );
  for (const profile of ["legacy", "reduced-motion"]) {
    const result = applyPerformanceProfile(source, profile);
    for (const material of Object.values(result.pack.materials)) {
      assert.equal(material.pulseSpeed, 0);
      assert.equal(material.shimmerSpeed, 0);
    }
    assert.equal(result.pack.tokens.motion.pulseSpeed, 0);
    assert.equal(result.pack.tokens.motion.shimmerSpeed, 0);
  }
});

test("unknown generator and performance choices fail closed", () => {
  assert.throws(
    () => generateStyleIntent({ seed: "x", mood: "missing", moldId: "universal-core" }),
    /Unknown generator mood/
  );
  assert.throws(
    () => applyPerformanceProfile({ materials: {} }, "missing"),
    /Unknown performance profile/
  );
});
