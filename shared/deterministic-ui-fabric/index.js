"use strict";

const crypto = require("node:crypto");
const Core = require("../asset-hands/asset-hand-core");

const VERSION = "1.0.0";
const HANDOFF_SCHEMA = "axm.deterministic-ui-handoff/v1";
const RESULT_SCHEMA = "axm.asset-hand-result/v1";
const HAND_ID = "ui-component";
const HAND_VERSION = "1.2.0";
const RECIPE_SCHEMA = "axm.ui-component-recipe/v1";
const SPEC_SCHEMA = "axm.ui-component-spec/v1";
const REQUEST_BODY_MAX_BYTES = 256 * 1024;
const RESPONSE_BODY_MAX_BYTES = 2 * 1024 * 1024;
const STATES = Object.freeze(["default", "hover", "active", "disabled"]);
const KINDS = Object.freeze(["panel", "button", "hud", "ui-component"]);
const MEDIUMS = Object.freeze(["ui", "screen", "game-world"]);
const MODALITIES = Object.freeze(["pointer", "keyboard", "touch", "gamepad"]);

const ARTIFACT_SPECS = Object.freeze({
  "ui-source": Object.freeze({ role: "editable-source", mime: "image/svg+xml", format: "SVG", editable: true, schema: null }),
  "ui-metadata": Object.freeze({ role: "runtime-metadata", mime: "application/json", format: "JSON", editable: true, schema: SPEC_SCHEMA }),
  "ui-recipe": Object.freeze({ role: "editable-ui-recipe", mime: "application/json", format: "JSON", editable: true, schema: RECIPE_SCHEMA }),
});

class DeterministicUiHandoffError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DeterministicUiHandoffError";
    this.code = code;
  }
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
  const input = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === "string" ? value : canonicalStringify(value), "utf8");
  return crypto.createHash("sha256").update(input).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fail(code, message) {
  throw new DeterministicUiHandoffError(code, message);
}

function plain(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  return plain(value) && canonicalStringify(Object.keys(value).sort()) === canonicalStringify(expected.slice().sort());
}

function exact(actual, expected) {
  return canonicalStringify(actual) === canonicalStringify(expected);
}

