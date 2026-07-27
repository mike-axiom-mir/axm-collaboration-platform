'use strict';

const crypto = require('crypto');
const path = require('path');

const BUNDLE_SCHEMA = 'axm.module-bundle/v1';
const COMPARISON_SCHEMA = 'axm.module-lineage-comparison/v1';
const FILE_DELTA_SCHEMA = 'axm.module-file-delta/v1';
const CONTRACT_DELTA_SCHEMA = 'axm.module-contract-delta/v1';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_FILES = 300;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;

const MANIFEST_FIELDS = [
  'version',
  'status',
  'entry',
  'type',
  'audience',
  'layer',
  'category',
  'risk',
  'uses',
  'permissions',
  'actions',
  'accepts',
  'produces',
  'readiness',
  'presentation'
];

const CONTRACT_FIELDS = [
  'version',
  'provides',
  'consumes',
  'permissions',
  'handoffs',
  'boundaries',
  'lifecycle'
];

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) result[key] = stableValue(value[key]);
    return result;
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function safeRelative(value) {
  const raw = String(value || '');
  if (!raw || raw.length > 260 || raw.includes('\0') || raw.includes('\\')) {
    throw new Error('unsafe bundle path: ' + raw);
  }
  if (path.posix.isAbsolute(raw) || /^[A-Za-z]:/.test(raw)) {
    throw new Error('unsafe bundle path: ' + raw);
  }
  const normalized = path.posix.normalize(raw);
  if (normalized !== raw || normalized === '..' || normalized.startsWith('../')) {
    throw new Error('unsafe bundle path: ' + raw);
  }
  return normalized;
}

function decodeContent(item) {
  const encoding = item.encoding || 'utf8';
  if (encoding !== 'utf8' && encoding !== 'base64') throw new Error('unsupported bundle encoding');
  const bytes = Buffer.from(String(item.content || ''), encoding);
  if (bytes.length > MAX_FILE_BYTES) throw new Error('bundle file size safety limit exceeded');
  if (item.sha256 && String(item.sha256).toLowerCase() !== sha256(bytes)) {
    throw new Error('bundle digest mismatch: ' + item.path);
  }
  return bytes;
}

function parseJsonFile(filesByPath, relativePath, issues) {
  const file = filesByPath.get(relativePath);
  if (!file) {
    issues.push(relativePath + ' is missing');
    return null;
  }
  try {
    return JSON.parse(file.bytes.toString('utf8'));
  } catch (error) {
    issues.push(relativePath + ' is invalid JSON: ' + error.message);
    return null;
  }
}

