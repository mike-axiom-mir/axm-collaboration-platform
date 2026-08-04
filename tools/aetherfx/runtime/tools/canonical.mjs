import crypto from 'node:crypto';
export function canonical(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonical);
  return Object.keys(value).sort().reduce((out,key)=>{out[key]=canonical(value[key]);return out;},{});
}
export function integrityPayload(pkg){ const clone=structuredClone(pkg); delete clone.integrity; return JSON.stringify(canonical(clone)); }
export function sha256(text){ return crypto.createHash('sha256').update(text).digest('hex'); }
export function packageDigest(pkg){ return sha256(integrityPayload(pkg)); }
