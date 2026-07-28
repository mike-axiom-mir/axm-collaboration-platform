import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  compileStyleIntent,
  createSkinInstance,
  resolveSkinForGame,
  setInstanceOverride
} from "../src/index.mjs";

const contract = JSON.parse(
  await readFile(new URL("../examples/contracts/orb-arena.game-skin-contract.json", import.meta.url))
);

function pack() {
  return compileStyleIntent({
    type: "axm.style-intent",
    version: "1.0",
    name: "Resolver Test",
    seed: "resolver-1",
    scope: ["global"],
    keywords: ["neon", "metallic"],
    intensity: 0.8,
    accessibility: {}
  });
}

test("resolver emits only presentation authority", async () => {
  const result = await resolveSkinForGame({ packs: [pack()], gameContract: contract });
  assert.equal(result.ok, true);
  assert.equal(result.resolved.presentationAuthority, "ZERO_AUTHORITATIVE_WRITES");
  assert(result.receipt.summary.applied >= 4);
});

test("unsupported properties are named and omitted", async () => {
  const skin = pack();
  skin.materials["world.base"].iridescence = 0.8;
  const result = await resolveSkinForGame({ packs: [skin], gameContract: contract });
  assert.equal(result.ok, true);
  assert(
    result.receipt.unsupported.some(
      (entry) => entry.slot === "world.background" && entry.property === "iridescence"
    )
  );
  assert.equal("iridescence" in result.resolved.slots["world.background"].material, false);
});

test("missing bindings retain the game fallback", async () => {
  const skin = pack();
  skin.bindings = skin.bindings.filter((binding) => binding.target !== "ui.panel");
  const result = await resolveSkinForGame({ packs: [skin], gameContract: contract });
  assert(
    result.receipt.inherited.some(
      (entry) => entry.slot === "ui.panel" && entry.reason === "no skin binding"
    )
  );
});

test("character instance override does not mutate the pack", async () => {
  const skin = pack();
  const original = skin.materials["character.player"].glowIntensity;
  let instance = createSkinInstance(skin);
  instance = setInstanceOverride(
    instance,
    ["materials", "character.player", "glowIntensity"],
    0.05
  );
  const result = await resolveSkinForGame({
    packs: [skin],
    gameContract: contract,
    instance
  });
  assert.equal(result.resolved.slots["character.player.body"].material.glowIntensity, 0.05);
  assert.equal(skin.materials["character.player"].glowIntensity, original);
});

test("invalid pack is rejected before resolution", async () => {
  const skin = pack();
  skin.permissions = ["write-gameplay"];
  const result = await resolveSkinForGame({ packs: [skin], gameContract: contract });
  assert.equal(result.ok, false);
  assert.equal(result.status, "REJECTED");
});
