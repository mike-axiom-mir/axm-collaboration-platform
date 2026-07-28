import {
  ALLOWED_PACK_FIELDS,
  FORBIDDEN_PACK_KEYS,
  LOCAL_CREATOR_POLICY,
  MATERIAL_LIMITS,
  PRESENTATION_CAPABILITIES
} from "./policy.mjs";
import { sha256Hex } from "./stable.mjs";

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const RELEASE_PATTERN = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i;
const DATA_URI_PATTERN = /^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function byteLength(value) {
  return new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value)).byteLength;
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

function scanForbiddenKeys(value, report, path = "$", depth = 0) {
  if (typeof value === "number" && !Number.isFinite(value)) {
    error(report, "NON_FINITE_NUMBER", path, "NaN and Infinity are not valid skin data.");
    return;
  }
  if (depth > 48) {
    error(report, "MAX_DEPTH", path, "Object nesting exceeds 48 levels.");
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, entry] of Object.entries(value)) {
    const keyPath = `${path}.${key}`;
    if (FORBIDDEN_PACK_KEYS.has(key)) {
      error(report, "FORBIDDEN_KEY", keyPath, `"${key}" is outside the declarative presentation boundary.`);
    }
    scanForbiddenKeys(entry, report, keyPath, depth + 1);
  }
}

function validateMaterial(material, report, path) {
  if (!isPlainObject(material)) {
    error(report, "INVALID_MATERIAL", path, "Material must be an object.");
    return;
  }

  for (const [key, bounds] of Object.entries(MATERIAL_LIMITS)) {
    if (!(key in material)) continue;
    const value = material[key];
    if (!Number.isFinite(value) || value < bounds[0] || value > bounds[1]) {
      error(
        report,
        "MATERIAL_VALUE_OUT_OF_RANGE",
        `${path}.${key}`,
        `${key} must be a finite number between ${bounds[0]} and ${bounds[1]}.`
      );
    }
  }

  for (const key of ["baseColor", "secondaryColor", "accentColor", "emissiveColor"]) {
    if (key in material && !/^#[0-9a-f]{6}$/i.test(String(material[key]))) {
      error(report, "INVALID_COLOR", `${path}.${key}`, `${key} must use six-digit hexadecimal color.`);
    }
  }

  if ("pattern" in material && !isPlainObject(material.pattern)) {
    error(report, "INVALID_PATTERN", `${path}.pattern`, "Pattern must be declarative object data.");
  }
}

function validateAsset(assetId, asset, report, policy) {
  const path = `$.assets.${assetId}`;
  if (!ID_PATTERN.test(assetId)) {
    error(report, "INVALID_ASSET_ID", path, "Asset ID must be a portable lowercase identifier.");
  }
  if (!isPlainObject(asset)) {
    error(report, "INVALID_ASSET", path, "Asset must be an object.");
    return 0;
  }
  if (!policy.allowedAssetMimes.includes(asset.mime)) {
    error(report, "ASSET_MIME_DENIED", `${path}.mime`, `MIME ${asset.mime ?? "(missing)"} is not allowed.`);
  }
  if (!["texture", "sprite", "decal", "portrait", "ui"].includes(asset.role)) {
    error(report, "ASSET_ROLE_DENIED", `${path}.role`, "Asset role is missing or unsupported.");
  }
  if (!/^[0-9a-f]{64}$/i.test(asset.sha256 ?? "")) {
    error(report, "INVALID_ASSET_HASH", `${path}.sha256`, "Asset requires a 64-character SHA-256 digest.");
  }
  if (
    asset.originalName &&
    (/[/\\:\u0000-\u001f]/.test(asset.originalName) || asset.originalName.includes(".."))
  ) {
    error(
      report,
      "UNSAFE_ORIGINAL_NAME",
      `${path}.originalName`,
      "Original filename is inert metadata and must not contain paths or control characters."
    );
  }
  if (!isPlainObject(asset.source)) {
    error(report, "INVALID_ASSET_SOURCE", `${path}.source`, "Asset source must be declared.");
    return 0;
  }

  if (asset.source.kind === "embedded-data") {
    const match = DATA_URI_PATTERN.exec(asset.source.data ?? "");
    if (!match) {
      error(report, "INVALID_DATA_URI", `${path}.source.data`, "Embedded assets require a base64 data URI.");
      return 0;
    }
    if (match[1].toLowerCase() !== String(asset.mime).toLowerCase()) {
      error(report, "MIME_MISMATCH", `${path}.source.data`, "Data URI MIME does not match the declaration.");
    }
    const approximateBytes = Math.floor((match[2].replace(/\s/g, "").length * 3) / 4);
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
    if (!/^sha256:[0-9a-f]{64}$/i.test(asset.source.hash ?? "")) {
      error(report, "INVALID_CONTENT_HASH", `${path}.source.hash`, "Content hash must be sha256:<64 hex>.");
    }
    return 0;
  }

  if (asset.source.kind === "remote" && policy.allowRemoteAssets) {
    warning(report, "REMOTE_ASSET_UNVERIFIED", path, "Remote assets require a separate fetch and integrity gate.");
    return 0;
  }

  error(report, "ASSET_SOURCE_DENIED", `${path}.source.kind`, "Remote, path, and executable asset sources are denied.");
  return 0;
}

