import { clone, setPath } from "./stable.mjs";

const ALLOWED_OVERRIDE_PREFIXES = [
  "tokens.",
  "materials.",
  "characterBlueprints.",
  "accessibility."
];

export function createSkinInstance(pack, options = {}) {
  return {
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
      effectScale: Number.isFinite(options.effectScale) ? options.effectScale : 1
    },
    status: "LOCAL_DRAFT"
  };
}

export function setInstanceOverride(instance, path, value) {
  const segments = Array.isArray(path) ? path.map(String) : String(path).split(".");
  const visiblePath = segments.join(".");
  if (!ALLOWED_OVERRIDE_PREFIXES.some((prefix) => `${visiblePath}.`.startsWith(prefix))) {
    throw new Error(`Override path "${visiblePath}" is outside the presentation boundary.`);
  }
  const next = clone(instance);
  let cursor = next.overrides;
  for (const segment of segments.slice(0, -1)) {
    if (!cursor[segment] || typeof cursor[segment] !== "object") cursor[segment] = {};
    cursor = cursor[segment];
  }
  cursor[segments.at(-1)] = clone(value);
  return next;
}

export function validateSkinInstance(instance) {
  const errors = [];
  if (instance?.type !== "axm.skin-instance") errors.push("type must be axm.skin-instance");
  if (instance?.version !== "1.0") errors.push("version must be 1.0");
  if (!Array.isArray(instance?.packRefs) || !instance.packRefs.length) {
    errors.push("packRefs must contain at least one pack reference");
  }
  for (const path of Object.keys(instance?.overrides ?? {})) {
    if (["__proto__", "prototype", "constructor"].includes(path)) {
      errors.push(`forbidden override key: ${path}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
