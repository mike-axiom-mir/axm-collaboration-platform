import {
  ALLOWED_PACK_FIELDS,
  FORBIDDEN_PACK_KEYS,
  LOCAL_CREATOR_POLICY,
  MATERIAL_LIMITS,
  PRESENTATION_CAPABILITIES
} from "./policy.mjs";
import { assertSafeObjectTree, sha256Hex } from "./stable.mjs";

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const RELEASE_PATTERN = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const CONTENT_HASH_PATTERN = /^sha256:([0-9a-f]{64})$/i;
const DATA_URI_PATTERN = /^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const DANGEROUS_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

const REQUIRED_PACK_FIELDS = Object.freeze([
  "type",
  "version",
  "id",
  "release",
  "status",
  "metadata",
  "scopes",
  "capabilities",
  "tokens",
  "materials",
  "bindings",
  "assets",
  "provenance"
]);
const METADATA_FIELDS = new Set([
  "name",
  "description",
  "creator",
  "license",
  "remixAllowed",
  "aiAssistance",
  "createdAt"
]);
const EXTENDS_FIELDS = new Set(["id", "release", "integrity"]);
const BINDING_FIELDS = new Set(["target", "material", "asset", "blueprint", "optional"]);
const ASSET_FIELDS = new Set([
  "mime",
  "role",
  "source",
  "sha256",
  "originalName",
  "provenance"
]);
const ASSET_SOURCE_FIELDS = new Set(["kind", "data", "hash"]);
const ACCESSIBILITY_FIELDS = new Set([
  "minimumTextContrast",
  "preserveGameplayCues",
  "reducedMotionSafe",
  "colorIsNotOnlySignal"
]);
const INTEGRITY_FIELDS = new Set(["algorithm", "canonicalization", "contentSha256"]);
const MATERIAL_COLOR_FIELDS = Object.freeze([
  "baseColor",
  "secondaryColor",
  "accentColor",
  "emissiveColor"
]);
const MATERIAL_FIELDS = new Set([
  ...Object.keys(MATERIAL_LIMITS),
  ...MATERIAL_COLOR_FIELDS,
  "pattern",
  "effectStack",
  "lightingRig"
]);
const PATTERN_FIELDS = new Set(["kind", "strength", "scale"]);
const EFFECT_STACK_FIELDS = new Set(["version", "layers", "fallback"]);
const EFFECT_LAYER_FIELDS = new Set([
  "id",
  "kind",
  "blendMode",
  "colorRole",
  "secondaryColorRole",
  "color",
  "secondaryColor",
  "mask",
  "opacity",
  "intensity",
  "radius",
  "spread",
  "threshold",
  "softness",
  "scale",
  "pattern",
  "motion"
]);
const EFFECT_KINDS = new Set([
  "fill",
  "texture",
  "inner-glow",
  "outer-glow",
  "rim-light",
  "shadow",
  "highlight",
  "bloom",
  "haze",
  "gradient"
]);
const EFFECT_BLEND_MODES = new Set([
  "normal",
  "screen",
  "add",
  "multiply",
  "soft-light"
]);
const COLOR_ROLES = new Set([
  "background",
  "surface",
  "primary",
  "secondary",
  "accent",
  "text",
  "mutedText",
  "shadow",
  "highlight"
]);
const EFFECT_MASKS = new Set([
  "full",
  "inside",
  "outside",
  "edge",
  "top",
  "bottom",
  "radial"
]);
const EFFECT_PATTERNS = new Set([
  "none",
  "paper-fiber",
  "grain",
  "circuit",
  "holo-grid",
  "ink-hatch"
]);
const EFFECT_MOTION_FIELDS = new Set(["kind", "speed", "amount"]);
const EFFECT_MOTION_KINDS = new Set(["none", "pulse", "shimmer", "drift"]);
const LIGHTING_RIG_FIELDS = new Set([
  "version",
  "ambient",
  "key",
  "fill",
  "rim",
  "shadows",
  "bloom",
  "haze",
  "exposure",
  "contrast",
]);
const LIGHT_FIELDS = new Set([
  "colorRole",
  "color",
  "intensity",
  "directionDegrees",
  "softness"
]);
const SHADOW_FIELDS = new Set(["strength", "softness"]);
const BLOOM_FIELDS = new Set(["intensity", "threshold", "radius"]);
const HAZE_FIELDS = new Set(["colorRole", "color", "density"]);
const CONTRACT_FIELDS = new Set([
  "type",
  "version",
  "gameId",
  "gameVersion",
  "adapterApi",
  "rendererProfile",
  "slots"
]);
const SLOT_FIELDS = new Set([
  "id",
  "kind",
  "required",
  "supportedProperties",
  "protectedCues",
  "constraints",
  "fallback",
  "adapterHints"
]);
const CONSTRAINT_FIELDS = new Set(["minimumOpacity", "minimumContrast"]);
const RESOLVED_FIELDS = new Set([
  "type",
  "version",
  "gameId",
  "gameVersion",
  "compatibility",
  "tokens",
  "slots",
  "accessibility",
  "presentationAuthority"
]);
const RESOLVED_SLOT_FIELDS = new Set(["kind", "material", "asset", "blueprint"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function byteLength(value) {
  return new TextEncoder().encode(
    typeof value === "string" ? value : JSON.stringify(value)
  ).byteLength;
}

function result() {
  return { errors: [], warnings: [], checks: [], metrics: {} };
}

function error(report, code, path, message) {
  report.errors.push({ code, path, message });
}

function warning(report, code, path, message) {
  report.warnings.push({ code, path, message });
}

function check(report, code, message) {
  report.checks.push({ code, message });
}

function requireFields(value, fields, report, path) {
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) {
      error(report, "MISSING_REQUIRED_FIELD", `${path}.${field}`, `${field} is required.`);
    }
  }
}

function rejectUnknownFields(value, allowed, report, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      error(report, "UNKNOWN_FIELD", `${path}.${key}`, `Unknown field "${key}" is denied.`);
    }
  }
}

function validateString(value, report, path, {
  minLength = 0,
  maxLength = Infinity,
  pattern = null
} = {}) {
  if (typeof value !== "string") {
    error(report, "INVALID_STRING", path, "Value must be a string.");
    return false;
  }
  if (value.length < minLength || value.length > maxLength) {
    error(
      report,
      "STRING_LENGTH",
      path,
      `String length must be between ${minLength} and ${maxLength}.`
    );
    return false;
  }
  if (pattern && !pattern.test(value)) {
    error(report, "STRING_PATTERN", path, "String does not match the required portable format.");
    return false;
  }
  return true;
}

function validateNumber(value, report, path, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    error(report, "NUMBER_OUT_OF_RANGE", path, `Value must be between ${minimum} and ${maximum}.`);
    return false;
  }
  return true;
}

function scanForbiddenKeys(value, report, path = "$", depth = 0, seen = new WeakSet()) {
  if (typeof value === "number" && !Number.isFinite(value)) {
    error(report, "NON_FINITE_NUMBER", path, "NaN and Infinity are not valid skin data.");
    return;
  }
  if (depth > 48) {
    error(report, "MAX_DEPTH", path, "Object nesting exceeds 48 levels.");
    return;
  }
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) {
    error(report, "CYCLIC_DATA", path, "Declarative skin data cannot contain cycles.");
    return;
  }
  seen.add(value);

  for (const [key, entry] of Object.entries(value)) {
    const keyPath = `${path}.${key}`;
    if (DANGEROUS_SEGMENTS.has(key) || FORBIDDEN_PACK_KEYS.has(key)) {
      error(
        report,
        "FORBIDDEN_KEY",
        keyPath,
        `"${key}" is outside the declarative presentation boundary.`
      );
    }
    scanForbiddenKeys(entry, report, keyPath, depth + 1, seen);
  }
  seen.delete(value);
}