export function validateSkinPack(pack, policy = LOCAL_CREATOR_POLICY) {
  const report = result();

  if (!isPlainObject(pack)) {
    error(report, "NOT_AN_OBJECT", "$", "Skin pack must be a JSON object.");
    return { ok: false, ...report };
  }

  const packBytes = byteLength(pack);
  report.metrics.packBytes = packBytes;
  if (packBytes > policy.maxPackBytes) {
    error(report, "PACK_TOO_LARGE", "$", `Pack exceeds ${policy.maxPackBytes} bytes.`);
  }

  if (!policy.allowUnknownTopLevelFields) {
    for (const key of Object.keys(pack)) {
      if (!ALLOWED_PACK_FIELDS.has(key)) {
        error(report, "UNKNOWN_TOP_LEVEL_FIELD", `$.${key}`, `Unknown field "${key}" is denied by policy.`);
      }
    }
  }

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
  if (!isPlainObject(pack.metadata)) error(report, "INVALID_METADATA", "$.metadata", "metadata is required.");
  if (!Array.isArray(pack.scopes) || pack.scopes.length === 0) {
    error(report, "INVALID_SCOPES", "$.scopes", "At least one presentation scope is required.");
  }

  if (!Array.isArray(pack.capabilities)) {
    error(report, "INVALID_CAPABILITIES", "$.capabilities", "capabilities must be an array.");
  } else {
    for (const capability of pack.capabilities) {
      if (!PRESENTATION_CAPABILITIES.includes(capability)) {
        error(report, "UNKNOWN_CAPABILITY", "$.capabilities", `Capability "${capability}" is not allowed.`);
      }
    }
  }

  if (!isPlainObject(pack.materials)) {
    error(report, "INVALID_MATERIALS", "$.materials", "materials must be an object.");
  } else {
    for (const [materialId, material] of Object.entries(pack.materials)) {
      if (!ID_PATTERN.test(materialId)) {
        error(report, "INVALID_MATERIAL_ID", `$.materials.${materialId}`, "Material ID is not portable.");
      }
      validateMaterial(material, report, `$.materials.${materialId}`);
    }
  }

  if (!Array.isArray(pack.bindings)) {
    error(report, "INVALID_BINDINGS", "$.bindings", "bindings must be an array.");
  } else {
    const targets = new Set();
    for (const [index, binding] of pack.bindings.entries()) {
      const path = `$.bindings[${index}]`;
      if (!isPlainObject(binding)) {
        error(report, "INVALID_BINDING", path, "Binding must be an object.");
        continue;
      }
      if (!ID_PATTERN.test(binding.target ?? "")) {
        error(report, "INVALID_BINDING_TARGET", `${path}.target`, "Binding target is invalid.");
      }
      if (targets.has(binding.target)) {
        error(report, "DUPLICATE_BINDING", `${path}.target`, "A pack may bind a target only once.");
      }
      targets.add(binding.target);
      if (!(binding.material in (pack.materials ?? {}))) {
        error(report, "MISSING_MATERIAL", `${path}.material`, "Binding references an unknown material.");
      }
      if (binding.asset && !(binding.asset in (pack.assets ?? {}))) {
        error(report, "MISSING_ASSET", `${path}.asset`, "Binding references an unknown asset.");
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

  if (!isPlainObject(pack.provenance)) {
    error(report, "MISSING_PROVENANCE", "$.provenance", "A provenance record is required.");
  } else if (!pack.provenance.seed && pack.provenance.origin === "deterministic-recipe") {
    error(report, "MISSING_SEED", "$.provenance.seed", "Deterministic recipes require a recorded seed.");
  }

  if (policy.requireLicenseDeclaration && !pack.metadata?.license) {
    error(report, "LICENSE_REQUIRED", "$.metadata.license", "Hosted policy requires a license declaration.");
  }
  if (policy.requireIntegrity && !pack.integrity?.contentSha256) {
    error(report, "INTEGRITY_REQUIRED", "$.integrity", "Hosted policy requires an integrity digest.");
  }

  check(report, "PRESENTATION_ONLY_SCAN", "Forbidden authority and executable keys were scanned.");
  check(report, "DECLARATIVE_ASSET_SCAN", "Asset sources and MIME declarations were checked.");
  check(report, "MATERIAL_BOUNDS_SCAN", "Known material parameters were checked against finite bounds.");

  return { ok: report.errors.length === 0, ...report };
}

export function validateGameSkinContract(contract) {
  const report = result();
  if (!isPlainObject(contract)) {
    error(report, "NOT_AN_OBJECT", "$", "Game skin contract must be an object.");
    return { ok: false, ...report };
  }
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
  if (!Array.isArray(contract.slots)) {
    error(report, "INVALID_SLOTS", "$.slots", "slots must be an array.");
  } else {
    const ids = new Set();
    for (const [index, slot] of contract.slots.entries()) {
      const path = `$.slots[${index}]`;
      if (!ID_PATTERN.test(slot?.id ?? "")) error(report, "INVALID_SLOT_ID", `${path}.id`, "Slot ID is invalid.");
      if (ids.has(slot?.id)) error(report, "DUPLICATE_SLOT", `${path}.id`, "Slot IDs must be unique.");
      ids.add(slot?.id);
      if (!["surface", "character-region", "ui", "fx", "audio"].includes(slot?.kind)) {
        error(report, "INVALID_SLOT_KIND", `${path}.kind`, "Slot kind is unsupported.");
      }
      if (!Array.isArray(slot?.supportedProperties)) {
        error(report, "INVALID_PROPERTY_LIST", `${path}.supportedProperties`, "supportedProperties must be an array.");
      }
      if (!isPlainObject(slot?.fallback)) {
        error(report, "MISSING_FALLBACK", `${path}.fallback`, "Every slot needs a game-owned fallback.");
      }
    }
  }
  return { ok: report.errors.length === 0, ...report };
}

export function packWithoutIntegrity(pack) {
  const copy = structuredClone(pack);
  copy.integrity = null;
  return copy;
}

export async function calculateSkinIntegrity(pack) {
  return {
    algorithm: "sha256",
    canonicalization: "axm-stable-json-v1",
    contentSha256: await sha256Hex(packWithoutIntegrity(pack))
  };
}

export async function verifySkinIntegrity(pack) {
  if (!pack.integrity?.contentSha256) {
    return { ok: false, status: "UNSIGNED", expected: null, actual: await sha256Hex(packWithoutIntegrity(pack)) };
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

function inspectPng(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { mime: "image/png", width: view.getUint32(16), height: view.getUint32(20) };
}

function inspectJpeg(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
    return null;
  }
  let offset = 2;
  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
  ]);
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x00 || marker === 0xff) {
      offset += 1;
      continue;
    }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    if (sofMarkers.has(marker)) {
      return {
        mime: "image/jpeg",
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8]
      };
    }
    offset += 2 + length;
  }
  return { mime: "image/jpeg", width: null, height: null };
}

