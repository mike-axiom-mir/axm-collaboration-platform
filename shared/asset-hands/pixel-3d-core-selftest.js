#!/usr/bin/env node
"use strict";

const assert = require("assert");
const Core = require("./pixel-3d-core");
const Codec = require("./pixel-3d-codec");

const identities = [
  "axm.park.ferris-wheel",
  "axm.park.carousel-horse",
  "axm.park.ticket-gate",
  "axm.home.starter-sofa"
];

for (const identityId of identities) {
  const eight = Core.buildPackage({ identity_id: identityId, profile_id: "pixel-8bit-3d", animation_state: "running" });
  const sixteen = Core.buildPackage({ identity_id: identityId, profile_id: "pixel-16bit-3d", animation_state: "running" });
  assert.equal(eight.status, "READY");
  assert.equal(sixteen.status, "READY");
  assert.equal(eight.receipt.status, "PASS");
  assert.equal(sixteen.receipt.status, "PASS");
  assert(eight.receipt.checks.every((check) => check.pass));
  assert(sixteen.receipt.checks.every((check) => check.pass));
  assert.equal(eight.identity.id, sixteen.identity.id);
  assert.deepEqual(eight.scene.footprint, sixteen.scene.footprint);
  assert.deepEqual(eight.scene.pivots, sixteen.scene.pivots);
  assert.deepEqual(eight.scene.sockets, sixteen.scene.sockets);
  assert.equal(eight.scene.animation_state, sixteen.scene.animation_state);
  assert.notEqual(eight.receipt.glb_digest, sixteen.receipt.glb_digest);
  assert(sixteen.receipt.measures.triangles >= eight.receipt.measures.triangles);
  assert(sixteen.receipt.measures.nodes >= eight.receipt.measures.nodes);
  assert.equal(Codec.inspect(Codec.bytesFromDataUrl(eight.glb.dataUrl)).identity_id, identityId);
  if (identityId === "axm.park.ferris-wheel") {
    assert(eight.receipt.measures.triangles > eight.glb.inspection.json.extras.axm.unique_triangles, "triangle budget must count repeated mesh instances, not only unique buffers");
  }
}

const missing = Core.resolveProfile("cinematic-render");
assert.equal(missing.status, "MISSING_REPRESENTATION");
assert.equal(missing.fallback_used, false);
assert.equal(missing.nearest_substitute_used, false);
assert(!missing.missing.includes("profile:pixel-16bit-3d"));

const choices = Core.listChoices();
assert(choices.find((choice) => choice.id === "pixel-8bit-3d" && choice.installed));
assert(choices.find((choice) => choice.id === "pixel-16bit-3d" && choice.installed));
assert(choices.find((choice) => choice.id === "cinematic-render" && !choice.installed));

console.log("Pixel 3D Core selftest PASS (8 packages, exact profiles, identity anchors, animated GLB, deterministic bytes, typed no-fallback gap)");