function validatePattern(pattern, report, path) {
  if (!isPlainObject(pattern)) {
    error(report, "INVALID_PATTERN", path, "Pattern must be a declarative object.");
    return;
  }
  rejectUnknownFields(pattern, PATTERN_FIELDS, report, path);
  if ("kind" in pattern) {
    validateString(pattern.kind, report, `${path}.kind`, {
      minLength: 1,
      maxLength: 64,
      pattern: /^[a-z][a-z0-9.-]{0,63}$/
    });
  }
  if ("strength" in pattern) validateNumber(pattern.strength, report, `${path}.strength`, 0, 1);
  if ("scale" in pattern) validateNumber(pattern.scale, report, `${path}.scale`, 0.1, 16);
}

function validateEffectStack(stack, report, path, policy) {
  if (!isPlainObject(stack)) {
    error(report, "INVALID_EFFECT_STACK", path, "effectStack must be a declarative object.");
    return;
  }
  rejectUnknownFields(stack, EFFECT_STACK_FIELDS, report, path);
  requireFields(stack, ["version", "layers", "fallback"], report, path);
  if (stack.version !== "1.0") {
    error(report, "INVALID_EFFECT_STACK_VERSION", `${path}.version`, "effectStack version must be 1.0.");
  }
  if (stack.fallback !== "legacy-material-fields") {
    error(
      report,
      "INVALID_EFFECT_STACK_FALLBACK",
      `${path}.fallback`,
      "effectStack fallback must be legacy-material-fields."
    );
  }
  if (!Array.isArray(stack.layers)) {
    error(report, "INVALID_EFFECT_LAYERS", `${path}.layers`, "effectStack layers must be an array.");
    return;
  }
  const maximum = policy.maxEffectLayers ?? 8;
  if (stack.layers.length > maximum) {
    error(report, "TOO_MANY_EFFECT_LAYERS", path, `effectStack exceeds ${maximum} layers.`);
  }
  const ids = new Set();
  stack.layers.forEach((layer, index) => {
    const layerPath = `${path}.layers[${index}]`;
    if (!isPlainObject(layer)) {
      error(report, "INVALID_EFFECT_LAYER", layerPath, "Effect layer must be an object.");
      return;
    }
    rejectUnknownFields(layer, EFFECT_LAYER_FIELDS, report, layerPath);
    requireFields(layer, ["id", "kind", "blendMode", "colorRole"], report, layerPath);
    if ("id" in layer) {
      if (validateString(layer.id, report, `${layerPath}.id`, {
        minLength: 1,
        maxLength: 64,
        pattern: /^[a-z][a-z0-9._-]{0,63}$/
      })) {
        if (ids.has(layer.id)) {
          error(report, "DUPLICATE_EFFECT_LAYER", `${layerPath}.id`, "Effect IDs must be unique.");
        }
        ids.add(layer.id);
      }
    }
    if ("kind" in layer && !EFFECT_KINDS.has(layer.kind)) {
      error(report, "INVALID_EFFECT_KIND", `${layerPath}.kind`, "Unknown bounded effect kind.");
    }
    if ("blendMode" in layer && !EFFECT_BLEND_MODES.has(layer.blendMode)) {
      error(report, "INVALID_EFFECT_BLEND", `${layerPath}.blendMode`, "Unknown bounded blend mode.");
    }
    for (const field of ["colorRole", "secondaryColorRole"]) {
      if (field in layer && !COLOR_ROLES.has(layer[field])) {
        error(report, "INVALID_COLOR_ROLE", `${layerPath}.${field}`, "Unknown bounded color role.");
      }
    }
    for (const [field, minimum, maximum] of [
      ["opacity", 0, 1],
      ["intensity", 0, 1],
      ["radius", 0, 64],
      ["spread", 0, 32],
      ["threshold", 0, 1],
      ["softness", 0, 1],
      ["scale", 0.1, 16],
    ]) {
      if (field in layer) validateNumber(layer[field], report, `${layerPath}.${field}`, minimum, maximum);
    }
    for (const field of ["color", "secondaryColor"]) {
      if (field in layer && !COLOR_PATTERN.test(String(layer[field]))) {
        error(report, "INVALID_COLOR", `${layerPath}.${field}`, "Effect color must be six-digit hex.");
      }
    }
    if ("mask" in layer && !EFFECT_MASKS.has(layer.mask)) {
      error(report, "INVALID_EFFECT_MASK", `${layerPath}.mask`, "Unknown bounded effect mask.");
    }
    if ("pattern" in layer && !EFFECT_PATTERNS.has(layer.pattern)) {
      error(report, "INVALID_EFFECT_PATTERN", `${layerPath}.pattern`, "Unknown bounded effect pattern.");
    }
    if ("motion" in layer) {
      const motionPath = `${layerPath}.motion`;
      if (!isPlainObject(layer.motion)) {
        error(report, "INVALID_EFFECT_MOTION", motionPath, "Effect motion must be an object.");
      } else {
        rejectUnknownFields(layer.motion, EFFECT_MOTION_FIELDS, report, motionPath);
        requireFields(layer.motion, ["kind", "speed", "amount"], report, motionPath);
        if ("kind" in layer.motion && !EFFECT_MOTION_KINDS.has(layer.motion.kind)) {
          error(report, "INVALID_EFFECT_MOTION_KIND", `${motionPath}.kind`, "Unknown bounded motion kind.");
        }
        if ("speed" in layer.motion) validateNumber(layer.motion.speed, report, `${motionPath}.speed`, 0, 4);
        if ("amount" in layer.motion) validateNumber(layer.motion.amount, report, `${motionPath}.amount`, 0, 1);
      }
    }
  });
}

