import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPreskin,
  compileStyleIntent,
  composeSkinStack,
  stableStringify,
  validateSkinPack
} from "../src/index.mjs";

function pack(id) {
  return compileStyleIntent(
    applyPreskin(
      {
        name: id,
        seed: `stack-${id}`,
        scope: ["global"],
        sharing: { attribution: "Test" }
      },
      id
    )
  );
}

test("four scoped packs compose into one valid deterministic pack", () => {
  const layers = [
    { id: "world", scope: "world", pack: pack("world-oceanic-glass") },
    { id: "character", scope: "character.player", pack: pack("character-comic-vanguard") },
    { id: "interface", scope: "ui", pack: pack("axm-balanced") },
    { id: "effects", scope: "fx", pack: pack("arcade-neon-circuit") }
  ];
  const first = composeSkinStack(layers, { name: "Four Organs", seed: "four" });
  const second = composeSkinStack(layers, { name: "Four Organs", seed: "four" });
  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(validateSkinPack(first).ok, true);
  assert.equal(first.bindings.length, 20);
});

test("character materials cannot overwrite world materials by shared source ids", () => {
  const world = pack("world-ember-foundry");
  const character = pack("character-soft-hero");
  const output = composeSkinStack([
    { id: "world", scope: "world", pack: world },
    { id: "character", scope: "character.player", pack: character }
  ]);
  const worldBinding = output.bindings.find((entry) => entry.target === "world.background");
  const characterBinding = output.bindings.find(
    (entry) => entry.target === "character.player.body"
  );
  assert.notEqual(worldBinding.material, characterBinding.material);
  assert.equal(
    output.materials[worldBinding.material].baseColor,
    world.materials["world.base"].baseColor
  );
  assert.equal(
    output.materials[characterBinding.material].baseColor,
    character.materials["character.player"].baseColor
  );
});

test("later layers override only the same semantic target", () => {
  const first = pack("character-soft-hero");
  const second = pack("character-street-tech-rogue");
  const output = composeSkinStack([
    { id: "first", scope: "character.player", pack: first },
    { id: "second", scope: "character.player", pack: second }
  ]);
  const binding = output.bindings.find((entry) => entry.target === "character.player.body");
  assert(binding.material.startsWith("second."));
  assert.equal(output.bindings.length, 3);
});

test("seven high-level organs isolate all 33 game-skin surfaces", () => {
  const source = pack("axm-balanced");
  const layers = [
    { scope: "world", pack: source },
    { scope: "objects", pack: source },
    { scope: "gear", pack: source },
    { scope: "items", pack: source },
    { scope: "characters", pack: source },
    { scope: "effects", pack: source },
    { scope: "interface", pack: source }
  ];
  const output = composeSkinStack(layers, { name: "Seven Organs" });
  assert.equal(output.bindings.length, 33);
  assert.equal(new Set(output.bindings.map((binding) => binding.target)).size, 33);
  assert.equal(validateSkinPack(output).ok, true);
});

test("disabled layers are inert", () => {
  const output = composeSkinStack([
    { id: "world", scope: "world", pack: pack("world-cosmic-deep") },
    { id: "fx", scope: "fx", pack: pack("arcade-neon-circuit"), enabled: false }
  ]);
  assert.equal(output.bindings.some((entry) => entry.target === "fx.primary"), false);
});

test("stack accessibility preserves strict requests without hiding false guarantees", () => {
  const first = pack("clarity-accessible-night");
  first.accessibility.minimumTextContrast = 7;
  first.accessibility.reducedMotionSafe = true;
  const second = pack("arcade-neon-circuit");
  second.accessibility.minimumTextContrast = 3;
  second.accessibility.reducedMotionSafe = false;
  second.accessibility.preserveGameplayCues = false;
  second.accessibility.colorIsNotOnlySignal = false;

  const output = composeSkinStack([
    { id: "safe", scope: "world", pack: first },
    { id: "later", scope: "effects", pack: second }
  ]);

  assert.equal(output.accessibility.minimumTextContrast, 7);
  assert.equal(output.accessibility.reducedMotionSafe, true);
  assert.equal(output.accessibility.preserveGameplayCues, false);
  assert.equal(output.accessibility.colorIsNotOnlySignal, false);
});

