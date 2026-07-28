const encoder = new TextEncoder();
const DANGEROUS_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function assertSafeObjectKey(key, path) {
  if (DANGEROUS_OBJECT_KEYS.has(key)) {
    throw new TypeError(`Unsafe object key "${key}" is not allowed at ${path}.`);
  }
}

function ownDataValue(object, key, path) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor || !("value" in descriptor)) {
    throw new TypeError(`Accessor properties are not allowed in declarative data at ${path}.`);
  }
  return descriptor.value;
}

function defineOwn(object, key, value) {
  Object.defineProperty(object, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true
  });
}

function isMergeableRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertSafeObjectTree(value, path = "$", active = new WeakSet()) {
  if (!value || typeof value !== "object") return value;
  if (active.has(value)) {
    throw new TypeError(`Cyclic declarative data is not allowed at ${path}.`);
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) {
        throw new TypeError(`Sparse arrays are not allowed in declarative data at ${path}.`);
      }
    }
    for (const key of Object.keys(value)) {
      if (!/^(?:0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) {
        throw new TypeError(`Custom array properties are not allowed at ${path}.${key}.`);
      }
    }
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError(`Non-plain objects are not allowed in declarative data at ${path}.`);
    }
  }
  active.add(value);
  for (const key of Object.keys(value)) {
    const keyPath = `${path}.${key}`;
    assertSafeObjectKey(key, keyPath);
    assertSafeObjectTree(ownDataValue(value, key, keyPath), keyPath, active);
  }
  active.delete(value);
  return value;
}

export function normalizePathSegments(path) {
  const segments = Array.isArray(path) ? path.map(String) : String(path).split(".");
  if (!segments.length || segments.some((segment) => segment.length === 0)) {
    throw new TypeError("Object paths require non-empty segments.");
  }
  segments.forEach((segment, index) => {
    assertSafeObjectKey(segment, `path segment ${index + 1}`);
  });
  return segments;
}

function normalizeForCanonicalJson(value, seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON cannot contain NaN or Infinity.");
    }
    return Object.is(value, -0) ? 0 : value;
  }

  if (typeof value !== "object") {
    throw new TypeError(`Canonical JSON cannot contain ${typeof value}.`);
  }

  if (seen.has(value)) {
    throw new TypeError("Canonical JSON cannot contain cycles.");
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const key of Object.keys(value)) {
      const keyPath = `canonical JSON array key "${key}"`;
      assertSafeObjectKey(key, keyPath);
      ownDataValue(value, key, keyPath);
    }
    const normalized = value.map((entry) => normalizeForCanonicalJson(entry, seen));
    seen.delete(value);
    return normalized;
  }

  const normalized = Object.create(null);
  for (const key of Object.keys(value).sort()) {
    const keyPath = `canonical JSON key "${key}"`;
    assertSafeObjectKey(key, keyPath);
    const entry = ownDataValue(value, key, keyPath);
    if (entry === undefined) continue;
    defineOwn(normalized, key, normalizeForCanonicalJson(entry, seen));
  }
  seen.delete(value);
  return normalized;
}

export function stableStringify(value, space = 0) {
  assertSafeObjectTree(value);
  return JSON.stringify(normalizeForCanonicalJson(value), null, space);
}

export function canonicalBytes(value) {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return encoder.encode(typeof value === "string" ? value : stableStringify(value));
}

export async function sha256Hex(value) {
  const bytes = canonicalBytes(value);
  const digest = globalThis.crypto?.subtle?.digest
    ? new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes))
    : sha256Fallback(bytes);
  return [...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function rotateRight(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Fallback(bytes) {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  const state = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const high = Math.floor(bitLength / 0x1_0000_0000);
  const low = bitLength >>> 0;
  view.setUint32(paddedLength - 8, high);
  view.setUint32(paddedLength - 4, low);

  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15];
      const previous2 = words[index - 2];
      const sigma0 =
        rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3);
      const sigma1 =
        rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  const output = new Uint8Array(32);
  const outputView = new DataView(output.buffer);
  state.forEach((word, index) => outputView.setUint32(index * 4, word));
  return output;
}

export function clone(value) {
  assertSafeObjectTree(value);
  return structuredClone(value);
}

export function clamp(value, min = 0, max = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min;
}

export function slugify(value, fallback = "untitled-style") {
  const slug = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || fallback;
}

export function hash32(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function seededRandom(seed) {
  let state = hash32(seed) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function deepMerge(base, overlay) {
  assertSafeObjectTree(base, "$base");
  if (overlay !== undefined) assertSafeObjectTree(overlay, "$overlay");

  function merge(currentBase, currentOverlay) {
    if (currentOverlay === undefined) return clone(currentBase);
    if (!isMergeableRecord(currentBase) || !isMergeableRecord(currentOverlay)) {
      return clone(currentOverlay);
    }

    const result = clone(currentBase);
    for (const key of Object.keys(currentOverlay)) {
      const value = ownDataValue(currentOverlay, key, `$overlay.${key}`);
      const existing = Object.hasOwn(result, key) ? result[key] : undefined;
      defineOwn(
        result,
        key,
        Object.hasOwn(result, key) &&
          isMergeableRecord(existing) &&
          isMergeableRecord(value)
          ? merge(existing, value)
          : clone(value)
      );
    }
    return result;
  }

  return merge(base, overlay);
}

export function setPath(target, dottedPath, value) {
  if (!target || typeof target !== "object") {
    throw new TypeError("setPath target must be an object.");
  }
  assertSafeObjectTree(target, "$target");
  assertSafeObjectTree(value, "$value");
  const segments = normalizePathSegments(dottedPath);
  let cursor = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const existing = Object.hasOwn(cursor, segment)
      ? ownDataValue(cursor, segment, `path ${segments.slice(0, index + 1).join(".")}`)
      : null;
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      defineOwn(cursor, segment, {});
    }
    cursor = ownDataValue(cursor, segment, `path ${segments.slice(0, index + 1).join(".")}`);
  }
  defineOwn(cursor, segments.at(-1), clone(value));
  return target;
}

export function getPath(target, dottedPath) {
  const segments = normalizePathSegments(dottedPath);
  let cursor = target;
  for (const segment of segments) {
    if (
      (!cursor || (typeof cursor !== "object" && typeof cursor !== "function")) ||
      !Object.hasOwn(cursor, segment)
    ) {
      return undefined;
    }
    cursor = ownDataValue(cursor, segment, `path ${segment}`);
  }
  return cursor;
}

export function flattenObject(value, prefix = "", output = {}) {
  if (!output || typeof output !== "object") {
    throw new TypeError("flattenObject output must be an object.");
  }
  assertSafeObjectTree(value, "$flatten");

  const active = new WeakSet();
  function visit(current, currentPrefix) {
    if (!current || typeof current !== "object") return;
    if (active.has(current)) {
      throw new TypeError(`Cyclic declarative data is not allowed at ${currentPrefix || "$"}.`);
    }
    active.add(current);
    for (const key of Object.keys(current)) {
      const path = currentPrefix ? `${currentPrefix}.${key}` : key;
      assertSafeObjectKey(key, path);
      const entry = ownDataValue(current, key, path);
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        visit(entry, path);
      } else {
        defineOwn(output, path, entry);
      }
    }
    active.delete(current);
  }
  visit(value ?? {}, prefix);
  return output;
}