function validateLightingRig(rig, report, path) {
  if (!isPlainObject(rig)) {
    error(report, "INVALID_LIGHTING_RIG", path, "lightingRig must be an object.");
    return;
  }
  rejectUnknownFields(rig, LIGHTING_RIG_FIELDS, report, path);
  requireFields(rig, ["version"], report, path);
  if (rig.version !== "1.0") {
    error(report, "INVALID_LIGHTING_RIG_VERSION", `${path}.version`, "lightingRig version must be 1.0.");
  }
  for (const field of ["ambient", "key", "fill", "rim"]) {
    if (!(field in rig)) continue;
    const light = rig[field];
    const lightPath = `${path}.${field}`;
    if (!isPlainObject(light)) {
      error(report, "INVALID_LIGHT", lightPath, "Light declaration must be an object.");
      continue;
    }
    rejectUnknownFields(light, LIGHT_FIELDS, report, lightPath);
    requireFields(light, ["colorRole", "intensity"], report, lightPath);
    if ("colorRole" in light && !COLOR_ROLES.has(light.colorRole)) {
      error(report, "INVALID_COLOR_ROLE", `${lightPath}.colorRole`, "Unknown bounded color role.");
    }
    if ("color" in light && !COLOR_PATTERN.test(String(light.color))) {
      error(report, "INVALID_COLOR", `${lightPath}.color`, "Light color must be six-digit hex.");
    }
    if ("intensity" in light) validateNumber(light.intensity, report, `${lightPath}.intensity`, 0, 2);
    if ("directionDegrees" in light) {
      validateNumber(light.directionDegrees, report, `${lightPath}.directionDegrees`, 0, 360);
    }
    if ("softness" in light) validateNumber(light.softness, report, `${lightPath}.softness`, 0, 1);
  }
  if ("shadows" in rig) {
    const value = rig.shadows;
    const valuePath = `${path}.shadows`;
    if (!isPlainObject(value)) {
      error(report, "INVALID_SHADOWS", valuePath, "shadows must be an object.");
    } else {
      rejectUnknownFields(value, SHADOW_FIELDS, report, valuePath);
      requireFields(value, ["strength", "softness"], report, valuePath);
      if ("strength" in value) validateNumber(value.strength, report, `${valuePath}.strength`, 0, 1);
      if ("softness" in value) validateNumber(value.softness, report, `${valuePath}.softness`, 0, 1);
    }
  }
  if ("bloom" in rig) {
    const value = rig.bloom;
    const valuePath = `${path}.bloom`;
    if (!isPlainObject(value)) {
      error(report, "INVALID_BLOOM", valuePath, "bloom must be an object.");
    } else {
      rejectUnknownFields(value, BLOOM_FIELDS, report, valuePath);
      requireFields(value, ["intensity", "threshold", "radius"], report, valuePath);
      if ("intensity" in value) validateNumber(value.intensity, report, `${valuePath}.intensity`, 0, 1);
      if ("threshold" in value) validateNumber(value.threshold, report, `${valuePath}.threshold`, 0, 1);
      if ("radius" in value) validateNumber(value.radius, report, `${valuePath}.radius`, 0, 64);
    }
  }
  if ("haze" in rig) {
    const value = rig.haze;
    const valuePath = `${path}.haze`;
    if (!isPlainObject(value)) {
      error(report, "INVALID_HAZE", valuePath, "haze must be an object.");
    } else {
      rejectUnknownFields(value, HAZE_FIELDS, report, valuePath);
      requireFields(value, ["colorRole", "density"], report, valuePath);
      if ("colorRole" in value && !COLOR_ROLES.has(value.colorRole)) {
        error(report, "INVALID_COLOR_ROLE", `${valuePath}.colorRole`, "Unknown bounded color role.");
      }
      if ("color" in value && !COLOR_PATTERN.test(String(value.color))) {
        error(report, "INVALID_COLOR", `${valuePath}.color`, "Haze color must be six-digit hex.");
      }
      if ("density" in value) validateNumber(value.density, report, `${valuePath}.density`, 0, 1);
    }
  }
  for (const field of ["exposure", "contrast"]) {
    if (field in rig) validateNumber(rig[field], report, `${path}.${field}`, 0.5, 2);
  }
}

function validateMaterial(material, report, path, policy = LOCAL_CREATOR_POLICY) {
  if (!isPlainObject(material)) {
    error(report, "INVALID_MATERIAL", path, "Material must be an object.");
    return;
  }
  rejectUnknownFields(material, MATERIAL_FIELDS, report, path);

  for (const [key, bounds] of Object.entries(MATERIAL_LIMITS)) {
    if (key in material) {
      if (!Number.isFinite(material[key]) || material[key] < bounds[0] || material[key] > bounds[1]) {
        error(
          report,
          "MATERIAL_VALUE_OUT_OF_RANGE",
          `${path}.${key}`,
          `${key} must be a finite number between ${bounds[0]} and ${bounds[1]}.`
        );
      }
    }
  }

  for (const key of MATERIAL_COLOR_FIELDS) {
    if (key in material && !COLOR_PATTERN.test(String(material[key]))) {
      error(report, "INVALID_COLOR", `${path}.${key}`, `${key} must use six-digit hexadecimal color.`);
    }
  }
  if ("pattern" in material) validatePattern(material.pattern, report, `${path}.pattern`);
  if ("effectStack" in material) {
    validateEffectStack(material.effectStack, report, `${path}.effectStack`, policy);
  }
  if ("lightingRig" in material) validateLightingRig(material.lightingRig, report, `${path}.lightingRig`);
}

function validateAsset(assetId, asset, report, policy, path = `$.assets.${assetId}`) {
  if (!ID_PATTERN.test(assetId)) {
    error(report, "INVALID_ASSET_ID", path, "Asset ID must be a portable lowercase identifier.");
  }
  if (!isPlainObject(asset)) {
    error(report, "INVALID_ASSET", path, "Asset must be an object.");
    return 0;
  }
  rejectUnknownFields(asset, ASSET_FIELDS, report, path);
  requireFields(asset, ["mime", "role", "source", "sha256", "provenance"], report, path);

  if (!policy.allowedAssetMimes.includes(asset.mime)) {
    error(report, "ASSET_MIME_DENIED", `${path}.mime`, `MIME ${asset.mime ?? "(missing)"} is not allowed.`);
  }
  if (!["texture", "sprite", "decal", "portrait", "ui"].includes(asset.role)) {
    error(report, "ASSET_ROLE_DENIED", `${path}.role`, "Asset role is missing or unsupported.");
  }
  if (!SHA256_PATTERN.test(asset.sha256 ?? "")) {
    error(report, "INVALID_ASSET_HASH", `${path}.sha256`, "Asset requires a 64-character SHA-256 digest.");
  }
  if ("originalName" in asset) {
    if (validateString(asset.originalName, report, `${path}.originalName`, { maxLength: 120 })) {
      if (/[/\\:\u0000-\u001f]/.test(asset.originalName) || asset.originalName.includes("..")) {
        error(
          report,
          "UNSAFE_ORIGINAL_NAME",
          `${path}.originalName`,
          "Original filename is inert metadata and must not contain paths or control characters."
        );
      }
    }
  }
  if (!isPlainObject(asset.provenance)) {
    error(report, "INVALID_ASSET_PROVENANCE", `${path}.provenance`, "Asset provenance must be an object.");
  }
  if (!isPlainObject(asset.source)) {
    error(report, "INVALID_ASSET_SOURCE", `${path}.source`, "Asset source must be declared.");
    return 0;
  }
  rejectUnknownFields(asset.source, ASSET_SOURCE_FIELDS, report, `${path}.source`);
  requireFields(asset.source, ["kind"], report, `${path}.source`);

  if (asset.source.kind === "embedded-data") {
    if (!Object.hasOwn(asset.source, "data") || Object.hasOwn(asset.source, "hash")) {
      error(
        report,
        "INVALID_EMBEDDED_SOURCE",
        `${path}.source`,
        "Embedded sources require data and may not declare a content hash."
      );
    }
    const match = DATA_URI_PATTERN.exec(asset.source.data ?? "");
    if (!match) {
      error(report, "INVALID_DATA_URI", `${path}.source.data`, "Embedded assets require a base64 data URI.");
      return 0;
    }
    if (match[1].toLowerCase() !== String(asset.mime).toLowerCase()) {
      error(report, "MIME_MISMATCH", `${path}.source.data`, "Data URI MIME does not match the declaration.");
    }
    const compact = match[2].replace(/\s/g, "");
    const padding = compact.endsWith("==") ? 2 : compact.endsWith("=") ? 1 : 0;
    const approximateBytes = Math.max(0, Math.floor((compact.length * 3) / 4) - padding);
    if (approximateBytes > policy.maxEmbeddedAssetBytes) {
      error(
        report,
        "ASSET_TOO_LARGE",
        `${path}.source.data`,
        `Embedded asset exceeds ${policy.maxEmbeddedAssetBytes} bytes.`
      );
    }
    return approximateBytes;
  }

  if (asset.source.kind === "content-hash") {
    if (!Object.hasOwn(asset.source, "hash") || Object.hasOwn(asset.source, "data")) {
      error(
        report,
        "INVALID_CONTENT_HASH_SOURCE",
        `${path}.source`,
        "Content-hash sources require hash and may not embed data."
      );
      return 0;
    }
    const match = CONTENT_HASH_PATTERN.exec(asset.source.hash ?? "");
    if (!match) {
      error(report, "INVALID_CONTENT_HASH", `${path}.source.hash`, "Content hash must be sha256:<64 hex>.");
    } else if (SHA256_PATTERN.test(asset.sha256 ?? "") && match[1].toLowerCase() !== asset.sha256.toLowerCase()) {
      error(
        report,
        "CONTENT_HASH_MISMATCH",
        `${path}.source.hash`,
        "Content-addressed source hash must match the declared asset hash."
      );
    }
    return 0;
  }

  error(
    report,
    "ASSET_SOURCE_DENIED",
    `${path}.source.kind`,
    "Remote, path, and executable asset sources are denied."
  );
  return 0;
}

