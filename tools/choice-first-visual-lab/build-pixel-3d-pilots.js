#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Choice = require("../../shared/asset-hands/choice-first-core");
const Pixel3D = require("../../shared/asset-hands/pixel-3d-core");

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, "pilots", "pixel-3d");
const CREATED_AT = "2026-08-12T00:00:00.000Z";
const IDENTITIES = [
  "axm.park.ferris-wheel",
  "axm.park.carousel-horse",
  "axm.park.ticket-gate",
  "axm.home.starter-sofa"
];
const PROFILES = ["pixel-8bit-3d", "pixel-16bit-3d"];

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function ensure(directory) { fs.mkdirSync(directory, { recursive: true }); }
function relative(file) { return path.relative(ROOT, file).replace(/\\/g, "/"); }
function writeJson(file, value) {
  ensure(path.dirname(file));
  const text = JSON.stringify(value, null, 2) + "\n";
  fs.writeFileSync(file, text, "utf8");
  return { path: relative(file), bytes: Buffer.byteLength(text), sha256: sha256(Buffer.from(text)) };
}
function writeBytes(file, bytes) {
  ensure(path.dirname(file));
  const buffer = Buffer.from(bytes);
  fs.writeFileSync(file, buffer);
  return { path: relative(file), bytes: buffer.length, sha256: sha256(buffer) };
}
function slug(identityId) { return identityId.replace(/^axm\./, "").replace(/\./g, "-"); }

function buildIdentity(identityId) {
  const identityDirectory = path.join(OUTPUT, slug(identityId));
  const built = {};
  for (const profileId of PROFILES) {
    const packageResult = Pixel3D.buildPackage({
      schema: Pixel3D.SCHEMAS.request,
      version: "1.0.0",
      id: slug(identityId) + "-" + profileId,
      identity_id: identityId,
      profile_id: profileId,
      animation_state: identityId === "axm.park.ticket-gate" ? "open" : identityId === "axm.home.starter-sofa" ? "sit" : "running",
      authority: "candidate-only"
    });
    if (packageResult.status !== "READY" || packageResult.receipt.status !== "PASS") throw new Error(identityId + " " + profileId + " failed validation");
    const directory = path.join(identityDirectory, profileId);
    const model = writeBytes(path.join(directory, slug(identityId) + "-" + profileId + ".glb"), packageResult.glb.bytes);
    const recipe = writeJson(path.join(directory, "scene-recipe.json"), packageResult.scene);
    const profile = writeJson(path.join(directory, "representation-profile.json"), packageResult.profile);
    const receipt = writeJson(path.join(directory, "validation-receipt.json"), packageResult.receipt);
    built[profileId] = { packageResult, files: { model, recipe, profile, receipt } };
  }

  const identity = built[PROFILES[0]].packageResult.identity;
  const representationSet = {
    schema: "axm.asset-representation-set/v1",
    version: "1.0.0",
    status: "EXPERIMENTAL",
    id: identityId + ".pixel-3d-representations",
    identity_id: identityId,
    representations: PROFILES.map((profileId) => {
      const item = built[profileId];
      return {
        profile_id: profileId,
        recipe_id: item.packageResult.scene.id,
        artifacts: [
          { role: "runtime-model", mime: "model/gltf-binary", format: "GLB", path: item.files.model.path, digest: "sha256:" + item.files.model.sha256 },
          { role: "editable-recipe", mime: "application/json", format: "JSON", path: item.files.recipe.path, digest: "sha256:" + item.files.recipe.sha256 },
          { role: "validation-receipt", mime: "application/json", format: "JSON", path: item.files.receipt.path, digest: "sha256:" + item.files.receipt.sha256 }
        ],
        digest: "sha256:" + item.files.model.sha256,
        availability: "AVAILABLE",
        animation_state: item.packageResult.scene.animation_state
      };
    }),
    semantic_coverage: identity.semantic_actions.slice(),
    compatibility: { footprint_preserved: true, pivots_preserved: true, sockets_preserved: true, simulation_state_shared: true },
    provenance: { generated_by: "build-pixel-3d-pilots.js", generated_at: CREATED_AT, deterministic: true, candidate_only: true },
    authority: Choice.authority()
  };
  const representationSetRecord = writeJson(path.join(identityDirectory, "asset-representation-set.json"), representationSet);
  const identityRecord = writeJson(path.join(identityDirectory, "asset-identity.json"), identity);
  const eight = built["pixel-8bit-3d"].packageResult;
  const sixteen = built["pixel-16bit-3d"].packageResult;
  const checks = [
    { id: "same-identity", pass: eight.identity.id === sixteen.identity.id },
    { id: "same-footprint", pass: Choice.digest(eight.scene.footprint) === Choice.digest(sixteen.scene.footprint) },
    { id: "same-pivots", pass: Choice.digest(eight.scene.pivots) === Choice.digest(sixteen.scene.pivots) },
    { id: "same-sockets", pass: Choice.digest(eight.scene.sockets) === Choice.digest(sixteen.scene.sockets) },
    { id: "same-semantic-state", pass: eight.scene.animation_state === sixteen.scene.animation_state },
    { id: "both-animated", pass: eight.receipt.measures.animations > 0 && sixteen.receipt.measures.animations > 0 },
    { id: "profiles-are-distinct", pass: eight.receipt.glb_digest !== sixteen.receipt.glb_digest },
    { id: "sixteen-adds-detail", pass: sixteen.receipt.measures.triangles >= eight.receipt.measures.triangles && sixteen.receipt.measures.nodes >= eight.receipt.measures.nodes },
    { id: "both-pass", pass: eight.receipt.status === "PASS" && sixteen.receipt.status === "PASS" },
    { id: "candidate-only", pass: identity.authority.canonical === false && identity.authority.installed === false }
  ];
  if (!checks.every((check) => check.pass)) throw new Error(identityId + " cross-profile proof failed");
  return {
    identity_id: identityId,
    identity: identityRecord,
    representation_set: representationSetRecord,
    profiles: Object.fromEntries(PROFILES.map((profileId) => [profileId, built[profileId].files])),
    measures: Object.fromEntries(PROFILES.map((profileId) => [profileId, built[profileId].packageResult.receipt.measures])),
    checks
  };
}

