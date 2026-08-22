'use strict';

const crypto = require('crypto');
const ARTIFACT_SCHEMA = 'axm.artifact-ref/v1';

class ArtifactError extends Error {
  constructor(code, message, details) { super(message); this.name = 'ArtifactError'; this.code = code; this.details = details || null; }
}

function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
}

function sha256(value) { return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value)).digest('hex'); }

function artifactRef(bytes, options) {
  options = options || {};
  bytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const dependencies = Array.from(new Set((options.dependencies || []).map(String))).sort();
  if (dependencies.some(value => !/^[a-f0-9]{64}$/.test(value))) throw new ArtifactError('INVALID_DEPENDENCY_DIGEST', 'Every artifact dependency must be a SHA-256 hex digest');
  const base = {
    schema: ARTIFACT_SCHEMA,
    algorithm: 'sha256',
    digest: sha256(bytes),
    size: bytes.length,
    mediaType: String(options.mediaType || 'application/octet-stream'),
    semanticDigest: options.semanticDigest == null ? null : String(options.semanticDigest),
    dependencies,
    executable: false
  };
  return { ...base, refDigest: sha256(canonical(base)) };
}

function verifyRef(ref, bytes) {
  if (!ref || ref.schema !== ARTIFACT_SCHEMA) throw new ArtifactError('INVALID_ARTIFACT_REF', 'Expected axm.artifact-ref/v1');
  bytes = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const actualDigest = sha256(bytes);
  if (actualDigest !== ref.digest) throw new ArtifactError('ARTIFACT_DIGEST_MISMATCH', 'Artifact bytes do not match their reference', { expected: ref.digest, actual: actualDigest });
  if (bytes.length !== ref.size) throw new ArtifactError('ARTIFACT_SIZE_MISMATCH', 'Artifact size does not match its reference', { expected: ref.size, actual: bytes.length });
  const { refDigest, ...base } = ref;
  if (sha256(canonical(base)) !== refDigest) throw new ArtifactError('ARTIFACT_REF_DRIFT', 'Artifact reference fields do not match refDigest');
  return true;
}

function lease(input) {
  if (!input || !input.id || !input.owner) throw new ArtifactError('INVALID_LEASE', 'Lease requires id and owner');
  const artifacts = Array.from(new Set((input.artifacts || []).map(String))).sort();
  if (artifacts.some(value => !/^[a-f0-9]{64}$/.test(value))) throw new ArtifactError('INVALID_LEASE_DIGEST', 'Lease artifact digests must be SHA-256 hex');
  return { schema: 'axm.artifact-lease/v1', id: String(input.id), owner: String(input.owner), artifacts, expiresAt: input.expiresAt || null, renewable: input.renewable === true, grantsAuthority: false };
}

function exportManifest(refs) {
  const artifacts = (refs || []).map(ref => ({ digest: ref.digest, size: ref.size, mediaType: ref.mediaType, refDigest: ref.refDigest })).sort((a, b) => a.digest.localeCompare(b.digest));
  const base = { schema: 'axm.artifact-export/v1', artifacts, executionAuthority: false, promotionAuthority: false };
  return { ...base, manifestDigest: sha256(canonical(base)) };
}

module.exports = { ARTIFACT_SCHEMA, ArtifactError, canonical, sha256, artifactRef, verifyRef, lease, exportManifest };