function validateMetadata(metadata, report) {
  if (!isPlainObject(metadata)) {
    error(report, "INVALID_METADATA", "$.metadata", "metadata is required.");
    return;
  }
  rejectUnknownFields(metadata, METADATA_FIELDS, report, "$.metadata");
  requireFields(metadata, ["name", "creator", "license", "remixAllowed"], report, "$.metadata");
  if ("name" in metadata) validateString(metadata.name, report, "$.metadata.name", { minLength: 1, maxLength: 80 });
  if ("description" in metadata) validateString(metadata.description, report, "$.metadata.description", { maxLength: 500 });
  if ("creator" in metadata) validateString(metadata.creator, report, "$.metadata.creator", { minLength: 1, maxLength: 160 });
  if ("license" in metadata) validateString(metadata.license, report, "$.metadata.license", { maxLength: 80 });
  if ("remixAllowed" in metadata && typeof metadata.remixAllowed !== "boolean") {
    error(report, "INVALID_REMIX_FLAG", "$.metadata.remixAllowed", "remixAllowed must be boolean.");
  }
  if ("aiAssistance" in metadata) validateString(metadata.aiAssistance, report, "$.metadata.aiAssistance", { maxLength: 120 });
  if ("createdAt" in metadata && metadata.createdAt !== null && typeof metadata.createdAt !== "string") {
    error(report, "INVALID_CREATED_AT", "$.metadata.createdAt", "createdAt must be a string or null.");
  }
}

function validateIntegrityDeclaration(integrity, report) {
  if (integrity === null || integrity === undefined) return;
  if (!isPlainObject(integrity)) {
    error(report, "INVALID_INTEGRITY", "$.integrity", "integrity must be null or an object.");
    return;
  }
  rejectUnknownFields(integrity, INTEGRITY_FIELDS, report, "$.integrity");
  requireFields(integrity, [...INTEGRITY_FIELDS], report, "$.integrity");
  if (integrity.algorithm !== "sha256") {
    error(report, "INVALID_INTEGRITY_ALGORITHM", "$.integrity.algorithm", "Only sha256 is supported.");
  }
  if (integrity.canonicalization !== "axm-stable-json-v1") {
    error(
      report,
      "INVALID_CANONICALIZATION",
      "$.integrity.canonicalization",
      "Only axm-stable-json-v1 is supported."
    );
  }
  if (!SHA256_PATTERN.test(integrity.contentSha256 ?? "")) {
    error(report, "INVALID_CONTENT_DIGEST", "$.integrity.contentSha256", "Digest must be 64 hex characters.");
  }
}

