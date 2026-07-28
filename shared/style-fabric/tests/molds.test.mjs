import test from "node:test";
import assert from "node:assert/strict";
import {
  SKIN_MOLDS,
  applyPreskin,
  assessMoldCompatibility,
  compileStyleIntent,
  createGameContractFromMold,
  gameSurfaceCoverage,
  getSkinMold,
  listGameSurfaceCategories,
  listGameSurfaceSlots,
  listSkinMolds,
  remapPackBindings,
  validateGameSkinContract
} from "../src/index.mjs";

const base = {
  name: "Mold Test",
  seed: "mold-test",
  scope: ["global"],
  sharing: { attribution: "Test" }
};

test("sixteen semantic molds are unique and clone-safe", () => {
  assert.equal(SKIN_MOLDS.length, 16);
  assert.equal(new Set(SKIN_MOLDS.map((mold) => mold.id)).size, 16);
  const list = listSkinMolds();
  list[0].name = "Changed";
  assert.notEqual(getSkinMold(list[0].id).name, "Changed");
});

test("the full game-surface catalog has seven organs and 33 portable slots", () => {
  const categories = listGameSurfaceCategories();
  const slots = listGameSurfaceSlots();
  assert.equal(categories.length, 7);
  assert.equal(slots.length, 33);
  assert.equal(new Set(categories.flatMap((category) => category.slots)).size, 33);
  assert(slots.some((slot) => slot.id === "vehicle.body"));
  assert(slots.some((slot) => slot.id === "ui.cursor"));
  assert(slots.some((slot) => slot.id === "character.player.face"));
});

test("every mold produces a valid game contract", () => {
  for (const mold of SKIN_MOLDS) {
    const contract = createGameContractFromMold({
      moldId: mold.id,
      gameId: `test.${mold.id}`,
      gameVersion: "1.0.0"
    });
    assert.equal(validateGameSkinContract(contract).ok, true, mold.id);
  }
});

test("unknown molds fail closed", () => {
  assert.throws(
    () => createGameContractFromMold({ moldId: "missing", gameId: "test" }),
    /Unknown skin mold/
  );
});

test("mold compatibility reports exact semantic coverage without writes", () => {
  const pack = compileStyleIntent(applyPreskin(base, "axm-balanced"));
  const contract = createGameContractFromMold({
    moldId: "arcade-arena",
    gameId: "test.arena",
    gameVersion: "1.0.0"
  });
  const report = assessMoldCompatibility(pack, contract, "arcade-arena");
  assert.equal(report.compatibility, "PARTIAL");
  assert.equal(report.summary.connected, 13);
  assert.equal(report.automaticWrites, 0);
  assert(report.rows.some((row) => row.status === "PARTIAL"));
});

test("coverage reports expose every game-skin organ without changing a game", () => {
  const pack = compileStyleIntent(applyPreskin(base, "axm-balanced"));
  const contract = createGameContractFromMold({
    moldId: "full-presentation",
    gameId: "test.full",
    gameVersion: "1.0.0"
  });
  const report = gameSurfaceCoverage(pack, contract);
  assert.equal(report.categories.length, 7);
  assert.deepEqual(report.summary, { connected: 33, total: 33, percent: 100 });
  assert.equal(report.automaticWrites, 0);
});

test("semanticRole aliases are inspected but never silently rewritten", () => {
  const pack = compileStyleIntent(applyPreskin(base, "axm-balanced"));
  const contract = createGameContractFromMold({
    moldId: "playable-character",
    gameId: "test.hero",
    gameVersion: "1.0.0"
  });
  contract.slots[0].id = "hero.visual.body";
  const report = assessMoldCompatibility(pack, contract, "playable-character");
  assert.equal(report.rows[0].gameSlot, "hero.visual.body");
  assert.equal(report.rows[0].packDeclaresBinding, true);
  assert.equal(pack.bindings.some((binding) => binding.target === "hero.visual.body"), false);
});

test("binding remaps require an explicit map and retain an audit declaration", () => {
  const pack = compileStyleIntent(applyPreskin(base, "character-soft-hero"));
  const remapped = remapPackBindings(pack, {
    "character.player.body": "hero.visual.body"
  });
  assert(remapped.bindings.some((binding) => binding.target === "hero.visual.body"));
  assert.equal(remapped.provenance.bindingMode, "EXPLICIT_ONLY");
  assert.equal(remapped.integrity, null);
});
