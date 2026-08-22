#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Hands = require("../../shared/asset-hands/asset-hands");
const Choice = require("../../shared/asset-hands/choice-first-core");
const PixelAnimation = require("../../shared/asset-hands/pixel-animation-core");
const RasterCodec = require("../../shared/asset-hands/raster-codec");
const Video = require("../../shared/asset-hands/video-codec");
const Film = require("../../shared/asset-hands/choice-first-film-core");

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, "pilots");
const CREATED_AT = "2026-08-12T00:00:00.000Z";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function ensure(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJson(file, value) {
  ensure(path.dirname(file));
  const text = JSON.stringify(value, null, 2) + "\n";
  fs.writeFileSync(file, text, "utf8");
  return { path: path.relative(ROOT, file).replace(/\\/g, "/"), bytes: Buffer.byteLength(text), sha256: sha256(Buffer.from(text)) };
}

function writeText(file, text) {
  ensure(path.dirname(file));
  fs.writeFileSync(file, text, "utf8");
  return { path: path.relative(ROOT, file).replace(/\\/g, "/"), bytes: Buffer.byteLength(text), sha256: sha256(Buffer.from(text)) };
}

function writeBytes(file, bytes) {
  ensure(path.dirname(file));
  const buffer = Buffer.from(bytes);
  fs.writeFileSync(file, buffer);
  return { path: path.relative(ROOT, file).replace(/\\/g, "/"), bytes: buffer.length, sha256: sha256(buffer) };
}

function bytesFromDataUrl(value) {
  const match = /^data:([^;,]+);base64,([a-z0-9+/=]+)$/i.exec(String(value || ""));
  if (!match) throw new Error("artifact data URL is invalid");
  return { mime: match[1], bytes: Buffer.from(match[2], "base64") };
}

function saveArtifact(directory, artifact) {
  const target = path.join(directory, artifact.filename || artifact.id + ".json");
  let record;
  if (artifact.dataUrl) record = writeBytes(target, bytesFromDataUrl(artifact.dataUrl).bytes);
  else record = writeText(target, String(artifact.text || ""));
  return Object.assign({ id: artifact.id, role: artifact.role, mime: artifact.mime, filename: path.basename(target) }, record);
}

function slugIdentity(id) {
  return id.split(".").slice(-2).join("-");
}

function kindFor(id) {
  return id === "axm.home.starter-sofa" ? "prop" : id === "axm.park.carousel-horse" ? "character" : "prop";
}

function animationKindFor(id) {
  return id === "axm.park.carousel-horse" ? "character" : "sprite";
}

function handBrief(request, size) {
  const text = JSON.stringify(request);
  return {
    id: request.id + "-" + request.profile.preset_id,
    title: request.identity_id.split(".").pop().replace(/-/g, " ") + " " + request.profile.preset_id,
    kind: kindFor(request.identity_id),
    operation_mode: "workflow",
    intended_use: kindFor(request.identity_id),
    target_canvas: {
      medium: "game-world",
      dimensions: { width: size, height: size, unit: "px" },
      colour: { space: "srgb", transparency: "required" },
      behaviour: ["animated"],
      intended_use: kindFor(request.identity_id),
      performance: { max_animation_frames: 12 },
    },
    required_outputs: ["image/png", "image/apng", Choice.SCHEMAS.identity, Choice.SCHEMAS.profile, Choice.SCHEMAS.representationSet, Choice.SCHEMAS.simulation],
    editable_recipe_formats: [Choice.SCHEMAS.request],
    source_artifacts: [{ id: "choice-first-request", role: "recipe", name: "Choice-first pilot request", mime: "application/json", format: "JSON", content_schema: Choice.SCHEMAS.request, editable: true, text, digest: "sha256:" + sha256(Buffer.from(text)), metadata: {} }],
    quality_requirements: { require_preview: true, require_validation: true, require_editable_source: true },
  };
}

function animationBrief(identityId, profileId, size, sourceSheet, recipeArtifact) {
  const sourceBytes = bytesFromDataUrl(sourceSheet.dataUrl).bytes;
  return {
    id: slugIdentity(identityId) + "-" + profileId + "-animation-package",
    title: identityId.split(".").pop().replace(/-/g, " ") + " " + profileId + " animation package",
    kind: animationKindFor(identityId),
    operation_mode: "workflow",
    intended_use: animationKindFor(identityId),
    target_canvas: {
      medium: "game-world",
      dimensions: { width: size, height: size, unit: "px" },
      colour: { space: "srgb", transparency: "required" },
      behaviour: ["animated"],
      intended_use: animationKindFor(identityId),
      performance: { max_file_bytes: 30000000, max_texture_memory_bytes: 80000000, max_animation_frames: 12, max_duration_seconds: 10 },
    },
    required_outputs: ["image/png", "image/apng", PixelAnimation.RECIPE_SCHEMA, PixelAnimation.MANIFEST_SCHEMA, PixelAnimation.VIDEO_SEQUENCE_SCHEMA, PixelAnimation.RECEIPT_SCHEMA],
    editable_recipe_formats: [PixelAnimation.RECIPE_SCHEMA],
    source_artifacts: [
      { id: "source-sheet", role: "source", name: "Identity-bound source sheet", mime: "image/png", format: "PNG", dataUrl: sourceSheet.dataUrl, digest: "sha256:" + sha256(sourceBytes), metadata: { identity_id: identityId, representation_profile_id: profileId } },
      { id: "animation-recipe", role: "recipe", name: "Identity-bound animation recipe", mime: "application/json", format: "JSON", content_schema: PixelAnimation.RECIPE_SCHEMA, editable: true, text: recipeArtifact.text, digest: "sha256:" + sha256(Buffer.from(recipeArtifact.text)), metadata: { identity_id: identityId, representation_profile_id: profileId } },
    ],
    quality_requirements: { require_preview: true, require_validation: true, require_editable_source: true },
  };
}

const host = {
  capabilities: [],
  permissions: [],
  accepts: [Hands.RESULT_SCHEMA, "image/png", "image/apng", "application/json", Choice.SCHEMAS.identity, Choice.SCHEMAS.profile, Choice.SCHEMAS.representationSet, Choice.SCHEMAS.simulation, Choice.SCHEMAS.upgradeableObject, PixelAnimation.RECIPE_SCHEMA, PixelAnimation.MANIFEST_SCHEMA, PixelAnimation.VIDEO_SEQUENCE_SCHEMA, PixelAnimation.RECEIPT_SCHEMA],
};

function requestFor(identityId, profileId) {
  const sofaUpgrades = identityId === "axm.home.starter-sofa"
    ? ["repair-starter-frame", "frame-reinforced-beech", "cushion-spring-firm", "upholstery-warm-velvet", "utility-underseat-storage"]
    : [];
  return { schema: Choice.SCHEMAS.request, version: "1.0.0", id: slugIdentity(identityId) + "-portable-pilot", identity_id: identityId, profile: { preset_id: profileId }, events: [], sofa_upgrades: sofaUpgrades, authority: "candidate-only" };
}

async function buildAsset(identityId) {
  const assetDirectory = path.join(OUTPUT, "assets", slugIdentity(identityId));
  const identity = Choice.getIdentity(identityId);
  writeJson(path.join(assetDirectory, "asset-identity.json"), identity);
  const representations = [];
  let sharedSimulationDigest = null;
  let sharedSofaDigest = null;
  for (const profileId of ["pixel-8bit", "pixel-16bit"]) {
    const size = profileId === "pixel-8bit" ? 48 : 96;
    const request = requestFor(identityId, profileId);
    const profileDirectory = path.join(assetDirectory, profileId);
    writeJson(path.join(profileDirectory, "request.json"), request);
    const result = await Hands.createAsync("choice-first-visual-simulation", handBrief(request, size), { host, seed: request.id, createdAt: CREATED_AT });
    if (result.status !== "READY") throw new Error(identityId + " " + profileId + " choice-first hand held: " + result.technical.errors.join(", "));
    const choiceRecords = result.artifacts.map((artifact) => saveArtifact(profileDirectory, artifact));
    const sourceSheet = result.artifacts.find((artifact) => artifact.id === "source-sheet");
    const recipeArtifact = result.artifacts.find((artifact) => artifact.id === "pixel-animation-recipe");
    const simulationArtifact = result.artifacts.find((artifact) => artifact.id === "causal-simulation");
    const simulation = JSON.parse(simulationArtifact.text);
    const stateDigest = Choice.digest(simulation.state);
    if (sharedSimulationDigest && sharedSimulationDigest !== stateDigest) throw new Error(identityId + " profiles diverged in causal simulation state");
    sharedSimulationDigest = stateDigest;
    const sofaArtifact = result.artifacts.find((artifact) => artifact.id === "upgradeable-sofa");
    if (sofaArtifact) {
      const sofaDigest = Choice.digest(JSON.parse(sofaArtifact.text));
      if (sharedSofaDigest && sharedSofaDigest !== sofaDigest) throw new Error("sofa profiles diverged in upgradeable object state");
      sharedSofaDigest = sofaDigest;
    }
    const animation = await Hands.createAsync("pixel-animation-workshop", animationBrief(identityId, profileId, size, sourceSheet, recipeArtifact), { host, seed: request.id + "-animation", createdAt: CREATED_AT });
    if (animation.status !== "READY") throw new Error(identityId + " " + profileId + " animation hand held: " + animation.technical.errors.join(", "));
    const animationDirectory = path.join(profileDirectory, "animation-package");
    const animationRecords = animation.artifacts.map((artifact) => saveArtifact(animationDirectory, artifact));
    const manifestArtifact = animation.artifacts.find((artifact) => artifact.id === "sprite-animation-manifest");
    const manifest = JSON.parse(manifestArtifact.text);
    if (manifest.identity_id !== identityId || manifest.representation_profile_id !== profileId) throw new Error("animation manifest lost identity/profile binding");
    writeJson(path.join(profileDirectory, "hand-result-summary.json"), { schema: "axm.choice-first-hand-summary/v1", status: result.status, hand: result.hand, measures: result.measures, validation: result.validation_receipt, technical: result.technical, artifact_records: choiceRecords, animation_status: animation.status, animation_measures: animation.measures, animation_validation: animation.validation_receipt, animation_artifact_records: animationRecords, authority: Choice.authority() });
    representations.push({ profile_id: profileId, recipe_id: manifest.provenance.recipe_id, artifacts: animationRecords.map((item) => ({ id: item.id, role: item.role, mime: item.mime, path: item.path, sha256: item.sha256 })), digest: Choice.digest({ manifest, animationRecords }), availability: "AVAILABLE" });
  }
  const set = Choice.buildRepresentationSet(identityId, representations);
  writeJson(path.join(assetDirectory, "asset-representation-set.json"), set);
  return { identity_id: identityId, directory: path.relative(ROOT, assetDirectory).replace(/\\/g, "/"), representation_set: path.relative(ROOT, path.join(assetDirectory, "asset-representation-set.json")).replace(/\\/g, "/"), simulation_state_digest: sharedSimulationDigest, sofa_state_digest: sharedSofaDigest };
}

function buildCausalProof() {
  const initial = Choice.createSimulation("axm.park.ferris-wheel", "causal-proof");
  const events = [
    { id: "idle-ten-years", type: "time_elapsed", duration_ms: 315576000000 },
    { id: "loaded", type: "load_changed", load: 1.4 },
    { id: "cycles", type: "use_cycle", cycles: 40, load_factor: 1.4 },
    { id: "imbalance", type: "imbalance", severity: 0.8 },
    { id: "inspection", type: "inspection" },
    { id: "repair", type: "repair", condition_points: 12, clear_faults: true },
  ];
  const replay = Choice.replaySimulation(initial, events);
  const duplicate = Choice.applySimulationEvent(replay.simulation, events[2]);
  const second = Choice.replaySimulation(initial, events);
  return {
    schema: "axm.causal-proof/v1",
    status: "PASS",
    initial,
    events,
    final: replay.simulation,
    receipts: replay.receipts,
    duplicate_receipt: duplicate.receipt,
    checks: [
      { id: "idle-no-decay", pass: replay.receipts[0].condition_delta === 0 && replay.receipts[0].cleanliness_delta === 0 && replay.receipts[0].time_only_no_decay === true },
      { id: "use-is-causal", pass: replay.receipts[2].condition_delta < 0 },
      { id: "imbalance-can-fault", pass: replay.receipts[3].condition_delta < 0 },
      { id: "repair-is-explicit", pass: replay.receipts[5].condition_delta > 0 },
      { id: "exactly-once", pass: duplicate.receipt.status === "DUPLICATE_IGNORED" && Choice.digest(duplicate.simulation) === Choice.digest(replay.simulation) },
      { id: "deterministic-replay", pass: replay.replay_digest === second.replay_digest },
    ],
    authority: Choice.authority(),
  };
}

function applyPath(id, upgrades) {
  let sofa = Choice.createStarterSofa(id);
  let resources = { money: 2000, labour_hours: 100, materials: { fasteners: 50, hardwood: 50, textile: 50, filling: 50, springs: 50, sealant: 20, mechanism: 10, cleaner: 20 } };
  const receipts = [];
  for (const upgrade of upgrades) { const result = Choice.applySofaUpgrade(sofa, upgrade, resources); if (result.status !== "APPLIED") throw new Error("sofa path failed: " + upgrade); sofa = result.object; resources = result.resources; receipts.push(result.receipt); }
  return { sofa, resources, receipts };
}

function buildSofaProof() {
  const cosy = applyPath("sofa-shared-identity", ["frame-reinforced-beech", "cushion-cotton-soft", "upholstery-warm-velvet", "utility-recline-comfort"]);
  const practical = applyPath("sofa-shared-identity", ["frame-reinforced-beech", "cushion-spring-firm", "upholstery-durable-canvas", "utility-underseat-storage"]);
  return {
    schema: "axm.sofa-branching-proof/v1",
    status: "PASS",
    starter: Choice.createStarterSofa("sofa-shared-identity"),
    branches: [
      { id: "cosy-expressive", state: cosy.sofa, receipts: cosy.receipts, evaluation: Choice.evaluateSofa(cosy.sofa, { room_width: 4, needed_capacity: 2, household_preferences: { style_tags: ["warm", "expressive", "relaxing"], maintenance_tolerance: 10 } }) },
      { id: "compact-practical", state: practical.sofa, receipts: practical.receipts, evaluation: Choice.evaluateSofa(practical.sofa, { room_width: 2.4, needed_capacity: 2, household_preferences: { style_tags: ["practical", "storage", "compact-room"], maintenance_tolerance: 3 } }) },
    ],
    checks: [
      { id: "identity-persists", pass: cosy.sofa.id === practical.sofa.id && cosy.sofa.id === "sofa-shared-identity" },
      { id: "branches-differ", pass: Choice.digest(cosy.sofa.installed_components) !== Choice.digest(practical.sofa.installed_components) },
      { id: "no-universal-score", pass: Choice.evaluateSofa(cosy.sofa, {}).universal_score === null },
      { id: "replacement-never-forced", pass: cosy.sofa.replacement_required === false && practical.sofa.replacement_required === false },
    ],
    authority: Choice.authority(),
  };
}

async function buildFilm() {
  const filmDirectory = path.join(OUTPUT, "film");
  const source = Film.build();
  const encoded = await Video.encodeSparse(Film.WIDTH, Film.HEIGHT, source.uniqueFrames, source.sequence, { frameRate: { numerator: 12, denominator: 1 }, formats: ["mp4", "webm"], jpegQuality: 88, vp8Quality: 86 });
  const mp4 = writeBytes(path.join(filmDirectory, "axm-choice-first-pixel-explainer.mp4"), encoded.mp4.bytes);
  const webm = writeBytes(path.join(filmDirectory, "axm-choice-first-pixel-explainer.webm"), encoded.webm.bytes);
  const recipe = writeJson(path.join(filmDirectory, "film-recipe.json"), source.recipe);
  const sequence = writeJson(path.join(filmDirectory, "sparse-sequence.json"), { schema: "axm.sparse-video-sequence/v1", status: "EXPERIMENTAL", frame_rate: source.recipe.frame_rate, sample_count: source.sequence.length, unique_frame_count: source.uniqueFrames.length, indices: source.sequence, authority: Choice.authority() });
  const vtt = writeText(path.join(filmDirectory, "axm-choice-first-pixel-explainer.vtt"), source.vtt);
  const selected = [0, Math.floor(source.sequence.length / 2), source.sequence.length - 1].map((sampleIndex) => ({ sample_index: sampleIndex, unique_index: source.sequence[sampleIndex], rgba: source.uniqueFrames[source.sequence[sampleIndex]] }));
  const proofNames = ["first-frame.png", "middle-frame.png", "last-frame.png"];
  const proofFrames = selected.map((item, index) => {
    const png = RasterCodec.encodeRgba(Film.WIDTH, Film.HEIGHT, item.rgba, { colourSpace: "srgb" });
    return Object.assign({ sample_index: item.sample_index, unique_index: item.unique_index, decode_pass: png.inspection.pass }, writeBytes(path.join(filmDirectory, proofNames[index]), png.bytes));
  });
  const receiptValue = {
    schema: "axm.choice-first-film-verification/v1",
    status: "PASS",
    claim: "A silent captioned 20-second 640x360 12-fps film is encoded from 40 unique RGBA frames into 240 rationally timed samples without holding 240 raw frames.",
    engine: encoded.engine,
    frame_rate: encoded.frameRate,
    dimensions: { width: encoded.width, height: encoded.height },
    frames: encoded.frames,
    unique_frames: encoded.uniqueFrames,
    duration_seconds: encoded.durationSeconds,
    expanded_raw_frames_held: encoded.expandedRawFramesHeld,
    containers: { mp4: Object.assign({}, encoded.mp4.inspection, { module: encoded.mp4.module, sha256: mp4.sha256, path: mp4.path }), webm: Object.assign({}, encoded.webm.inspection, { module: encoded.webm.module, sha256: webm.sha256, path: webm.path }) },
    captions: { bitmap_in_frames: true, companion_vtt: vtt, cue_count: source.recipe.captions.length },
    proof_frames: proofFrames,
    recipe,
    sequence,
    checks: [
      { id: "exact-sample-count", pass: encoded.frames === 240 },
      { id: "exact-rational-rate", pass: encoded.frameRate.numerator === 12 && encoded.frameRate.denominator === 1 },
      { id: "exact-duration", pass: encoded.durationSeconds === 20 && encoded.mp4.inspection.durationSeconds === 20 && encoded.webm.inspection.durationSeconds === 20 },
      { id: "sparse-raw-frame-hold", pass: encoded.uniqueFrames === 40 && encoded.expandedRawFramesHeld === false },
      { id: "containers-parse", pass: encoded.mp4.inspection.pass && encoded.webm.inspection.pass },
      { id: "first-middle-last-decode", pass: encoded.mp4.module.pass && encoded.webm.module.pass && proofFrames.every((item) => item.decode_pass) },
      { id: "caption-cues", pass: source.recipe.captions.length === 5 && source.vtt.startsWith("WEBVTT") },
      { id: "silent", pass: source.recipe.audio === false },
    ],
    authority: Choice.authority(),
  };
  if (!receiptValue.checks.every((check) => check.pass)) { receiptValue.status = "FAIL"; throw new Error("film verification failed"); }
  const receipt = writeJson(path.join(filmDirectory, "verification-receipt.json"), receiptValue);
  return { mp4, webm, vtt, recipe, sequence, receipt, proof_frames: proofFrames };
}

async function main() {
  ensure(OUTPUT);
  const assets = [];
  for (const identity of Choice.listIdentities()) assets.push(await buildAsset(identity.id));
  const causal = buildCausalProof();
  if (!causal.checks.every((check) => check.pass)) throw new Error("causal proof failed");
  const causalRecord = writeJson(path.join(OUTPUT, "causal-proof.json"), causal);
  const sofa = buildSofaProof();
  if (!sofa.checks.every((check) => check.pass)) throw new Error("sofa branching proof failed");
  const sofaRecord = writeJson(path.join(OUTPUT, "sofa-branching-proof.json"), sofa);
  const film = await buildFilm();
  const catalog = {
    schema: "axm.choice-first-pilot-catalog/v1",
    version: "1.0.0",
    status: "EXPERIMENTAL",
    generated_at: CREATED_AT,
    assets,
    causal_proof: causalRecord,
    sofa_branching_proof: sofaRecord,
    film,
    choices: Choice.listRepresentationChoices(),
    boundaries: { installed: false, promoted: false, canonical: false, automatic_approval: false, human_review_required: true },
  };
  writeJson(path.join(OUTPUT, "catalog.json"), catalog);
  console.log("Choice-first pilot build PASS", { assets: assets.length, profiles: assets.length * 2, filmFrames: 240, filmUniqueFrames: 40 });
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