export function validateSkinPack(pack, policy = LOCAL_CREATOR_POLICY) {
  const report = result();

  if (!isPlainObject(pack)) {
    error(report, "NOT_AN_OBJECT", "$", "Skin pack must be a JSON object.");
    return { ok: false, ...report };
  }
  try {
    assertSafeObjectTree(pack);
  } catch (cause) {
    error(
      report,
      cause.message.startsWith("Unsafe object key")
        ? "FORBIDDEN_KEY"
        : "UNSAFE_DECLARATIVE_DATA",
      "$",
      `Skin data must contain only safe data properties: ${cause.message}`
    );
    return { ok: false, ...report };
  }

  try {
    const packBytes = byteLength(pack);
    report.metrics.packBytes = packBytes;
    if (packBytes > policy.maxPackBytes) {
      error(report, "PACK_TOO_LARGE", "$", `Pack exceeds ${policy.maxPackBytes} bytes.`);
    }
  } catch (cause) {
    error(report, "UNSERIALIZABLE_PACK", "$", `Pack is not canonical JSON: ${cause.message}`);
  }

  if (!policy.allowUnknownTopLevelFields) {
    for (const key of Object.keys(pack)) {
      if (!ALLOWED_PACK_FIELDS.has(key)) {
        error(report, "UNKNOWN_TOP_LEVEL_FIELD", `$.${key}`, `Unknown field "${key}" is denied by policy.`);
      }
    }
  }
  requireFields(pack, REQUIRED_PACK_FIELDS, report, "$");
  scanForbiddenKeys(pack, report);

  if (pack.type !== "axm.skin-pack") error(report, "INVALID_TYPE", "$.type", "type must be axm.skin-pack.");
  if (pack.version !== "1.0") error(report, "UNSUPPORTED_VERSION", "$.version", "Only schema version 1.0 is supported.");
  if (!ID_PATTERN.test(pack.id ?? "")) error(report, "INVALID_ID", "$.id", "Pack ID is missing or invalid.");
  if (!RELEASE_PATTERN.test(pack.release ?? "")) {
    error(report, "INVALID_RELEASE", "$.release", "release must be semantic version text.");
  }
  if (!["DRAFT", "WORKING_TEST", "TEST_HOLD_REVIEW"].includes(pack.status)) {
    error(report, "INVALID_STATUS", "$.status", "Status must remain a non-canon working label.");
  }

  validateMetadata(pack.metadata, report);

  if (pack.extends !== undefined && pack.extends !== null) {
    if (!isPlainObject(pack.extends)) {
      error(report, "INVALID_EXTENDS", "$.extends", "extends must be null or a pack reference.");
    } else {
      rejectUnknownFields(pack.extends, EXTENDS_FIELDS, report, "$.extends");
      requireFields(pack.extends, [...EXTENDS_FIELDS], report, "$.extends");
      if (!ID_PATTERN.test(pack.extends.id ?? "")) error(report, "INVALID_EXTENDS_ID", "$.extends.id", "Extended pack ID is invalid.");
      if (!RELEASE_PATTERN.test(pack.extends.release ?? "")) error(report, "INVALID_EXTENDS_RELEASE", "$.extends.release", "Extended release is invalid.");
      if (!SHA256_PATTERN.test(pack.extends.integrity ?? "")) error(report, "INVALID_EXTENDS_HASH", "$.extends.integrity", "Extended pack hash is invalid.");
    }
  }

  if (!Array.isArray(pack.scopes) || pack.scopes.length === 0) {
    error(report, "INVALID_SCOPES", "$.scopes", "At least one presentation scope is required.");
  } else {
    const scopes = new Set();
    pack.scopes.forEach((scope, index) => {
      if (validateString(scope, report, `$.scopes[${index}]`, { minLength: 1, maxLength: 100 })) {
        if (scopes.has(scope)) error(report, "DUPLICATE_SCOPE", `$.scopes[${index}]`, "Scopes must be unique.");
        scopes.add(scope);
      }
    });
  }

  if (!Array.isArray(pack.capabilities)) {
    error(report, "INVALID_CAPABILITIES", "$.capabilities", "capabilities must be an array.");
  } else {
    const capabilities = new Set();
    pack.capabilities.forEach((capability, index) => {
      if (!PRESENTATION_CAPABILITIES.includes(capability)) {
        error(report, "UNKNOWN_CAPABILITY", `$.capabilities[${index}]`, `Capability "${capability}" is not allowed.`);
      }
      if (capabilities.has(capability)) {
        error(report, "DUPLICATE_CAPABILITY", `$.capabilities[${index}]`, "Capabilities must be unique.");
      }
      capabilities.add(capability);
    });
  }

  if (!isPlainObject(pack.parameters ?? {})) {
    error(report, "INVALID_PARAMETERS", "$.parameters", "parameters must be an object when present.");
  }
  if (!isPlainObject(pack.tokens)) {
    error(report, "INVALID_TOKENS", "$.tokens", "tokens must be an object.");
  }

  if (!isPlainObject(pack.materials)) {
    error(report, "INVALID_MATERIALS", "$.materials", "materials must be an object.");
  } else {
    const materials = Object.entries(pack.materials);
    report.metrics.materialCount = materials.length;
    if (materials.length > (policy.maxMaterials ?? 256)) {
      error(report, "TOO_MANY_MATERIALS", "$.materials", "Material count exceeds policy.");
    }
    for (const [materialId, material] of materials) {
      if (!ID_PATTERN.test(materialId)) {
        error(report, "INVALID_MATERIAL_ID", `$.materials.${materialId}`, "Material ID is not portable.");
      }
      validateMaterial(material, report, `$.materials.${materialId}`, policy);
    }
  }

  if (!Array.isArray(pack.bindings)) {
    error(report, "INVALID_BINDINGS", "$.bindings", "bindings must be an array.");
  } else {
    if (pack.bindings.length > (policy.maxBindings ?? 512)) {
      error(report, "TOO_MANY_BINDINGS", "$.bindings", "Binding count exceeds policy.");
    }
    const targets = new Set();
    for (const [index, binding] of pack.bindings.entries()) {
      const path = `$.bindings[${index}]`;
      if (!isPlainObject(binding)) {
        error(report, "INVALID_BINDING", path, "Binding must be an object.");
        continue;
      }
      rejectUnknownFields(binding, BINDING_FIELDS, report, path);
      requireFields(binding, ["target", "material"], report, path);
      if (!ID_PATTERN.test(binding.target ?? "")) {
        error(report, "INVALID_BINDING_TARGET", `${path}.target`, "Binding target is invalid.");
      }
      if (targets.has(binding.target)) {
        error(report, "DUPLICATE_BINDING", `${path}.target`, "A pack may bind a target only once.");
      }
      targets.add(binding.target);
      if (!ID_PATTERN.test(binding.material ?? "")) {
        error(report, "INVALID_BINDING_MATERIAL", `${path}.material`, "Binding material ID is invalid.");
      } else if (!(binding.material in (pack.materials ?? {}))) {
        error(report, "MISSING_MATERIAL", `${path}.material`, "Binding references an unknown material.");
      }
      if ("asset" in binding) {
        if (!ID_PATTERN.test(binding.asset ?? "")) {
          error(report, "INVALID_BINDING_ASSET", `${path}.asset`, "Binding asset ID is invalid.");
        } else if (!(binding.asset in (pack.assets ?? {}))) {
          error(report, "MISSING_ASSET", `${path}.asset`, "Binding references an unknown asset.");
        }
      }
      if ("blueprint" in binding && !ID_PATTERN.test(binding.blueprint ?? "")) {
        error(report, "INVALID_BINDING_BLUEPRINT", `${path}.blueprint`, "Blueprint ID is invalid.");
      }
      if ("optional" in binding && typeof binding.optional !== "boolean") {
        error(report, "INVALID_BINDING_OPTIONAL", `${path}.optional`, "optional must be boolean.");
      }
    }
  }

  if (!isPlainObject(pack.assets)) {
    error(report, "INVALID_ASSETS", "$.assets", "assets must be an object.");
  } else {
    const assets = Object.entries(pack.assets);
    report.metrics.assetCount = assets.length;
    if (assets.length > policy.maxAssets) {
      error(report, "TOO_MANY_ASSETS", "$.assets", `Asset count exceeds ${policy.maxAssets}.`);
    }
    let embeddedBytes = 0;
    for (const [assetId, asset] of assets) {
      embeddedBytes += validateAsset(assetId, asset, report, policy);
    }
    report.metrics.embeddedAssetBytes = embeddedBytes;
    if (embeddedBytes > policy.maxTotalEmbeddedBytes) {
      error(report, "EMBEDDED_TOTAL_TOO_LARGE", "$.assets", "Total embedded asset bytes exceed policy.");
    }
  }

  if ("characterBlueprints" in pack && !isPlainObject(pack.characterBlueprints)) {
    error(report, "INVALID_CHARACTER_BLUEPRINTS", "$.characterBlueprints", "characterBlueprints must be an object.");
  }

  if ("accessibility" in pack) {
    if (!isPlainObject(pack.accessibility)) {
      error(report, "INVALID_ACCESSIBILITY", "$.accessibility", "accessibility must be an object.");
    } else {
      rejectUnknownFields(pack.accessibility, ACCESSIBILITY_FIELDS, report, "$.accessibility");
      if ("minimumTextContrast" in pack.accessibility) {
        validateNumber(pack.accessibility.minimumTextContrast, report, "$.accessibility.minimumTextContrast", 1, 21);
      }
      for (const field of ["preserveGameplayCues", "reducedMotionSafe", "colorIsNotOnlySignal"]) {
        if (field in pack.accessibility && typeof pack.accessibility[field] !== "boolean") {
          error(report, "INVALID_ACCESSIBILITY_FLAG", `$.accessibility.${field}`, `${field} must be boolean.`);
        }
      }
    }
  }

  if (!isPlainObject(pack.provenance)) {
    error(report, "MISSING_PROVENANCE", "$.provenance", "A provenance record is required.");
  } else {
    requireFields(pack.provenance, ["origin"], report, "$.provenance");
    if ("origin" in pack.provenance) {
      validateString(pack.provenance.origin, report, "$.provenance.origin", { minLength: 1, maxLength: 120 });
    }
    if ("compiler" in pack.provenance) validateString(pack.provenance.compiler, report, "$.provenance.compiler", { maxLength: 120 });
    if ("seed" in pack.provenance) validateString(pack.provenance.seed, report, "$.provenance.seed", { maxLength: 120 });
    if (!pack.provenance.seed && pack.provenance.origin === "deterministic-recipe") {
      error(report, "MISSING_SEED", "$.provenance.seed", "Deterministic recipes require a recorded seed.");
    }
    if ("sourceAssetHashes" in pack.provenance) {
      if (!Array.isArray(pack.provenance.sourceAssetHashes)) {
        error(report, "INVALID_SOURCE_HASHES", "$.provenance.sourceAssetHashes", "sourceAssetHashes must be an array.");
      } else {
        pack.provenance.sourceAssetHashes.forEach((digest, index) => {
          if (!SHA256_PATTERN.test(digest ?? "")) {
            error(report, "INVALID_SOURCE_HASH", `$.provenance.sourceAssetHashes[${index}]`, "Source hash must be SHA-256 hex.");
          }
        });
      }
    }
  }

  validateIntegrityDeclaration(pack.integrity, report);
  if (policy.requireLicenseDeclaration && !pack.metadata?.license) {
    error(report, "LICENSE_REQUIRED", "$.metadata.license", "Policy requires a license declaration.");
  }
  if (policy.requireIntegrity && !pack.integrity?.contentSha256) {
    error(report, "INTEGRITY_REQUIRED", "$.integrity", "Policy requires an integrity digest.");
  }

  check(report, "PRESENTATION_ONLY_SCAN", "Forbidden authority and executable keys were scanned.");
  check(report, "DECLARATIVE_ASSET_SCAN", "Asset sources and MIME declarations were checked.");
  check(report, "MATERIAL_BOUNDS_SCAN", "Material and treatment parameters were checked against finite bounds.");
  return { ok: report.errors.length === 0, ...report };
}

