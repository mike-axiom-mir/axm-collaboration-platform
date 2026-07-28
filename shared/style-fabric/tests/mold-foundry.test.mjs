import test from "node:test";
import assert from "node:assert/strict";
import {
  assessMoldCompatibility,
  compileStyleIntent,
  createGameContractFromMold,
  forgeSkinMold,
  growSkinMold,
  validateGameSkinContract,
  validateSkinMold
} from "../src/index.mjs";

test("the mold foundry creates an explicit reusable semantic mold", () => {
  const { mold, receipt } = forgeSkinMold({
    id: "paper-light-stage",
    name: "Paper Light Stage",
    purpose: "World lighting, ambient effects, and interface panels.",
    slots: ["world.lighting", "world.postfx", "fx.ambient", "ui.panel"]
  });
  assert.equal(validateSkinMold(mold).ok, true);
  assert.deepEqual(mold.recommendedScopes, ["world", "effects", "interface"]);
  assert.equal(receipt.promotion, "DRAFT_REVIEW_REQUIRED");
  assert.equal(receipt.automaticGameWrites, 0);

  const contract = createGameContractFromMold({
    mold,
    gameId: "test.custom-mold",
    gameVersion: "0.6.0"
  });
  assert.equal(validateGameSkinContract(contract).ok, true);
  assert.deepEqual(
    contract.slots.map((slot) => slot.id),
    mold.slots
  );
});

test("mold growth is explicit, deterministic, and retains a receipt", () => {
  const options = {
    id: "core-with-effects",
    addOrgans: ["effects"],
    addSlots: ["world.lighting"],
    removeSlots: ["ui.panel"]
  };
  const first = growSkinMold("universal-core", options);
  const second = growSkinMold("universal-core", options);
  assert.deepEqual(first, second);
  assert(first.mold.slots.includes("fx.primary"));
  assert(first.mold.slots.includes("world.lighting"));
  assert.equal(first.mold.slots.includes("ui.panel"), false);
  assert.equal(first.receipt.parentMoldId, "universal-core");
  assert.equal(first.receipt.automaticGameWrites, 0);
});

test("custom molds work with the ordinary compatibility assessor", () => {
  const { mold } = forgeSkinMold({
    id: "tiny-world",
    name: "Tiny World",
    purpose: "Two world surfaces.",
    slots: ["world.background", "world.lighting"]
  });
  const pack = compileStyleIntent({
    name: "Full Test",
    seed: "full-test",
    scope: ["global"],
    sharing: { attribution: "Test" }
  });
  const contract = createGameContractFromMold({
    mold,
    gameId: "test.tiny-world",
    gameVersion: "0.6.0"
  });
  const report = assessMoldCompatibility(pack, contract, mold);
  assert.equal(report.summary.connected, 2);
  assert.equal(report.summary.total, 2);
  assert.equal(report.automaticWrites, 0);
});

test("mold foundry rejects unknown surfaces, empty results, and silent fields", () => {
  assert.throws(
    () =>
      forgeSkinMold({
        id: "bad-mold",
        name: "Bad",
        purpose: "Unknown surface",
        slots: ["gameplay.damage"]
      }),
    /unknown semantic surface/
  );
  assert.throws(
    () => growSkinMold("universal-core", { id: "empty-mold", removeSlots: [
      "world.background",
      "ui.panel",
      "character.player.body"
    ] }),
    /at least one semantic surface/
  );
  assert.equal(
    validateSkinMold({
      id: "bad-extra",
      name: "Bad",
      purpose: "Extra field",
      slots: ["world.background"],
      recommendedScopes: ["world"],
      autoPromote: true
    }).ok,
    false
  );
});

test("custom mold validation rejects inherited slot names and unsafe scope data", () => {
  for (const slot of ["__proto__", "constructor", "toString"]) {
    const mold = {
      id: `unsafe-${slot.replaceAll("_", "x").toLowerCase()}`,
      name: "Unsafe Slot",
      purpose: "Inherited Object prototype slot probe.",
      slots: [slot],
      recommendedScopes: ["world"]
    };
    assert.equal(validateSkinMold(mold).ok, false, slot);
    assert.throws(
      () => createGameContractFromMold({ mold, gameId: "test.unsafe-slot" }),
      /Invalid skin mold/,
      slot
    );
  }

  assert.equal(
    validateSkinMold({
      id: "unsafe-scope-type",
      name: "Unsafe Scope Type",
      purpose: "Non-string recommended scope probe.",
      slots: ["fx.primary"],
      recommendedScopes: [{}]
    }).ok,
    false
  );
  assert.equal(
    validateSkinMold({
      id: "mismatched-scope",
      name: "Mismatched Scope",
      purpose: "Known scope that does not cover the selected surface.",
      slots: ["fx.primary"],
      recommendedScopes: ["world"]
    }).ok,
    false
  );
});

test("custom mold accessors are rejected before cloning or execution", () => {
  const mold = {
    id: "accessor-mold",
    purpose: "Accessor execution probe.",
    slots: ["world.background"],
    recommendedScopes: ["world"]
  };
  Object.defineProperty(mold, "name", {
    enumerable: true,
    get() {
      throw new Error("getter executed");
    }
  });

  const validation = validateSkinMold(mold);
  assert.equal(validation.ok, false);
  assert(validation.errors.some((error) => /Accessor properties/.test(error)));
  assert.throws(
    () => createGameContractFromMold({ mold, gameId: "test.accessor-mold" }),
    /Invalid skin mold: Accessor properties/
  );
});