function inspectWebp(bytes) {
  const text = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length < 30 || text(0, 4) !== "RIFF" || text(8, 12) !== "WEBP") return null;
  const chunk = text(12, 16);
  if (chunk === "VP8X") {
    return {
      mime: "image/webp",
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1
    };
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    return {
      mime: "image/webp",
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10)
    };
  }
  if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      mime: "image/webp",
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff
    };
  }
  return { mime: "image/webp", width: null, height: null };
}

function inspectRaster(bytes) {
  return inspectPng(bytes) ?? inspectJpeg(bytes) ?? inspectWebp(bytes);
}

export async function verifyEmbeddedAssets(pack, policy = LOCAL_CREATOR_POLICY) {
  const report = result();
  let totalDecodedPixels = 0;
  let verified = 0;

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

  report.metrics.verifiedEmbeddedAssets = verified;
  report.metrics.totalDecodedPixels = totalDecodedPixels;
  check(report, "RASTER_MAGIC_SCAN", "Embedded raster magic bytes were checked.");
  check(report, "ASSET_HASH_SCAN", "Embedded asset SHA-256 values were checked.");
  check(report, "IMAGE_BUDGET_SCAN", "Resolved raster dimensions were checked against policy.");
  return { ok: report.errors.length === 0, ...report };
}
