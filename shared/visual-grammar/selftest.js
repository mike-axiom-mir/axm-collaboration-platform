#!/usr/bin/env node
"use strict";

const assert = require("assert");
const HubSkin = require("../../hub/skin-core");
const UCP = require("../asset-hands/universal-component");
const Visual = require("./visual-grammar-core");
const HubAdapter = require("./hub-skin-adapter");

const createdAt = "2026-07-22T20:00:00.000Z";
const skin = {
  schema: HubSkin.SCHEMA,
  id: "visual-grammar-fixture",
  name: "Visual Grammar Fixture",
  author: "AXM selftest",
  tokens: { "--cy": "#42e8ff", "--radius": "12" },
  slots: { nav: "left", status: "bottom", density: "compact" },
  assets: {}
};

const adapted = HubAdapter.fromHubSkin(skin, { createdAt, createdBy: "visual-grammar-selftest", licenseId: "CC0-1.0" });
assert.equal(adapted.status, "ADAPTED");
assert.equal(adapted.components.length, 6);
assert(Visual.validateProfile(adapted.profile, adapted.registry).pass);

const unknownInventory = Visual.plan(adapted.profile, adapted.registry, { createdAt });
assert.equal(unknownInventory.status, "CAPABILITY_INVENTORY_REQUIRED");
assert.deepEqual(unknownInventory.required_capabilities, ["hand.skin.hub.apply"]);
assert.equal(unknownInventory.truth.rendered, false);

const missingHand = Visual.plan(adapted.profile, adapted.registry, { createdAt, availableCapabilities: [] });
assert.equal(missingHand.status, "MISSING_HANDS");
assert.deepEqual(missingHand.missing_capabilities, ["hand.skin.hub.apply"]);

const ready = Visual.plan(adapted.profile, adapted.registry, { createdAt, availableCapabilities: ["hand.skin.hub.apply"] });
assert.equal(ready.status, "READY_CONTRACT");
assert.equal(ready.truth.visually_approved, false);

const roundTrip = HubAdapter.toHubSkin(adapted.profile, adapted.registry);
assert.equal(roundTrip.status, "READY_DATA");
assert.equal(roundTrip.skin.tokens["--cy"], "#42e8ff");
assert.equal(roundTrip.skin.slots.density, "compact");

const oldPalette = adapted.registry.get("axm.hubskin.visual-grammar-fixture.palette", "1.0.0");
const newPalette = UCP.sealComponent(Object.assign({}, oldPalette, {
  version: "1.1.0",
  payload: Object.assign({}, oldPalette.payload, { "--cy": "#63ff9b" }),
  digest: undefined
}));
adapted.registry.register(newPalette);
const swapped = Visual.swapComponents(adapted.profile, [{
  instance_id: "palette",
  component: { component_id: newPalette.id, component_version: newPalette.version, component_digest: newPalette.digest }
}], adapted.registry, { createdAt });
assert.equal(swapped.status, "SWAPPED");
assert.equal(swapped.profile.approval.visual, "INVALIDATED");
assert.equal(swapped.profile.approval.technical, "UNTESTED");
assert.equal(swapped.profile.approval.canon, false);
const changedSkin = HubAdapter.toHubSkin(swapped.profile, adapted.registry);
assert.equal(changedSkin.status, "READY_DATA");
assert.equal(changedSkin.skin.tokens["--cy"], "#63ff9b");

const protectedProfile = Visual.sealProfile(Object.assign({}, adapted.profile, {
  role_bindings: adapted.profile.role_bindings.map((binding) => binding.instance_id === "palette" ? Object.assign({}, binding, { plane: "semantic" }) : binding),
  protected_instances: ["palette"],
  digest: undefined
}));
const refused = Visual.swapComponents(protectedProfile, [{
  instance_id: "palette",
  component: { component_id: newPalette.id, component_version: newPalette.version, component_digest: newPalette.digest }
}], adapted.registry, { createdAt });
assert.equal(refused.status, "REFUSED");
assert(refused.receipt.errors.some((error) => error.includes("protected or non-editable")));

const matrix = require("./capability-matrix.json");
assert.equal(matrix.verdict, "FOUNDATION_READY_MANIPULATION_PARTIAL");
assert(matrix.areas.some((area) => area.area === "universal compositor/filter runtime" && area.status === "READY_BOUNDED"));
assert(matrix.areas.some((area) => area.area === "cross-module visual proof receipts" && area.status === "READY_CONTRACT" && area.hold.includes("does not render")));

console.log("AXM Visual Grammar selftest PASS (UCP roles, honest hand routing, reversible Hub skin adapter, presentation-only swaps and approval invalidation)");
