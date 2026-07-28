import {
  assertSafeObjectTree,
  clone,
  normalizePathSegments,
  setPath
} from "./stable.mjs";

const INSTANCE_FIELDS = new Set([
  "type",
  "version",
  "id",
  "packRefs",
  "overrides",
  "accessibility",
  "status"
]);
const PACK_REF_FIELDS = new Set(["id", "release", "integrity"]);
const ACCESSIBILITY_FIELDS = new Set(["reducedMotion", "highContrast", "effectScale"]);
const ALLOWED_OVERRIDE_ROOTS = new Set([
  "tokens",
  "materials",
  "characterBlueprints",
  "accessibility"
]);
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function own(object, key) {
  if (!isPlainObject(object) || !Object.hasOwn(object, key)) return undefined;
  return Object.getOwnPropertyDescriptor(object, key)?.value;
}

function rejectUnknownFields(object, allowed, path, errors) {
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) errors.push(`${path}.${key} is not an allowed field`);
  }
}

function validateJsonValue(value, path, errors, active = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(`${path} must not contain NaN or Infinity`);
    return;
  }
  if (typeof value !== "object") {
    errors.push(`${path} contains non-JSON value ${typeof value}`);
    return;
  }
  if (active.has(value)) {
    errors.push(`${path} contains a cycle`);
    return;
  }
  active.add(value);
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) {
      errors.push(`${path}.${key} must be a data property`);
      continue;
    }
    validateJsonValue(descriptor.value, `${path}.${key}`, errors, active);
  }
  active.delete(value);
}

function validateAccessibilityObject(accessibility, path, errors) {
  if (!isPlainObject(accessibility)) {
    errors.push(`${path} must be a plain object`);
    return;
  }
  rejectUnknownFields(accessibility, ACCESSIBILITY_FIELDS, path, errors);
  for (const key of ["reducedMotion", "highContrast"]) {
    const value = own(accessibility, key);
    if (value !== undefined && typeof value !== "boolean") {
      errors.push(`${path}.${key} must be boolean`);
    }
  }
  const effectScale = own(accessibility, "effectScale");
  if (
    effectScale !== undefined &&
    (!Number.isFinite(effectScale) || effectScale < 0 || effectScale > 1)
  ) {
    errors.push(`${path}.effectScale must be a finite number between 0 and 1`);
  }
}

export function createSkinInstance(pack, options = {}) {
  const effectScale = Number.isFinite(options.effectScale)
    ? Math.min(1, Math.max(0, options.effectScale))
    : 1;
  const instance = {
    type: "axm.skin-instance",
    version: "1.0",
    id: options.id ?? `${pack.id}.instance`,
    packRefs: [
      {
        id: pack.id,
        release: pack.release,
        integrity: pack.integrity?.contentSha256 ?? null
      }
    ],
    overrides: {},
    accessibility: {
      reducedMotion: Boolean(options.reducedMotion),
      highContrast: Boolean(options.highContrast),
      effectScale
    },
    status: "LOCAL_DRAFT"
  };
  const validation = validateSkinInstance(instance);
  if (!validation.ok) {
    throw new TypeError(`Cannot create invalid skin instance: ${validation.errors.join("; ")}`);
  }
  return instance;
}

export function setInstanceOverride(instance, path, value) {
  const validation = validateSkinInstance(instance);
  if (!validation.ok) {
    throw new TypeError(`Cannot update invalid skin instance: ${validation.errors.join("; ")}`);
  }
  const segments = normalizePathSegments(path);
  const visiblePath = segments.join(".");
  if (!ALLOWED_OVERRIDE_ROOTS.has(segments[0])) {
    throw new Error(`Override path "${visiblePath}" is outside the presentation boundary.`);
  }
  assertSafeObjectTree(value, `$override.${visiblePath}`);
  const next = clone(instance);
  setPath(next.overrides, segments, value);
  const nextValidation = validateSkinInstance(next);
  if (!nextValidation.ok) {
    throw new TypeError(`Override produced an invalid skin instance: ${nextValidation.errors.join("; ")}`);
  }
  return next;
}

export function validateSkinInstance(instance) {
  const errors = [];
  if (!isPlainObject(instance)) {
    return { ok: false, errors: ["skin instance must be a plain object"] };
  }

  try {
    assertSafeObjectTree(instance, "$instance");
  } catch (error) {
    errors.push(error.message);
  }
  rejectUnknownFields(instance, INSTANCE_FIELDS, "$instance", errors);

  if (own(instance, "type") !== "axm.skin-instance") errors.push("type must be axm.skin-instance");
  if (own(instance, "version") !== "1.0") errors.push("version must be 1.0");
  const id = own(instance, "id");
  if (typeof id !== "string" || !id.trim()) errors.push("id must be a non-empty string");

  const packRefs = own(instance, "packRefs");
  if (!Array.isArray(packRefs) || !packRefs.length) {
    errors.push("packRefs must contain at least one pack reference");
  } else {
    for (let index = 0; index < packRefs.length; index += 1) {
      const path = `packRefs[${index}]`;
      if (!Object.hasOwn(packRefs, index)) {
        errors.push(`${path} must not be empty`);
        continue;
      }
      const reference = Object.getOwnPropertyDescriptor(packRefs, String(index))?.value;
      if (!isPlainObject(reference)) {
        errors.push(`${path} must be a plain object`);
        continue;
      }
      rejectUnknownFields(reference, PACK_REF_FIELDS, path, errors);
      if (typeof own(reference, "id") !== "string" || !own(reference, "id").trim()) {
        errors.push(`${path}.id must be a non-empty string`);
      }
      if (typeof own(reference, "release") !== "string" || !own(reference, "release").trim()) {
        errors.push(`${path}.release must be a non-empty string`);
      }
      const integrity = own(reference, "integrity");
      if (integrity !== null && !SHA256_PATTERN.test(integrity ?? "")) {
        errors.push(`${path}.integrity must be null or a SHA-256 digest`);
      }
    }
  }

  const overrides = own(instance, "overrides");
  if (!isPlainObject(overrides)) {
    errors.push("overrides must be a plain object");
  } else {
    for (const root of Object.keys(overrides)) {
      if (!ALLOWED_OVERRIDE_ROOTS.has(root)) {
        errors.push(`overrides.${root} is outside the presentation boundary`);
      } else if (!isPlainObject(own(overrides, root))) {
        errors.push(`overrides.${root} must be a plain object`);
      }
    }
    if (isPlainObject(own(overrides, "accessibility"))) {
      validateAccessibilityObject(own(overrides, "accessibility"), "overrides.accessibility", errors);
    }
    validateJsonValue(overrides, "overrides", errors);
  }

  const accessibility = own(instance, "accessibility");
  validateAccessibilityObject(accessibility, "accessibility", errors);

  if (!["LOCAL_DRAFT", "LOCAL_SAVED"].includes(own(instance, "status"))) {
    errors.push("status must be LOCAL_DRAFT or LOCAL_SAVED");
  }

  return { ok: errors.length === 0, errors };
}