export function validateGameSkinContract(contract) {
  const report = result();
  if (!isPlainObject(contract)) {
    error(report, "NOT_AN_OBJECT", "$", "Game skin contract must be an object.");
    return { ok: false, ...report };
  }
  try {
    assertSafeObjectTree(contract);
  } catch (cause) {
    error(
      report,
      "UNSAFE_DECLARATIVE_DATA",
      "$",
      `Game contracts must contain only safe data properties: ${cause.message}`
    );
    return { ok: false, ...report };
  }
  rejectUnknownFields(contract, CONTRACT_FIELDS, report, "$");
  requireFields(contract, ["type", "version", "gameId", "gameVersion", "adapterApi", "slots"], report, "$");
  scanForbiddenKeys(contract, report);
  if (contract.type !== "axm.game-skin-contract") {
    error(report, "INVALID_TYPE", "$.type", "type must be axm.game-skin-contract.");
  }
  if (contract.version !== "1.0") {
    error(report, "UNSUPPORTED_VERSION", "$.version", "Only contract version 1.0 is supported.");
  }
  if (!ID_PATTERN.test(contract.gameId ?? "")) error(report, "INVALID_GAME_ID", "$.gameId", "gameId is invalid.");
  if (!RELEASE_PATTERN.test(contract.gameVersion ?? "")) {
    error(report, "INVALID_GAME_VERSION", "$.gameVersion", "gameVersion must be semantic version text.");
  }
  if (contract.adapterApi !== "axm.style-adapter.v1") {
    error(report, "INVALID_ADAPTER_API", "$.adapterApi", "adapterApi must be axm.style-adapter.v1.");
  }
  if ("rendererProfile" in contract) {
    validateString(contract.rendererProfile, report, "$.rendererProfile", { minLength: 1, maxLength: 120 });
  }
  if (!Array.isArray(contract.slots)) {
    error(report, "INVALID_SLOTS", "$.slots", "slots must be an array.");
  } else {
    if (contract.slots.length > 256) error(report, "TOO_MANY_SLOTS", "$.slots", "Contract exceeds 256 slots.");
    const ids = new Set();
    for (const [index, slot] of contract.slots.entries()) {
      const path = `$.slots[${index}]`;
      if (!isPlainObject(slot)) {
        error(report, "INVALID_SLOT", path, "Slot must be an object.");
        continue;
      }
      rejectUnknownFields(slot, SLOT_FIELDS, report, path);
      requireFields(
        slot,
        ["id", "kind", "required", "supportedProperties", "protectedCues", "constraints", "fallback"],
        report,
        path
      );
      if (!ID_PATTERN.test(slot.id ?? "")) error(report, "INVALID_SLOT_ID", `${path}.id`, "Slot ID is invalid.");
      if (ids.has(slot.id)) error(report, "DUPLICATE_SLOT", `${path}.id`, "Slot IDs must be unique.");
      ids.add(slot.id);
      if (!["surface", "character-region", "ui", "fx", "audio"].includes(slot.kind)) {
        error(report, "INVALID_SLOT_KIND", `${path}.kind`, "Slot kind is unsupported.");
      }
      if (typeof slot.required !== "boolean") {
        error(report, "INVALID_REQUIRED_FLAG", `${path}.required`, "required must be boolean.");
      }
      if (!Array.isArray(slot.supportedProperties)) {
        error(report, "INVALID_PROPERTY_LIST", `${path}.supportedProperties`, "supportedProperties must be an array.");
      } else {
        const properties = new Set();
        slot.supportedProperties.forEach((property, propertyIndex) => {
          const propertyPath = `${path}.supportedProperties[${propertyIndex}]`;
          if (typeof property !== "string" || !MATERIAL_FIELDS.has(property)) {
            error(report, "UNKNOWN_MATERIAL_PROPERTY", propertyPath, `Unsupported material property "${property}".`);
          }
          if (properties.has(property)) error(report, "DUPLICATE_MATERIAL_PROPERTY", propertyPath, "Properties must be unique.");
          properties.add(property);
        });
      }
      if (!Array.isArray(slot.protectedCues)) {
        error(report, "INVALID_PROTECTED_CUES", `${path}.protectedCues`, "protectedCues must be an array.");
      } else {
        const cues = new Set();
        slot.protectedCues.forEach((cue, cueIndex) => {
          if (validateString(cue, report, `${path}.protectedCues[${cueIndex}]`, { minLength: 1, maxLength: 100 })) {
            if (cues.has(cue)) error(report, "DUPLICATE_PROTECTED_CUE", `${path}.protectedCues[${cueIndex}]`, "Protected cues must be unique.");
            cues.add(cue);
          }
        });
      }
      if (!isPlainObject(slot.constraints)) {
        error(report, "INVALID_CONSTRAINTS", `${path}.constraints`, "constraints must be an object.");
      } else {
        rejectUnknownFields(slot.constraints, CONSTRAINT_FIELDS, report, `${path}.constraints`);
        if ("minimumOpacity" in slot.constraints) {
          validateNumber(slot.constraints.minimumOpacity, report, `${path}.constraints.minimumOpacity`, 0, 1);
        }
        if ("minimumContrast" in slot.constraints) {
          validateNumber(slot.constraints.minimumContrast, report, `${path}.constraints.minimumContrast`, 1, 21);
        }
      }
      if (!isPlainObject(slot.fallback) || Object.keys(slot.fallback).length === 0) {
        error(report, "MISSING_FALLBACK", `${path}.fallback`, "Every slot needs a non-empty game-owned fallback.");
      } else {
        validateMaterial(slot.fallback, report, `${path}.fallback`);
      }
      if ("adapterHints" in slot && !isPlainObject(slot.adapterHints)) {
        error(report, "INVALID_ADAPTER_HINTS", `${path}.adapterHints`, "adapterHints must be an object.");
      }
    }
  }
  return { ok: report.errors.length === 0, ...report };
}

export function packWithoutIntegrity(pack) {
  assertSafeObjectTree(pack);
  const copy = structuredClone(pack);
  copy.integrity = null;
  return copy;
}

export async function calculateSkinIntegrity(pack) {
  assertSafeObjectTree(pack);
  return {
    algorithm: "sha256",
    canonicalization: "axm-stable-json-v1",
    contentSha256: await sha256Hex(packWithoutIntegrity(pack))
  };
}