test("stack lineage retains source integrity and asset hashes", () => {
  const source = pack("axm-balanced");
  source.integrity = { contentSha256: "a".repeat(64) };
  source.assets["asset.audit"] = { sha256: "b".repeat(64) };
  const output = composeSkinStack([{ id: "source", scope: "world", pack: source }]);
  assert.equal(output.provenance.sourceLayers[0].integrity, "a".repeat(64));
  assert.deepEqual(output.provenance.sourceAssetHashes, ["b".repeat(64)]);
});

test("empty, malformed, and unknown-scope stacks fail closed", () => {
  assert.throws(() => composeSkinStack([]), /at least one enabled layer/);
  assert.throws(
    () => composeSkinStack([{ scope: "world", pack: {} }]),
    /does not contain an AXM skin pack/
  );
  assert.throws(
    () => composeSkinStack([{ scope: "gameplay", pack: pack("axm-balanced") }]),
    /unknown scope/
  );
});

test("stack capabilities are derived from final scoped targets", () => {
  const output = composeSkinStack([
    { id: "world", scope: "world", pack: pack("axm-balanced") }
  ]);
  assert(output.capabilities.includes("environment-surfaces.v1"));
  assert(output.capabilities.includes("lighting-profile.v1"));
  assert(output.capabilities.includes("skin-stack.v1"));
  assert.equal(output.capabilities.includes("character-parts.v1"), false);
  assert.equal(output.capabilities.includes("ui-theme.v1"), false);
  assert.equal(output.capabilities.includes("vehicle-presentation.v1"), false);
  assert.equal(output.capabilities.includes("equipment-presentation.v1"), false);
  assert.equal(output.capabilities.includes("item-presentation.v1"), false);
});

test("duplicate layer labels receive distinct namespaces without cross-scope writes", () => {
  function sharedMaterial(source, target, baseColor) {
    const binding = source.bindings.find((entry) => entry.target === target);
    source.materials.shared = {
      ...source.materials[binding.material],
      baseColor
    };
    binding.material = "shared";
    assert.equal(validateSkinPack(source).ok, true);
    return source;
  }

  const world = sharedMaterial(
    pack("world-ember-foundry"),
    "world.background",
    "#ff0000"
  );
  const effects = sharedMaterial(
    pack("arcade-neon-circuit"),
    "fx.primary",
    "#0000ff"
  );
  const output = composeSkinStack([
    { id: "same", scope: "world", pack: world },
    { id: "same", scope: "fx", pack: effects }
  ]);
  const worldBinding = output.bindings.find(
    (entry) => entry.target === "world.background"
  );
  const effectBinding = output.bindings.find(
    (entry) => entry.target === "fx.primary"
  );

  assert.notEqual(worldBinding.material, effectBinding.material);
  assert.equal(output.materials[worldBinding.material].baseColor, "#ff0000");
  assert.equal(output.materials[effectBinding.material].baseColor, "#0000ff");
  assert.deepEqual(
    output.provenance.sourceLayers.map((layer) => layer.id),
    ["same", "same-2"]
  );
  assert.equal(validateSkinPack(output).ok, true);
});

test("maximum-length source IDs remain collision-safe after namespacing", () => {
  const source = pack("axm-balanced");
  const prefix = `m${"a".repeat(124)}`;
  const firstId = `${prefix}01`;
  const secondId = `${prefix}02`;
  source.materials[firstId] = {
    ...source.materials["world.base"],
    baseColor: "#ff0000"
  };
  source.materials[secondId] = {
    ...source.materials["world.terrain"],
    baseColor: "#0000ff"
  };
  source.bindings.find(
    (entry) => entry.target === "world.background"
  ).material = firstId;
  source.bindings.find(
    (entry) => entry.target === "world.terrain"
  ).material = secondId;
  assert.equal(validateSkinPack(source).ok, true);

  const output = composeSkinStack([{ id: "x", scope: "world", pack: source }]);
  const background = output.bindings.find(
    (entry) => entry.target === "world.background"
  );
  const terrain = output.bindings.find(
    (entry) => entry.target === "world.terrain"
  );
  assert.notEqual(background.material, terrain.material);
  assert(background.material.length <= 127);
  assert(terrain.material.length <= 127);
  assert.equal(output.materials[background.material].baseColor, "#ff0000");
  assert.equal(output.materials[terrain.material].baseColor, "#0000ff");
  assert.equal(validateSkinPack(output).ok, true);
});
