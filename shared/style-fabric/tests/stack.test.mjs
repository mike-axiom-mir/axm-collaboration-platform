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
