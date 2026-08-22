"use strict";

const crypto = require("node:crypto");

const VERSION = "1.0.0";
const HANDOFF_SCHEMA = "axm.deterministic-material-handoff/v1";
const RESULT_SCHEMA = "axm.asset-hand-result/v1";
const HAND_ID = "pbr-material-bake";
const HAND_VERSION = "1.1.0";
const RECIPE_SCHEMA = "axm.pbr-material-recipe/v1";
const RECEIPT_SCHEMA = "axm.pbr-material-bake-receipt/v1";
const REQUEST_BODY_MAX_BYTES = 256 * 1024;
const RESPONSE_BODY_MAX_BYTES = 12 * 1024 * 1024;
const NORMAL_CONVENTION = "OpenGL tangent space; +Y green; texture V increases downward";

const PNG_SPECS = Object.freeze({
  "pbr-albedo-map": Object.freeze({
    role: "pbr-albedo-map",
    map: "albedo",
    sampling: Object.freeze({
      interpretation: "colour",
      transfer_function: "srgb",
      channel_semantics: Object.freeze({ r: "base-color-red", g: "base-color-green", b: "base-color-blue", a: "opacity" }),
      wrap: "repeat",
    }),
  }),
  "pbr-normal-map": Object.freeze({
    role: "pbr-normal-map",
    map: "normal",
    sampling: Object.freeze({
      interpretation: "data",
      transfer_function: "linear",
      channel_semantics: Object.freeze({ r: "tangent-x", g: "tangent-y-positive-opengl", b: "tangent-z", a: "one" }),
      wrap: "repeat",
    }),
  }),
  "pbr-orm-map": Object.freeze({
    role: "pbr-orm-map",
    map: "orm",
    sampling: Object.freeze({
      interpretation: "data",
      transfer_function: "linear",
      channel_semantics: Object.freeze({ r: "ambient-occlusion", g: "roughness", b: "metalness", a: "one" }),
      wrap: "repeat",
    }),
  }),
  "pbr-emissive-map": Object.freeze({
    role: "pbr-emissive-map",
    map: "emissive",
    sampling: Object.freeze({
      interpretation: "colour",
      transfer_function: "srgb",
      channel_semantics: Object.freeze({ r: "emissive-red", g: "emissive-green", b: "emissive-blue", a: "one" }),
      wrap: "repeat",
    }),
  }),
  "pbr-height-map": Object.freeze({
    role: "pbr-height-map",
    map: "height",
    sampling: Object.freeze({
      interpretation: "data",
      transfer_function: "linear",
      channel_semantics: Object.freeze({ r: "height", g: "height", b: "height", a: "one" }),
      wrap: "repeat",
    }),
  }),
  "pbr-material-preview": Object.freeze({
    role: "pbr-material-preview",
    map: "preview",
    sampling: Object.freeze({
      interpretation: "colour",
      transfer_function: "srgb",
      channel_semantics: Object.freeze({ r: "reference-preview-red", g: "reference-preview-green", b: "reference-preview-blue", a: "one" }),
      wrap: "clamp",
    }),
  }),
});

const JSON_SPECS = Object.freeze({
  "editable-pbr-material-recipe": Object.freeze({ role: "editable-pbr-material-recipe", schema: RECIPE_SCHEMA, editable: true }),
  "pbr-material-bake-receipt": Object.freeze({ role: "pbr-material-bake-receipt", schema: RECEIPT_SCHEMA, editable: false }),
});

class MaterialHandoffError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MaterialHandoffError";
    this.code = code;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const output = {};
    Object.keys(value).sort().forEach((key) => { output[key] = stable(value[key]); });
    return output;
  }
  return value;
}

function canonicalStringify(value) {
  return JSON.stringify(stable(value));
}

function sha256(value) {
  const input = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === "string" ? value : canonicalStringify(value), "utf8");
  return crypto.createHash("sha256").update(input).digest("hex");
}

function fail(code, message) {
  throw new MaterialHandoffError(code, message);
}

function plainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exactObject(actual, expected) {
  return canonicalStringify(actual) === canonicalStringify(expected);
}

function parseJsonArtifact(artifact, label) {
  if (typeof artifact.text !== "string") fail("ARTIFACT_CONTRACT_MISMATCH", label + " must use a text payload");
  try {
    return JSON.parse(artifact.text);
  } catch (_error) {
    fail("ARTIFACT_CONTRACT_MISMATCH", label + " is not valid JSON");
  }
}

function inspectPng(artifact) {
  if (typeof artifact.dataUrl !== "string" || !artifact.dataUrl.startsWith("data:image/png;base64,"))
    fail("PNG_INVALID", artifact.id + " must use an image/png base64 dataUrl");
  const payload = artifact.dataUrl.slice("data:image/png;base64,".length);
  const bytes = Buffer.from(payload, "base64");
  if (bytes.length < 33 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
    fail("PNG_INVALID", artifact.id + " is missing the PNG signature/IHDR");
  if (bytes.subarray(12, 16).toString("ascii") !== "IHDR")
    fail("PNG_INVALID", artifact.id + " has no leading IHDR chunk");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== artifact.width || height !== artifact.height || width !== height || width < 32 || width > 512)
    fail("PNG_INVALID", artifact.id + " dimensions disagree with the bounded artifact envelope");
  return { bytes, width, height, sha256: sha256(bytes) };
}