export async function verifySkinIntegrity(pack) {
  try {
    assertSafeObjectTree(pack);
  } catch (cause) {
    return {
      ok: false,
      status: "INTEGRITY_INVALID",
      expected: null,
      actual: null,
      error: cause.message
    };
  }
  if (pack?.integrity === null || pack?.integrity === undefined) {
    return {
      ok: false,
      status: "UNSIGNED",
      expected: null,
      actual: await sha256Hex(packWithoutIntegrity(pack))
    };
  }
  if (
    !isPlainObject(pack.integrity) ||
    pack.integrity.algorithm !== "sha256" ||
    pack.integrity.canonicalization !== "axm-stable-json-v1" ||
    !SHA256_PATTERN.test(pack.integrity.contentSha256 ?? "")
  ) {
    return { ok: false, status: "INTEGRITY_INVALID", expected: pack.integrity?.contentSha256 ?? null, actual: null };
  }
  const actual = await sha256Hex(packWithoutIntegrity(pack));
  return {
    ok: actual === pack.integrity.contentSha256,
    status: actual === pack.integrity.contentSha256 ? "INTEGRITY_VERIFIED" : "INTEGRITY_FAILED",
    expected: pack.integrity.contentSha256,
    actual
  };
}

function decodeBase64(value) {
  const compact = String(value).replace(/\s/g, "");
  const binary = atob(compact);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function readUint24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function ascii(bytes, start, end) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function inspectPng(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 45 || !signature.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawImageData = false;
  let imageDataBytes = 0;
  let sawEnd = false;

  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) return null;
    const type = ascii(bytes, offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) return null;

    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13) return null;
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
      const bitDepth = bytes[offset + 16];
      const colorType = bytes[offset + 17];
      const allowedDepths = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16]
      };
      if (
        width === 0 ||
        height === 0 ||
        !allowedDepths[colorType]?.includes(bitDepth) ||
        bytes[offset + 18] !== 0 ||
        bytes[offset + 19] !== 0 ||
        ![0, 1].includes(bytes[offset + 20])
      ) {
        return null;
      }
      sawHeader = true;
    } else if (type === "IHDR") {
      return null;
    } else if (type === "IDAT") {
      if (sawEnd) return null;
      sawImageData = true;
      imageDataBytes += length;
    } else if (type === "IEND") {
      if (length !== 0 || !sawImageData || imageDataBytes === 0) return null;
      sawEnd = true;
      if (end !== bytes.length) return null;
    }

    offset = end;
    if (sawEnd) break;
  }
  return sawHeader && sawImageData && sawEnd
    ? { mime: "image/png", width, height }
    : null;
}

function inspectJpeg(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
    return null;
  }
  let offset = 2;
  let width = 0;
  let height = 0;
  let sawScan = false;
  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
  ]);
  while (offset + 3 < bytes.length - 2) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    if (marker === 0x00) {
      offset += 1;
      continue;
    }
    if (marker === 0xd9) break;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 1;
      continue;
    }
    if (offset + 2 >= bytes.length) return null;
    const length = (bytes[offset + 1] << 8) | bytes[offset + 2];
    if (length < 2 || offset + 1 + length > bytes.length) return null;
    if (sofMarkers.has(marker)) {
      if (length < 7) return null;
      height = (bytes[offset + 4] << 8) | bytes[offset + 5];
      width = (bytes[offset + 6] << 8) | bytes[offset + 7];
      if (!width || !height) return null;
    }
    if (marker === 0xda) {
      sawScan = true;
      break;
    }
    offset += 1 + length;
  }
  return width && height && sawScan
    ? { mime: "image/jpeg", width, height }
    : null;
}

function inspectWebp(bytes) {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 12) !== "WEBP") return null;
  const declaredSize =
    bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  if ((declaredSize >>> 0) + 8 !== bytes.length) return null;
  const chunk = ascii(bytes, 12, 16);
  const chunkSize =
    bytes[16] | (bytes[17] << 8) | (bytes[18] << 16) | (bytes[19] << 24);
  const paddedChunkSize = (chunkSize >>> 0) + ((chunkSize >>> 0) % 2);
  if (20 + paddedChunkSize > bytes.length) return null;
  if (chunk === "VP8X" && chunkSize >= 10 && bytes.length >= 30) {
    const width = readUint24LE(bytes, 24) + 1;
    const height = readUint24LE(bytes, 27) + 1;
    return {
      mime: "image/webp",
      width,
      height
    };
  }
  if (chunk === "VP8L" && chunkSize >= 5 && bytes.length >= 25 && bytes[20] === 0x2f) {
    return {
      mime: "image/webp",
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10)
    };
  }
  if (
    chunk === "VP8 " &&
    chunkSize >= 10 &&
    bytes.length >= 30 &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    const width = (bytes[26] | (bytes[27] << 8)) & 0x3fff;
    const height = (bytes[28] | (bytes[29] << 8)) & 0x3fff;
    if (!width || !height) return null;
    return {
      mime: "image/webp",
      width,
      height
    };
  }
  return null;
}

function inspectRaster(bytes) {
  return inspectPng(bytes) ?? inspectJpeg(bytes) ?? inspectWebp(bytes);
}

export async function verifyEmbeddedAssets(pack, policy = LOCAL_CREATOR_POLICY) {
  const report = result();
  let totalDecodedPixels = 0;
  let totalDecodedBytes = 0;
  let verified = 0;
  try {
    assertSafeObjectTree(pack);
  } catch (cause) {
    error(
      report,
      "UNSAFE_DECLARATIVE_DATA",
      "$",
      `Asset declarations must contain only safe data properties: ${cause.message}`
    );
    return { ok: false, ...report };
  }

  for (const [assetId, asset] of Object.entries(pack?.assets ?? {})) {
    const path = `$.assets.${assetId}`;
    if (asset?.source?.kind !== "embedded-data") {
      warning(report, "ASSET_BYTES_NOT_PRESENT", path, "Content-addressed asset bytes require a separate store check.");
      continue;
    }
    const match = DATA_URI_PATTERN.exec(asset.source.data ?? "");
    if (!match) continue;
    let bytes;
    try {
      bytes = decodeBase64(match[2]);
    } catch {
      error(report, "INVALID_BASE64", `${path}.source.data`, "Embedded asset base64 could not be decoded.");
      continue;
    }
    totalDecodedBytes += bytes.byteLength;
    if (bytes.byteLength > policy.maxEmbeddedAssetBytes) {
      error(report, "ASSET_TOO_LARGE", path, "Decoded asset exceeds the configured byte limit.");
      continue;
    }

    const inspection = inspectRaster(bytes);
    if (!inspection) {
      error(report, "RASTER_MAGIC_MISMATCH", path, "Asset bytes are not a recognized PNG, JPEG, or WebP file.");
      continue;
    }
    if (inspection.mime !== asset.mime) {
      error(report, "RASTER_MIME_MISMATCH", path, `Declared ${asset.mime}, decoded ${inspection.mime}.`);
    }
    if (!inspection.width || !inspection.height) {
      warning(report, "DIMENSIONS_UNRESOLVED", path, "Raster signature passed but dimensions were not resolved.");
    } else {
      const pixels = inspection.width * inspection.height;
      totalDecodedPixels += pixels;
      if (
        inspection.width > policy.maxImageDimension ||
        inspection.height > policy.maxImageDimension ||
        pixels > policy.maxImagePixels
      ) {
        error(
          report,
          "RASTER_DIMENSION_LIMIT",
          path,
          `${inspection.width}×${inspection.height} exceeds the configured image budget.`
        );
      }
    }

    const digest = await sha256Hex(bytes);
    if (digest !== asset.sha256) {
      error(report, "ASSET_HASH_MISMATCH", `${path}.sha256`, "Declared asset SHA-256 does not match its bytes.");
    } else {
      verified += 1;
    }
  }

  if (totalDecodedBytes > policy.maxTotalEmbeddedBytes) {
    error(report, "EMBEDDED_TOTAL_TOO_LARGE", "$.assets", "Decoded embedded bytes exceed policy.");
  }
  report.metrics.verifiedEmbeddedAssets = verified;
  report.metrics.totalDecodedBytes = totalDecodedBytes;
  report.metrics.totalDecodedPixels = totalDecodedPixels;
  check(report, "RASTER_MAGIC_SCAN", "Embedded raster magic bytes were checked.");
  check(report, "ASSET_HASH_SCAN", "Embedded asset SHA-256 values were checked.");
  check(report, "IMAGE_BUDGET_SCAN", "Resolved raster dimensions were checked against policy.");
  return { ok: report.errors.length === 0, ...report };
}

