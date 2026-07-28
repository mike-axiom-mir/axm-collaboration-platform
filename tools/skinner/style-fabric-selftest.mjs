#!/usr/bin/env node

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { compilePresetPack, mapFabricPackToSkin } from "./style-fabric-bridge.mjs";

const require = createRequire(import.meta.url);
const Skin = require("../../hub/skin-core.js");

const first = compilePresetPack("axm-balanced");
const second = compilePresetPack("axm-balanced");
assert.deepEqual(first, second, "the same preskin selection must compile deterministically");

const current = Skin.newSkin("Bridge proof", "axm");
current.visuals = { enabled: false, lightPreset: "quiet-aura" };
const mapped = mapFabricPackToSkin(first, Skin, current);
assert.equal(mapped.ok, true, "a valid Style Fabric pack must map through Skinner");
assert.equal(Skin.accept(mapped.skin, null).ok, true, "the mapped skin must pass the existing safety gate");
assert.equal(mapped.skin.visuals.enabled, false, "Style Fabric must not silently enable Aetherglass");
assert.equal(mapped.receipt.authorityWrites, 0, "the bridge must declare zero gameplay-authority writes");
assert.ok(mapped.receipt.mappedTokens.includes("--cy"), "the bridge must map the primary Style Fabric accent");

const fused = compilePresetPack("axm-balanced", "world-ember-foundry", 0.37);
const fusedMapped = mapFabricPackToSkin(fused, Skin, current);
assert.equal(fusedMapped.ok, true, "deterministic preskin fusion must map through Skinner");
assert.notEqual(fusedMapped.skin.tokens["--cy"], mapped.skin.tokens["--cy"], "fusion must change the mapped palette");

const hostile = structuredClone(first);
hostile.gameplay = { damage: 999 };
const refused = mapFabricPackToSkin(hostile, Skin, current);
assert.equal(refused.ok, false, "authority-bearing Style Fabric data must fail closed");
assert.equal(refused.stage, "style-fabric-validation", "hostile data must be refused before Skinner mapping");

console.log("Style Fabric to Skinner bridge selftest: PASS");