function validateRecipe(recipe, result) {
  if (!plainObject(recipe)) fail("RECIPE_INVALID", "editable recipe must be a JSON object");
  const keys = Object.keys(recipe).sort();
  const expectedKeys = ["authority", "family", "id", "normal_strength", "schema", "seed", "size", "version"];
  if (!exactObject(keys, expectedKeys)) fail("RECIPE_INVALID", "editable recipe fields do not match the v1 allowlist");
  if (recipe.schema !== RECIPE_SCHEMA || recipe.version !== "1.0.0" || recipe.authority !== "candidate-only")
    fail("RECIPE_INVALID", "editable recipe schema/version/authority mismatch");
  if (!Number.isInteger(recipe.size) || recipe.size < 32 || recipe.size > 512)
    fail("RECIPE_INVALID", "editable recipe size is outside 32..512");
  if (!Number.isFinite(recipe.normal_strength) || recipe.normal_strength < 0.25 || recipe.normal_strength > 8)
    fail("RECIPE_INVALID", "editable recipe normal_strength is outside 0.25..8");
  const dimensions = result.target_canvas && result.target_canvas.dimensions;
  if (!dimensions || dimensions.width !== recipe.size || dimensions.height !== recipe.size)
    fail("RECIPE_INVALID", "editable recipe size does not match target_canvas dimensions");
}

function validateAuthority(result, receipt) {
  if (result.hand.authority !== "candidate-only" || result.provenance.authority !== "candidate-only")
    fail("AUTHORITY_VIOLATION", "result and hand must remain candidate-only");
  const authority = receipt.authority;
  if (!plainObject(authority) || authority.candidate_only !== true || authority.installed !== false || authority.promoted !== false || authority.canonical !== false || authority.human_review_required !== true)
    fail("AUTHORITY_VIOLATION", "material receipt authority must be candidate-only, non-installed, non-promoted, non-canonical, and human-review-required");
}