function finite(value, minimum, maximum) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function hex(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function validateUniqueEnum(values, allowed) {
  return Array.isArray(values) && new Set(values).size === values.length && values.every((value) => allowed.includes(value));
}

function parseJsonArtifact(artifact, code, label) {
  if (typeof artifact.text !== "string" || artifact.dataUrl) fail("ARTIFACT_ENVELOPE_MISMATCH", label + " must use only a text payload");
  try { return JSON.parse(artifact.text); }
  catch (_error) { fail(code, label + " is not valid JSON"); }
}

function validateRecipe(recipe, result) {
  if (!exactKeys(recipe, ["schema", "version", "id", "title", "kind", "seed", "authority", "target", "palette", "geometry", "states", "provenance"]))
    fail("RECIPE_INVALID", "recipe fields exceed or miss the v1 allowlist");
  if (recipe.schema !== RECIPE_SCHEMA || recipe.version !== "1.0.0" || recipe.authority !== "candidate-only")
    fail(recipe.authority !== "candidate-only" ? "AUTHORITY_VIOLATION" : "RECIPE_INVALID", "recipe schema/version/authority mismatch");
  if (typeof recipe.id !== "string" || !recipe.id || recipe.id.length > 100 || typeof recipe.title !== "string" || !recipe.title || recipe.title.length > 120 || !KINDS.includes(recipe.kind) || typeof recipe.seed !== "string" || !recipe.seed || recipe.seed.length > 180)
    fail("RECIPE_INVALID", "recipe identity, kind or seed is invalid");
  const target = recipe.target;
  if (!exactKeys(target, ["medium", "dimensions", "transparency", "minimum_contrast_ratio", "direction", "input_modalities", "reduced_motion", "minimum_target_size", "alternative_text", "focus_visible", "focus_ring"]))
    fail("RECIPE_INVALID", "recipe target fields mismatch");
  if (!MEDIUMS.includes(target.medium) || !["required", "allowed", "opaque"].includes(target.transparency) || !["ltr", "rtl", "auto"].includes(target.direction) || !validateUniqueEnum(target.input_modalities, MODALITIES))
    fail("RECIPE_INVALID", "recipe target enum mismatch");
  if (!exactKeys(target.dimensions, ["width", "height", "unit"]) || target.dimensions.unit !== "px" || !finite(target.dimensions.width, 1, 8192) || !finite(target.dimensions.height, 1, 8192) || !finite(target.minimum_contrast_ratio, 1, 21) || !finite(target.minimum_target_size, 1, 1000))
    fail("RECIPE_INVALID", "recipe target dimensions/accessibility bounds mismatch");
  if (![target.reduced_motion, target.alternative_text, target.focus_visible].every((value) => typeof value === "boolean"))
    fail("RECIPE_INVALID", "recipe target booleans mismatch");
  if (!exactKeys(target.focus_ring, ["colour", "width"]) || !hex(target.focus_ring.colour) || !finite(target.focus_ring.width, 1, 16))
    fail("RECIPE_INVALID", "recipe focus ring mismatch");
  if (!exactKeys(recipe.palette, ["surface", "accent", "foreground", "attention"]) || !Object.values(recipe.palette).every(hex))
    fail("RECIPE_INVALID", "recipe palette mismatch");
  if (!exactKeys(recipe.geometry, ["inset", "radius", "nine_slice"]) || !finite(recipe.geometry.inset, 0, 8192) || !finite(recipe.geometry.radius, 0, Math.min(target.dimensions.width, target.dimensions.height) / 2))
    fail("RECIPE_INVALID", "recipe geometry mismatch");
  if (recipe.geometry.inset * 2 >= target.dimensions.width || recipe.geometry.inset * 2 >= target.dimensions.height)
    fail("RECIPE_INVALID", "recipe inset leaves no positive inner area");
  const slice = recipe.geometry.nine_slice;
  if (!exactKeys(slice, ["left", "top", "right", "bottom"]) || !Object.values(slice).every((value) => finite(value, 0, 8192)))
    fail("NINE_SLICE_INVALID", "nine-slice fields or bounds mismatch");
  if (slice.left + slice.right >= target.dimensions.width || slice.top + slice.bottom >= target.dimensions.height)
    fail("NINE_SLICE_INVALID", "nine-slice opposing edges leave no positive centre");
  if (!exactKeys(recipe.states, STATES)) fail("STATE_CONTRACT_MISMATCH", "exactly four named states are required");
  STATES.forEach((name) => {
    const state = recipe.states[name];
    if (!exactKeys(state, ["opacity", "scale"]) || !finite(state.opacity, 0, 1) || !finite(state.scale, 0.85, 1.15))
      fail("STATE_CONTRACT_MISMATCH", name + " state is invalid");
    if (target.reduced_motion && state.scale !== 1)
      fail("STATE_CONTRACT_MISMATCH", "reduced motion requires scale=1 for every state");
  });
  const mode = result.creation_recipe.operation_mode;
  const sources = result.creation_recipe.source_artifact_digests;
  if (mode === "create") {
    if (recipe.provenance !== null || !Array.isArray(sources) || sources.length !== 0)
      fail("RECIPE_BINDING_MISMATCH", "create recipe provenance/source lineage mismatch");
  } else if (mode === "edit") {
    if (!exactKeys(recipe.provenance, ["operation", "source_artifact_id", "source_recipe_digest"]) || recipe.provenance.operation !== "edit" || recipe.provenance.source_artifact_id !== "ui-recipe" || typeof recipe.provenance.source_recipe_digest !== "string")
      fail("RECIPE_BINDING_MISMATCH", "edit recipe provenance mismatch");
    if (!Array.isArray(sources) || sources.length !== 1 || sources[0].id !== "ui-recipe" || sources[0].content_schema !== RECIPE_SCHEMA || sources[0].digest !== recipe.provenance.source_recipe_digest)
      fail("RECIPE_BINDING_MISMATCH", "edit source lineage does not bind recipe provenance");
  } else fail("RECIPE_BINDING_MISMATCH", "creation recipe operation mode must be create or edit");
  const canvas = result.target_canvas || {};
  const dimensions = canvas.dimensions || {};
  const colour = canvas.colour || {};
  const responsive = canvas.responsive || {};
  const accessibility = canvas.accessibility || {};
  const expectedContrast = colour.minimum_contrast_ratio == null ? 4.5 : colour.minimum_contrast_ratio;
  const expectedMinimumTarget = responsive.minimum_target_size == null ? 44 : responsive.minimum_target_size;
  if (target.medium !== canvas.medium || target.dimensions.width !== dimensions.width || target.dimensions.height !== dimensions.height || target.dimensions.unit !== dimensions.unit || target.transparency !== colour.transparency || target.minimum_contrast_ratio !== expectedContrast || target.direction !== responsive.direction || !exact(target.input_modalities, responsive.input_modalities) || target.reduced_motion !== responsive.reduced_motion || target.minimum_target_size !== expectedMinimumTarget || target.alternative_text !== accessibility.alternative_text || target.focus_visible !== accessibility.focus_visible)
    fail("RECIPE_BINDING_MISMATCH", "recipe target does not bind effective target_canvas");
  if (!result.brief || recipe.id !== result.brief.id || recipe.title !== result.brief.title || recipe.kind !== result.brief.kind)
    fail("RECIPE_BINDING_MISMATCH", "recipe identity does not bind normalized brief");
}

function validateMetadata(metadata, recipe) {
  if (!exactKeys(metadata, ["schema", "legacy_schema", "name", "kind", "dimensions", "nineSlice", "states", "scalable", "stateStyles", "interaction", "tokens"]) || metadata.schema !== SPEC_SCHEMA || metadata.legacy_schema !== "axm.ui-asset-metadata/v1")
    fail("METADATA_INVALID", "UI metadata root contract mismatch");
  if (metadata.name !== recipe.title || metadata.kind !== recipe.kind || !exact(metadata.dimensions, { width: recipe.target.dimensions.width, height: recipe.target.dimensions.height }) || metadata.scalable !== true)
    fail("METADATA_INVALID", "UI metadata identity/dimensions mismatch");
  if (!exact(metadata.nineSlice, recipe.geometry.nine_slice)) fail("NINE_SLICE_INVALID", "metadata nine-slice does not bind recipe");
  if (!exact(metadata.states, STATES) || !exact(metadata.stateStyles, recipe.states)) fail("STATE_CONTRACT_MISMATCH", "metadata states do not bind recipe");
  const expectedInteraction = {
    minimumTargetSize: recipe.target.minimum_target_size,
    inputModalities: recipe.target.input_modalities,
    direction: recipe.target.direction,
    reducedMotion: recipe.target.reduced_motion,
    focusVisible: recipe.target.focus_visible,
    focusRing: recipe.target.focus_ring,
  };
  if (!exact(metadata.interaction, expectedInteraction)) fail("STATE_CONTRACT_MISMATCH", "interaction/focus contract does not bind recipe");
  const contrast = Core.accessiblePair(recipe.palette.surface, recipe.palette.foreground, recipe.target.minimum_contrast_ratio);
  const expectedTokens = {
    surface: contrast.background,
    accent: recipe.palette.accent,
    foreground: contrast.foreground,
    attention: recipe.palette.attention,
    radius: recipe.geometry.radius,
    contrastRatio: contrast.ratio,
    requestedPalette: recipe.palette,
  };
  if (!exact(metadata.tokens, expectedTokens)) fail("TOKEN_CONTRACT_MISMATCH", "effective/requested tokens do not bind recipe and contrast projection");
  return { contrast, normalized: contrast.background !== recipe.palette.surface || contrast.foreground !== recipe.palette.foreground };
}

function svgAttributes(text) {
  const root = String(text).match(/^\s*<svg\s+([^>]+)>/i);
  if (!root) fail("SVG_STRUCTURE_MISMATCH", "bounded root svg is required");
  const attributes = {};
  const pattern = /([:\w-]+)\s*=\s*(["'])(.*?)\2/g;
  let match;
  while ((match = pattern.exec(root[1]))) {
    if (Object.prototype.hasOwnProperty.call(attributes, match[1])) fail("SVG_STRUCTURE_MISMATCH", "duplicate SVG root attribute " + match[1]);
    attributes[match[1]] = match[3];
  }
  return attributes;
}

function validateSvg(svg, recipe, sourceArtifact, metadata) {
  if (typeof svg !== "string" || Buffer.byteLength(svg, "utf8") > 1024 * 1024 || !/<\/svg>\s*$/i.test(svg))
    fail("SVG_STRUCTURE_MISMATCH", "SVG must be complete and bounded to 1 MiB");
  if (/<!DOCTYPE|<!ENTITY|<\?xml|<script\b|<foreignObject\b|<iframe\b|<object\b|<embed\b|\son[a-z][\w:-]*\s*=|javascript:|@import/i.test(svg))
    fail("SVG_UNSAFE", "SVG contains executable, embedded or imported content");
  const links = [...svg.matchAll(/(?:href|src)\s*=\s*(["'])(.*?)\1/gi)].map((match) => match[2].trim());
  if (links.some((value) => !/^#[A-Za-z_][\w:.-]*$/.test(value)))
    fail("SVG_UNSAFE", "SVG href/src attributes must be local fragment references only");
  const urls = [...svg.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)].map((match) => match[2].trim());
  if (urls.some((value) => !/^#[A-Za-z_][\w:.-]*$/.test(value)))
    fail("SVG_UNSAFE", "SVG url() values must be local fragment references only");
  const ids = [...svg.matchAll(/\sid\s*=\s*(["'])(.*?)\1/gi)].map((match) => match[2]);
  if (new Set(ids).size !== ids.length || ids.some((id) => !/^[A-Za-z_][\w:.-]*$/.test(id)))
    fail("SVG_UNSAFE", "SVG ids must be valid and unique");
  const references = links.concat(urls).map((value) => value.slice(1));
  if (references.some((reference) => !ids.includes(reference))) fail("SVG_UNSAFE", "SVG contains an unresolved local reference");
  const attributes = svgAttributes(svg);
  const width = recipe.target.dimensions.width;
  const height = recipe.target.dimensions.height;
  if (attributes.xmlns !== "http://www.w3.org/2000/svg" || Number(attributes.width) !== width || Number(attributes.height) !== height || attributes.viewBox !== "0 0 " + width + " " + height || attributes.role !== "img" || !attributes["aria-label"] || attributes.direction !== recipe.target.direction)
    fail("SVG_STRUCTURE_MISMATCH", "SVG root dimensions/viewBox/accessibility/direction do not bind recipe");
  if (sourceArtifact.width !== width || sourceArtifact.height !== height || !plain(sourceArtifact.metadata) || !exactKeys(sourceArtifact.metadata, ["nineSlice"]) || !exact(sourceArtifact.metadata.nineSlice, recipe.geometry.nine_slice))
    fail("SVG_STRUCTURE_MISMATCH", "SVG artifact envelope does not bind recipe/nine-slice");
  if (sourceArtifact.metadata.schema != null) fail("ARTIFACT_ENVELOPE_MISMATCH", "ui-source must not advertise an unregistered SVG schema");
  if (!svg.includes(metadata.tokens.surface) || !svg.includes(metadata.tokens.accent))
    fail("SVG_STRUCTURE_MISMATCH", "SVG does not contain the effective surface/accent projection");
}

function validateArtifacts(result) {
  if (!Array.isArray(result.artifacts) || result.artifacts.length !== 3)
    fail("ARTIFACT_ENVELOPE_MISMATCH", "exactly three UI artifacts are required");
  const artifacts = new Map();
  result.artifacts.forEach((artifact) => {
    if (!plain(artifact) || typeof artifact.id !== "string" || artifacts.has(artifact.id))
      fail("ARTIFACT_ENVELOPE_MISMATCH", "artifact ids must be present and unique");
    artifacts.set(artifact.id, artifact);
  });
  Object.entries(ARTIFACT_SPECS).forEach(([id, spec]) => {
    const artifact = artifacts.get(id);
    if (!artifact || artifact.role !== spec.role || artifact.mime !== spec.mime || artifact.format !== spec.format || artifact.editable !== spec.editable || typeof artifact.digest !== "string" || !/^[a-f0-9]{8}$/i.test(artifact.digest))
      fail("ARTIFACT_ENVELOPE_MISMATCH", id + " envelope mismatch");
    if (typeof artifact.text !== "string" || !artifact.text || artifact.dataUrl)
      fail("ARTIFACT_ENVELOPE_MISMATCH", id + " must use only a text payload");
    if (spec.schema && (!plain(artifact.metadata) || artifact.metadata.schema !== spec.schema))
      fail("ARTIFACT_ENVELOPE_MISMATCH", id + " metadata schema mismatch");
  });
  return artifacts;
}

function validateAuthority(result) {
  if (!plain(result.hand) || result.hand.authority !== "candidate-only" || result.hand.installed === true || result.hand.promoted === true || result.hand.canonical === true || !plain(result.provenance) || result.provenance.authority !== "candidate-only")
    fail("AUTHORITY_VIOLATION", "result/hand must remain candidate-only and non-promoting");
}

function assertResult(result) {
  if (!plain(result)) fail("RESULT_NOT_REVIEWABLE", "whole Asset Hand result object is required");
  let serialized;
  try { serialized = JSON.stringify(result); }
  catch (_error) { fail("RESULT_NOT_REVIEWABLE", "result must be JSON serializable"); }
  const serializedBytes = Buffer.byteLength(serialized, "utf8");
  if (serializedBytes > RESPONSE_BODY_MAX_BYTES) fail("RESPONSE_BUDGET_EXCEEDED", "serialized result exceeds the 2 MiB handoff ceiling");
  if (result.schema !== RESULT_SCHEMA || !plain(result.hand) || result.hand.id !== HAND_ID || result.hand.version !== HAND_VERSION || typeof result.digest !== "string" || !/^[a-f0-9]{8}$/i.test(result.digest))
    fail("RESULT_NOT_REVIEWABLE", "result must be a ui-component@1.2.0 Asset Hand result");
  if (result.status !== "READY" || !plain(result.technical) || result.technical.pass !== true || !plain(result.validation_receipt) || result.validation_receipt.status !== "PASS")
    fail("RESULT_NOT_REVIEWABLE", "only READY/PASS technical candidates may enter sensory review");
  if (!plain(result.creation_recipe) || !["create", "edit"].includes(result.creation_recipe.operation_mode))
    fail("RECIPE_BINDING_MISMATCH", "creation recipe operation mode is missing");
  if (result.previewArtifactId !== "ui-source" || !plain(result.preview) || result.preview.artifactId !== "ui-source" || result.preview.available !== true)
    fail("ARTIFACT_ENVELOPE_MISMATCH", "ui-source static preview must be available");
  validateAuthority(result);
  const artifacts = validateArtifacts(result);
  const recipe = parseJsonArtifact(artifacts.get("ui-recipe"), "RECIPE_INVALID", "ui-recipe");
  validateRecipe(recipe, result);
  const metadata = parseJsonArtifact(artifacts.get("ui-metadata"), "METADATA_INVALID", "ui-metadata");
  const tokenProjection = validateMetadata(metadata, recipe);
  validateSvg(artifacts.get("ui-source").text, recipe, artifacts.get("ui-source"), metadata);

  const artifactList = result.artifacts.map((artifact) => ({
    id: artifact.id,
    role: artifact.role,
    mime: artifact.mime,
    format: artifact.format,
    editable: artifact.editable,
    schema: artifact.metadata && artifact.metadata.schema || null,
    transport_digest: artifact.digest,
    sha256: sha256(artifact.text),
    bytes: Buffer.byteLength(artifact.text, "utf8"),
  }));
  const warnings = [];
  if (tokenProjection.normalized) warnings.push({ code: "REQUESTED_PALETTE_NORMALIZED", requested: clone(recipe.palette), effective: clone(metadata.tokens) });
  return {
    schema: HANDOFF_SCHEMA,
    version: VERSION,
    status: "PASS",
    hand: { id: HAND_ID, version: HAND_VERSION },
    operation_mode: result.creation_recipe.operation_mode,
    result_digest: result.digest,
    recipe_digest: sha256(recipe),
    recipe_artifact_digest: artifacts.get("ui-recipe").digest,
    artifact_transport_digests: Object.fromEntries(artifactList.map((artifact) => [artifact.id, artifact.transport_digest])),
    artifact_sha256: Object.fromEntries(artifactList.map((artifact) => [artifact.id, artifact.sha256])),
    artifacts: artifactList,
    target: clone(recipe.target),
    state_contract: clone(recipe.states),
    nine_slice_contract: clone(recipe.geometry.nine_slice),
    token_contract: clone(metadata.tokens),
    preview: { artifact_id: "ui-source", available: true, static_visual_only: true, interactive_state_proof: false, nine_slice_runtime_proof: false },
    warnings,
    serialized_result_bytes: serializedBytes,
    budgets: { request_body_max_bytes: REQUEST_BODY_MAX_BYTES, response_body_max_bytes: RESPONSE_BODY_MAX_BYTES },
    authority: { candidate_only: true, installed: false, promoted: false, canonical: false, human_review_required: true },
    claims: {
      deterministic_artifacts: true,
      technical_contract_pass: true,
      static_svg_safe_for_inert_image_decode: true,
      interactive_browser_journey_observed: false,
      nine_slice_runtime_observed: false,
      physical_input_device_verified: false,
      assistive_technology_verified: false,
      target_runtime_parity: false,
      human_aesthetic_approval: false,
    },
  };
}

function gateResult(result) {
  try { return assertResult(result); }
  catch (error) {
    return {
      schema: HANDOFF_SCHEMA,
      version: VERSION,
      status: "FAIL",
      code: error && error.code ? error.code : "RESULT_NOT_REVIEWABLE",
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
  SPEC_SCHEMA,
  REQUEST_BODY_MAX_BYTES,
  RESPONSE_BODY_MAX_BYTES,
  ARTIFACT_SPECS,
  canonicalStringify,
  sha256,
  assertResult,
  gateResult,
};