export async function admitSkinPack(pack, policy = LOCAL_CREATOR_POLICY) {
  const structure = validateSkinPack(pack, policy);
  let assets;
  let integrity;
  try {
    assets = await verifyEmbeddedAssets(pack, policy);
  } catch (cause) {
    assets = result();
    error(assets, "ASSET_VERIFICATION_ERROR", "$.assets", cause.message);
    assets.ok = false;
  }
  try {
    integrity = await verifySkinIntegrity(pack);
  } catch (cause) {
    integrity = { ok: false, status: "INTEGRITY_ERROR", expected: null, actual: null, error: cause.message };
  }

  const admissionErrors = [...structure.errors, ...assets.errors];
  const unsignedAllowed = policy.allowUnsigned ?? !policy.requireIntegrity;
  if (integrity.status === "UNSIGNED" && !unsignedAllowed) {
    if (!admissionErrors.some((entry) => entry.code === "INTEGRITY_REQUIRED")) {
      admissionErrors.push({
        code: "INTEGRITY_REQUIRED",
        path: "$.integrity",
        message: "Unsigned packs are not allowed by this policy."
      });
    }
  } else if (!integrity.ok && integrity.status !== "UNSIGNED") {
    admissionErrors.push({
      code: integrity.status === "INTEGRITY_FAILED" ? "INTEGRITY_MISMATCH" : "INTEGRITY_INVALID",
      path: "$.integrity",
      message:
        integrity.status === "INTEGRITY_FAILED"
          ? "Declared pack integrity does not match its canonical content."
          : "Pack integrity could not be verified."
    });
  }

  const ok = admissionErrors.length === 0;
  return {
    ok,
    status: ok
      ? integrity.ok
        ? "ADMITTED_INTEGRITY_VERIFIED"
        : "ADMITTED_UNSIGNED"
      : "REJECTED",
    policyId: policy.id,
    structure,
    assets,
    integrity,
    errors: admissionErrors,
    warnings: [...structure.warnings, ...assets.warnings],
    checks: [...structure.checks, ...assets.checks],
    metrics: { ...structure.metrics, ...assets.metrics }
  };
}

export function validateResolvedPresentation(resolved, gameContract, policy = LOCAL_CREATOR_POLICY) {
  const report = result();
  if (!isPlainObject(resolved)) {
    error(report, "INVALID_RESOLVED_PRESENTATION", "$", "Resolved presentation must be an object.");
    return { ok: false, ...report };
  }
  try {
    assertSafeObjectTree(resolved);
  } catch (cause) {
    error(
      report,
      "UNSAFE_DECLARATIVE_DATA",
      "$",
      `Resolved presentation must contain only safe data properties: ${cause.message}`
    );
    return { ok: false, ...report };
  }
  rejectUnknownFields(resolved, RESOLVED_FIELDS, report, "$");
  requireFields(
    resolved,
    [
      "type",
      "version",
      "gameId",
      "gameVersion",
      "compatibility",
      "tokens",
      "slots",
      "accessibility",
      "presentationAuthority"
    ],
    report,
    "$"
  );
  scanForbiddenKeys(resolved, report);
  if (resolved.type !== "axm.resolved-skin") error(report, "INVALID_RESOLVED_TYPE", "$.type", "Invalid resolved type.");
  if (resolved.version !== "1.0") error(report, "INVALID_RESOLVED_VERSION", "$.version", "Invalid resolved version.");
  if (resolved.gameId !== gameContract?.gameId || resolved.gameVersion !== gameContract?.gameVersion) {
    error(report, "RESOLVED_GAME_MISMATCH", "$.gameId", "Resolved presentation is not bound to this game contract.");
  }
  if (!["FULL", "PARTIAL", "INCOMPATIBLE"].includes(resolved.compatibility)) {
    error(report, "INVALID_COMPATIBILITY", "$.compatibility", "Unknown compatibility state.");
  }
  if (resolved.presentationAuthority !== "ZERO_AUTHORITATIVE_WRITES") {
    error(report, "AUTHORITY_BOUNDARY_MISSING", "$.presentationAuthority", "Presentation authority boundary is missing.");
  }
  if (!isPlainObject(resolved.tokens)) error(report, "INVALID_RESOLVED_TOKENS", "$.tokens", "Resolved tokens must be an object.");
  if (!isPlainObject(resolved.accessibility)) {
    error(report, "INVALID_RESOLVED_ACCESSIBILITY", "$.accessibility", "Resolved accessibility must be an object.");
  }
  if (!isPlainObject(resolved.slots)) {
    error(report, "INVALID_RESOLVED_SLOTS", "$.slots", "Resolved slots must be an object.");
  } else {
    const contractSlots = new Map((gameContract?.slots ?? []).map((slot) => [slot.id, slot]));
    for (const [slotId, slot] of Object.entries(resolved.slots)) {
      const path = `$.slots.${slotId}`;
      if (!contractSlots.has(slotId)) {
        error(report, "UNDECLARED_RESOLVED_SLOT", path, "Resolved slot is not declared by the game.");
      }
      if (!isPlainObject(slot)) {
        error(report, "INVALID_RESOLVED_SLOT", path, "Resolved slot must be an object.");
        continue;
      }
      rejectUnknownFields(slot, RESOLVED_SLOT_FIELDS, report, path);
      requireFields(slot, ["kind", "material", "asset", "blueprint"], report, path);
      if (slot.kind !== contractSlots.get(slotId)?.kind) {
        error(report, "RESOLVED_SLOT_KIND_MISMATCH", `${path}.kind`, "Resolved slot kind differs from contract.");
      }
      validateMaterial(slot.material, report, `${path}.material`, policy);
      if (slot.asset !== null) {
        validateAsset(`asset.${slotId.replaceAll(".", "-")}`, slot.asset, report, policy, `${path}.asset`);
      }
      if (slot.blueprint !== null && !isPlainObject(slot.blueprint)) {
        error(report, "INVALID_RESOLVED_BLUEPRINT", `${path}.blueprint`, "Resolved blueprint must be an object or null.");
      }
    }
  }
  check(report, "RESOLVED_PRESENTATION_SCAN", "Post-merge presentation output was validated before adapter use.");
  return { ok: report.errors.length === 0, ...report };
}