function assertResult(result) {
  if (!plainObject(result)) fail("RESULT_CONTRACT_MISMATCH", "whole Asset Hand result object is required");
  let serialized;
  try { serialized = JSON.stringify(result); } catch (_error) { fail("RESULT_CONTRACT_MISMATCH", "result must be JSON serializable"); }
  const serializedBytes = Buffer.byteLength(serialized, "utf8");
  if (serializedBytes > RESPONSE_BODY_MAX_BYTES)
    fail("RESPONSE_BUDGET_EXCEEDED", "serialized result exceeds the 12 MiB handoff ceiling");
  if (result.schema !== RESULT_SCHEMA || !plainObject(result.hand) || result.hand.id !== HAND_ID || result.hand.version !== HAND_VERSION)
    fail("RESULT_CONTRACT_MISMATCH", "result must come from pbr-material-bake@1.1.0");
  if (result.status !== "READY" || !result.technical || result.technical.pass !== true || !result.validation_receipt || result.validation_receipt.status !== "PASS")
    fail("RESULT_NOT_REVIEWABLE", "only READY/PASS technical candidates may enter sensory review");
  if (!result.creation_recipe || !["create", "edit"].includes(result.creation_recipe.operation_mode))
    fail("RESULT_CONTRACT_MISMATCH", "creation_recipe must bind create or edit operation mode");
  if (result.previewArtifactId !== "pbr-material-preview" || !result.preview || result.preview.available !== true)
    fail("RESULT_CONTRACT_MISMATCH", "static reference preview must be present but remains secondary evidence");
  if (!Array.isArray(result.artifacts) || result.artifacts.length !== 8)
    fail("ARTIFACT_CONTRACT_MISMATCH", "exactly eight material artifacts are required");

  const artifacts = new Map();
  result.artifacts.forEach((artifact) => {
    if (!plainObject(artifact) || artifacts.has(artifact.id)) fail("ARTIFACT_CONTRACT_MISMATCH", "artifact ids must be present and unique");
    artifacts.set(artifact.id, artifact);
  });
  const expectedIds = Object.keys(PNG_SPECS).concat(Object.keys(JSON_SPECS));
  if (!expectedIds.every((id) => artifacts.has(id))) fail("ARTIFACT_CONTRACT_MISMATCH", "one or more exact material artifacts are missing");

  const pngs = [];
  Object.entries(PNG_SPECS).forEach(([id, spec]) => {
    const artifact = artifacts.get(id);
    if (artifact.role !== spec.role || artifact.mime !== "image/png" || artifact.format !== "PNG" || artifact.editable !== false || !artifact.metadata || artifact.metadata.schema !== "PNG.1.0")
      fail("ARTIFACT_CONTRACT_MISMATCH", id + " envelope mismatch");
    if (artifact.metadata.candidateOnly !== true || artifact.metadata.canonical !== false)
      fail("AUTHORITY_VIOLATION", id + " authority metadata mismatch");
    if (!exactObject(artifact.metadata.sampling, spec.sampling))
      fail("SAMPLING_CONTRACT_MISMATCH", id + " sampling metadata mismatch");
    if (artifact.metadata.map !== spec.map)
      fail("SAMPLING_CONTRACT_MISMATCH", id + " map semantic mismatch");
    if (id === "pbr-normal-map" && artifact.metadata.normalConvention !== NORMAL_CONVENTION)
      fail("SAMPLING_CONTRACT_MISMATCH", "normal convention mismatch");
    if (id === "pbr-orm-map" && !exactObject(artifact.metadata.packing, { red: "ambient-occlusion", green: "roughness", blue: "metalness" }))
      fail("SAMPLING_CONTRACT_MISMATCH", "ORM packing mismatch");
    const inspection = inspectPng(artifact);
    pngs.push({
      id,
      role: artifact.role,
      transport_digest: artifact.digest,
      byte_sha256: inspection.sha256,
      bytes: inspection.bytes.length,
      width: inspection.width,
      height: inspection.height,
      sampling: clone(spec.sampling),
    });
  });

  Object.entries(JSON_SPECS).forEach(([id, spec]) => {
    const artifact = artifacts.get(id);
    if (artifact.role !== spec.role || artifact.mime !== "application/json" || artifact.format !== "JSON" || artifact.editable !== spec.editable || !artifact.metadata || artifact.metadata.schema !== spec.schema)
      fail("ARTIFACT_CONTRACT_MISMATCH", id + " envelope mismatch");
    if (artifact.metadata.candidateOnly !== true || artifact.metadata.canonical !== false)
      fail("AUTHORITY_VIOLATION", id + " authority metadata mismatch");
  });

  const recipeArtifact = artifacts.get("editable-pbr-material-recipe");
  const recipe = parseJsonArtifact(recipeArtifact, "editable recipe");
  validateRecipe(recipe, result);
  if (!pngs.every((png) => png.width === recipe.size && png.height === recipe.size))
    fail("PNG_INVALID", "PNG dimensions must match the editable recipe size");
  const receiptArtifact = artifacts.get("pbr-material-bake-receipt");
  const receipt = parseJsonArtifact(receiptArtifact, "machine bake receipt");
  if (receipt.schema !== RECEIPT_SCHEMA || receipt.version !== "1.0.0" || receipt.status !== "PASS" || receipt.recipe_id !== recipe.id || receipt.family !== recipe.family || receipt.size !== recipe.size || receipt.deterministic !== true)
    fail("RECEIPT_INVALID", "machine bake receipt does not bind the PASS recipe");
  validateAuthority(result, receipt);

  const samplingContract = Object.fromEntries(pngs.map((png) => [png.id, clone(png.sampling)]));
  const artifactTransportDigests = Object.fromEntries(result.artifacts.map((artifact) => [artifact.id, artifact.digest]));
  return {
    schema: HANDOFF_SCHEMA,
    version: VERSION,
    status: "PASS",
    hand: { id: HAND_ID, version: HAND_VERSION },
    operation_mode: result.creation_recipe.operation_mode,
    result_digest: result.digest,
    recipe_digest: sha256(recipe),
    recipe_artifact_digest: recipeArtifact.digest,
    receipt_artifact_digest: receiptArtifact.digest,
    artifact_transport_digests: artifactTransportDigests,
    pngs,
    png_sha256: Object.fromEntries(pngs.map((png) => [png.id, png.byte_sha256])),
    sampling_contract: samplingContract,
    sampling_contract_digest: sha256(samplingContract),
    total_png_bytes: pngs.reduce((sum, png) => sum + png.bytes, 0),
    serialized_result_bytes: serializedBytes,
    budgets: { request_body_max_bytes: REQUEST_BODY_MAX_BYTES, response_body_max_bytes: RESPONSE_BODY_MAX_BYTES },
    authority: { candidate_only: true, installed: false, promoted: false, canonical: false, human_review_required: true },
    claims: {
      deterministic_png_bytes: true,
      technical_material_verification: true,
      dynamic_browser_render_observed: false,
      target_renderer_parity: false,
      physical_surface_verified: false,
      human_aesthetic_approval: false,
    },
  };
}

function gateResult(result) {
  try {
    return assertResult(result);
  } catch (error) {
    return {
      schema: HANDOFF_SCHEMA,
      version: VERSION,
      status: "FAIL",
      code: error && error.code ? error.code : "RESULT_CONTRACT_MISMATCH",
      message: error && error.message ? error.message : String(error),
      authority: { candidate_only: true, installed: false, promoted: false, canonical: false },
    };
  }
}

module.exports = {
  VERSION,
  HANDOFF_SCHEMA,
  RESULT_SCHEMA,
  HAND_ID,
  HAND_VERSION,
  RECIPE_SCHEMA,
  RECEIPT_SCHEMA,
  REQUEST_BODY_MAX_BYTES,
  RESPONSE_BODY_MAX_BYTES,
  NORMAL_CONVENTION,
  PNG_SPECS,
  canonicalStringify,
  sha256,
  assertResult,
  gateResult,
};