function decodeBundle(input, label) {
  if (!input || input.schema !== BUNDLE_SCHEMA) throw new Error('bundle schema must be ' + BUNDLE_SCHEMA);
  if (!Array.isArray(input.files) || input.files.length < 1 || input.files.length > MAX_FILES) {
    throw new Error('bundle must contain 1–' + MAX_FILES + ' files');
  }
  const seen = new Set();
  const files = [];
  let totalBytes = 0;
  for (const item of input.files) {
    if (!item || typeof item !== 'object') throw new Error('bundle file record must be an object');
    const relativePath = safeRelative(item.path);
    const collisionKey = relativePath.toLowerCase();
    if (seen.has(collisionKey)) throw new Error('duplicate bundle path: ' + relativePath);
    seen.add(collisionKey);
    const bytes = decodeContent(item);
    totalBytes += bytes.length;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error('bundle total size safety limit exceeded');
    files.push({
      path: relativePath,
      bytes,
      size: bytes.length,
      sha256: sha256(bytes)
    });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  const filesByPath = new Map(files.map(file => [file.path, file]));
  const issues = [];
  const manifest = parseJsonFile(filesByPath, 'manifest.json', issues);
  const contract = parseJsonFile(filesByPath, 'module.contract.json', issues);
  if (manifest && contract && manifest.id !== contract.id) issues.push('manifest and contract ids differ');
  const digestRows = files.map(file => ({ path: file.path, sha256: file.sha256 }));
  return {
    label: String(label || 'bundle').slice(0, 160),
    digest: sha256(Buffer.from(JSON.stringify(digestRows))),
    fileCount: files.length,
    totalBytes,
    files,
    filesByPath,
    manifest,
    contract,
    moduleId: manifest && typeof manifest.id === 'string' ? manifest.id : null,
    issues
  };
}

function summarizeBundle(decoded) {
  return {
    label: decoded.label,
    canonicalDigest: decoded.digest,
    fileCount: decoded.fileCount,
    totalBytes: decoded.totalBytes,
    moduleId: decoded.moduleId,
    manifestVersion: decoded.manifest && decoded.manifest.version || null,
    manifestStatus: decoded.manifest && decoded.manifest.status || null,
    structuralIssues: decoded.issues.slice()
  };
}

function arrayDelta(left, right) {
  const leftRows = left.map(value => stableJson(value));
  const rightRows = right.map(value => stableJson(value));
  const leftSet = new Set(leftRows);
  const rightSet = new Set(rightRows);
  return {
    added: right.filter((value, index) => !leftSet.has(rightRows[index])),
    removed: left.filter((value, index) => !rightSet.has(leftRows[index])),
    orderChanged: leftRows.length === rightRows.length &&
      leftRows.every(value => rightSet.has(value)) &&
      stableJson(left) !== stableJson(right)
  };
}

function fieldDelta(field, left, right) {
  const leftPresent = left !== undefined;
  const rightPresent = right !== undefined;
  if (!leftPresent && !rightPresent) return null;
  const same = stableJson(left) === stableJson(right);
  if (same) return { field, state: 'SAME' };
  let state = 'CHANGED';
  if (!leftPresent) state = 'ADDED';
  if (!rightPresent) state = 'REMOVED';
  const result = {
    field,
    state,
    baseline: leftPresent ? stableValue(left) : null,
    candidate: rightPresent ? stableValue(right) : null
  };
  if (Array.isArray(left) && Array.isArray(right)) result.arrayDelta = arrayDelta(left, right);
  return result;
}

function objectDeltas(left, right, fields) {
  const baseline = left && typeof left === 'object' ? left : {};
  const candidate = right && typeof right === 'object' ? right : {};
  return fields.map(field => fieldDelta(field, baseline[field], candidate[field])).filter(Boolean);
}

function freshness(comparison, options = {}) {
  const observedMs = Date.parse(comparison && comparison.measuredAt);
  const nowMs = Date.parse(options.now || new Date().toISOString());
  const ttlMs = Number(comparison && comparison.freshnessTtlMs);
  if (!Number.isFinite(observedMs) || !Number.isFinite(nowMs) || !Number.isFinite(ttlMs) || ttlMs < 0) {
    return { status: 'UNTIMED', ageMs: null, ttlMs: Number.isFinite(ttlMs) ? ttlMs : null };
  }
  const ageMs = Math.max(0, nowMs - observedMs);
  return { status: ageMs <= ttlMs ? 'LIVE' : 'STALE', ageMs, ttlMs };
}

function compareBundles(leftInput, rightInput, options = {}) {
  const left = decodeBundle(leftInput, options.leftLabel || 'baseline');
  const right = decodeBundle(rightInput, options.rightLabel || 'candidate');
  const leftPaths = new Set(left.files.map(file => file.path));
  const rightPaths = new Set(right.files.map(file => file.path));
  const added = right.files.filter(file => !leftPaths.has(file.path)).map(file => ({
    path: file.path,
    sha256: file.sha256,
    bytes: file.size
  }));
  const removed = left.files.filter(file => !rightPaths.has(file.path)).map(file => ({
    path: file.path,
    sha256: file.sha256,
    bytes: file.size
  }));
  const changed = [];
  const unchanged = [];
  for (const leftFile of left.files) {
    const rightFile = right.filesByPath.get(leftFile.path);
    if (!rightFile) continue;
    if (leftFile.sha256 === rightFile.sha256) {
      unchanged.push({ path: leftFile.path, sha256: leftFile.sha256, bytes: leftFile.size });
    } else {
      changed.push({
        path: leftFile.path,
        baselineSha256: leftFile.sha256,
        candidateSha256: rightFile.sha256,
        baselineBytes: leftFile.size,
        candidateBytes: rightFile.size
      });
    }
  }
  let relation = 'CHANGED';
  if (left.digest === right.digest) relation = 'IDENTICAL_BUNDLE_BYTES_BY_CANONICAL_FILE_DIGEST';
  else if (left.moduleId && right.moduleId && left.moduleId !== right.moduleId) relation = 'DIFFERENT_MODULE_IDS';
  else if (!left.moduleId || !right.moduleId) relation = 'MODULE_ID_UNKNOWN';

  const manifestFields = objectDeltas(left.manifest, right.manifest, MANIFEST_FIELDS);
  const contractFields = objectDeltas(left.contract, right.contract, CONTRACT_FIELDS);
  const measuredAt = options.now || new Date().toISOString();
  const ttlMs = options.ttlMs === undefined ? DEFAULT_TTL_MS : Number(options.ttlMs);
  if (!Number.isFinite(ttlMs) || ttlMs < 0) throw new Error('ttlMs must be a non-negative number');
  const fingerprintMaterial = {
    leftDigest: left.digest,
    rightDigest: right.digest,
    relation,
    added,
    removed,
    changed,
    manifestFields,
    contractFields
  };
  return {
    schema: COMPARISON_SCHEMA,
    version: 'v0.1',
    measuredAt,
    freshnessTtlMs: ttlMs,
    fingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
    direction: {
      baseline: summarizeBundle(left),
      candidate: summarizeBundle(right),
      meaning: 'Directional labels only. No age, precedence, acceptance, safety, or authority is inferred.'
    },
    relation,
    summary: {
      addedFiles: added.length,
      removedFiles: removed.length,
      changedFiles: changed.length,
      unchangedFiles: unchanged.length,
      manifestFieldChanges: manifestFields.filter(item => item.state !== 'SAME').length,
      contractFieldChanges: contractFields.filter(item => item.state !== 'SAME').length,
      structuralIssues: left.issues.length + right.issues.length
    },
    fileDelta: {
      schema: FILE_DELTA_SCHEMA,
      added,
      removed,
      changed,
      unchanged
    },
    declaredDelta: {
      schema: CONTRACT_DELTA_SCHEMA,
      manifestFields,
      contractFields
    },
    truth: {
      bundleFilesExecuted: false,
      archiveExtractionPerformed: false,
      semanticEquivalenceInferred: false,
      baselineAgeInferred: false,
      candidateAgeInferred: false,
      winnerSelected: false,
      automaticMergePerformed: false,
      sourceMutationPerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
      permissionChanged: false,
      rollbackChanged: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

module.exports = {
  BUNDLE_SCHEMA,
  COMPARISON_SCHEMA,
  FILE_DELTA_SCHEMA,
  CONTRACT_DELTA_SCHEMA,
  DEFAULT_TTL_MS,
  MANIFEST_FIELDS,
  CONTRACT_FIELDS,
  sha256,
  stableValue,
  safeRelative,
  decodeBundle,
  compareBundles,
  freshness
};