function main() {
  ensure(OUTPUT);
  const identities = IDENTITIES.map(buildIdentity);
  const unavailable = ["realtime-3d-high-detail", "cinematic-render"].map((profileId) => Pixel3D.resolveProfile(profileId));
  const proof = {
    schema: "axm.pixel-3d-pilot-proof/v1",
    version: "1.0.0",
    status: "EXPERIMENTAL",
    generated_at: CREATED_AT,
    profiles: PROFILES.map((id) => Pixel3D.resolveProfile(id).profile),
    identities,
    unavailable_requests: unavailable,
    checks: [
      { id: "eight-glbs-generated", pass: identities.reduce((sum, item) => sum + Object.keys(item.profiles).length, 0) === 8 },
      { id: "all-cross-profile-checks-pass", pass: identities.every((item) => item.checks.every((check) => check.pass)) },
      { id: "future-profiles-typed-missing", pass: unavailable.every((item) => item.status === "MISSING_REPRESENTATION" && item.fallback_used === false) },
      { id: "whole-game-3d-remains-unavailable", pass: true, detail: "These are four asset representations, not complete semantic-slot coverage for a walkable 3D game pack." }
    ],
    boundary: "Individual GLBs are engine-neutral candidate assets. They do not activate, install, or complete a whole-game walkable-3D pack.",
    authority: Choice.authority()
  };
  if (!proof.checks.every((check) => check.pass)) throw new Error("pixel 3D pilot proof failed");
  const proofRecord = writeJson(path.join(OUTPUT, "pilot-proof.json"), proof);
  const catalog = {
    schema: "axm.pixel-3d-pilot-catalog/v1",
    version: "1.0.0",
    status: "EXPERIMENTAL",
    generated_at: CREATED_AT,
    proof: proofRecord,
    identities: identities.map((item) => ({ identity_id: item.identity_id, identity: item.identity.path, representation_set: item.representation_set.path, profiles: Object.fromEntries(PROFILES.map((profileId) => [profileId, item.profiles[profileId].model.path])) })),
    authority: Choice.authority()
  };
  const catalogRecord = writeJson(path.join(OUTPUT, "catalog.json"), catalog);
  console.log(JSON.stringify({ status: "PASS", glbs: IDENTITIES.length * PROFILES.length, proof: proofRecord, catalog: catalogRecord }, null, 2));
}

main();
