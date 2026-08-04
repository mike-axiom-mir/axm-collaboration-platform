"use strict";
const crypto = require("crypto");

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
  }
  return value;
}
function stableStringify(value) { return JSON.stringify(stable(value)); }
function sha256(value) { return crypto.createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex"); }
function iso(value = Date.now()) { return new Date(value).toISOString(); }
function finite(value, name) { if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`); return value; }
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b)=>a-b); const index = (sorted.length-1)*p; const low=Math.floor(index), high=Math.ceil(index);
  if (low===high) return sorted[low]; const w=index-low; return sorted[low]*(1-w)+sorted[high]*w;
}
function deepFreeze(obj) { if (!obj || typeof obj !== "object" || Object.isFrozen(obj)) return obj; Object.freeze(obj); for (const v of Object.values(obj)) deepFreeze(v); return obj; }
function randomId(prefix="axm") { return `${prefix}-${crypto.randomBytes(8).toString("hex")}`; }
module.exports = { stable, stableStringify, sha256, iso, finite, clamp, percentile, deepFreeze, randomId };
