'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PRESSURE_SCHEMA = 'axm.storage-pressure-map/v1';
const DEFAULT_ALLOCATION_UNIT = 4096;
const CLASSES = Object.freeze([
  'CANONICAL_STATE',
  'DURABLE_EVENT',
  'SESSION_SEGMENT',
  'DERIVED_VIEW',
  'REPETITIVE_TELEMETRY',
  'TEMPORARY_CAPTURE',
  'PRIVATE_OR_USER_SOURCE',
  'UNCLASSIFIED'
]);
const LOWER_RISK_REVIEW_CLASSES = new Set([
  'DERIVED_VIEW',
  'REPETITIVE_TELEMETRY',
  'TEMPORARY_CAPTURE'
]);

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const output = {};
    for (const key of Object.keys(value).sort()) output[key] = stableValue(value[key]);
    return output;
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function forward(value) {
  return String(value || '').split(path.sep).join('/').replace(/^\.\//, '');
}

function classifyPath(relativePath) {
  const relative = forward(relativePath);
  const lower = relative.toLowerCase();
  const segments = lower.split('/').filter(Boolean);
  const base = segments[segments.length - 1] || '';

  if (
    lower.startsWith('memory/private/') || lower.startsWith('training/datasets/') ||
    lower.startsWith('training/candidates/') || lower.startsWith('projects/') ||
    lower.startsWith('worlds/') || lower.startsWith('museum/') ||
    lower.startsWith('exports/') || segments.includes('user-assets') ||
    segments.includes('game-library') || segments.includes('uploads') ||
    /(^|\/)(\.env|[^/]+\.(?:token|key|secret))$/i.test(lower)
  ) return { id: 'PRIVATE_OR_USER_SOURCE', rule: 'private-user-or-authored-source-path' };

  if (
    lower === '.git' || lower.startsWith('.git/') || lower === 'canon' ||
    lower.startsWith('canon/') || lower.startsWith('backups/') ||
    lower.startsWith('recovery/') || lower.startsWith('config/') ||
    segments.includes('schemas') || /(?:^|[-_.])canon(?:[-_.]|$)/.test(base)
  ) return { id: 'CANONICAL_STATE', rule: 'canon-config-schema-or-recovery-path' };

  if (
    /(?:receipt|evidence|ledger|audit|journal|migration)/.test(lower) ||
    lower.startsWith('intakes/') || segments.includes('proofs')
  ) return { id: 'DURABLE_EVENT', rule: 'receipt-evidence-ledger-audit-or-intake-path' };

  if (
    /(^|\/)(?:sessions?|session-segments?|segments?)(\/|$)/.test(lower) ||
    /(^|\/)session-[^/]+\.(?:json|jsonl|ndjson)$/i.test(lower) ||
    base === 'traces.jsonl'
  ) return { id: 'SESSION_SEGMENT', rule: 'session-segment-or-trace-path' };

  if (
    lower.startsWith('node_modules/') || lower.startsWith('runtime/node/') ||
    lower.startsWith('dist/') || lower.startsWith('build/') ||
    lower.startsWith('coverage/') || lower.startsWith('.cache/') ||
    lower.includes('/node_modules/') || lower.includes('/coverage/') ||
    lower.includes('/growth-snapshots/') || /(^|\/)current-[^/]+\.(?:js|json)$/i.test(lower) ||
    base === 'tools-index.json' || base === 'public-discovery.json' ||
    base === 'module-bundle.json'
  ) return { id: 'DERIVED_VIEW', rule: 'dependency-cache-build-or-generated-view-path' };

  if (
    lower.startsWith('logs/') || lower.includes('/logs/') ||
    /(?:telemetry|heartbeat|pulse|metrics|runtime\.pid)/.test(lower) ||
    /\.(?:log|etl)$/i.test(base)
  ) return { id: 'REPETITIVE_TELEMETRY', rule: 'log-telemetry-heartbeat-or-pulse-path' };

  if (
    lower.startsWith('tmp/') || lower.startsWith('temp/') ||
    lower.includes('/tmp/') || lower.includes('/temp/') ||
    lower.includes('/captures/') || lower.includes('/screenshots/') ||
    lower.includes('/recordings/') || /(?:\.tmp|\.temp|\.bak)$/i.test(base)
  ) return { id: 'TEMPORARY_CAPTURE', rule: 'temporary-capture-or-retry-artifact-path' };

  if (lower.startsWith('state/') || lower.includes('/state/')) {
    return { id: 'CANONICAL_STATE', rule: 'unclassified-state-protected-by-default' };
  }
  return { id: 'UNCLASSIFIED', rule: 'no-retention-rule-matched-protected-by-default' };
}

function allocatedEstimate(bytes, allocationUnit) {
  if (!bytes) return 0;
  return Math.ceil(bytes / allocationUnit) * allocationUnit;
}

function physicalKey(stat, rootId, relative) {
  if (Number(stat.ino) > 0) return String(stat.dev) + ':' + String(stat.ino);
  return rootId + ':' + relative;
}

function walkRoot(spec, options = {}) {
  const root = path.resolve(spec.path);
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('root must be a regular non-symlink directory: ' + spec.id);
  }
  const allocationUnit = options.allocationUnit || DEFAULT_ALLOCATION_UNIT;
  const files = [];
  const directories = [];
  const skippedSymlinks = [];
  const readIssues = [];
  const stack = [root];

  while (stack.length) {
    const directory = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => right.name.localeCompare(left.name));
    } catch (error) {
      readIssues.push({
        path: forward(path.relative(root, directory)) || '.',
        code: 'DIRECTORY_READ_FAILED',
        message: String(error && error.message || error).slice(0, 240)
      });
      continue;
    }
    let immediateFiles = 0;
    let immediateDirectories = 0;
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = forward(path.relative(root, absolute));
      if (entry.isSymbolicLink()) {
        skippedSymlinks.push(relative);
        continue;
      }
      if (entry.isDirectory()) {
        immediateDirectories += 1;
        stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) {
        readIssues.push({ path: relative, code: 'NON_REGULAR_ENTRY_SKIPPED', message: 'entry is not a regular file' });
        continue;
      }
      immediateFiles += 1;
      try {
        const stat = fs.lstatSync(absolute);
        const retention = classifyPath(relative);
        files.push({
          absolute,
          rootId: spec.id,
          path: relative,
          bytes: stat.size,
          allocatedBytesEstimate: allocatedEstimate(stat.size, allocationUnit),
          modifiedMs: stat.mtimeMs,
          physicalKey: physicalKey(stat, spec.id, relative),
          retentionClass: retention.id,
          classificationRule: retention.rule
        });
      } catch (error) {
        readIssues.push({
          path: relative,
          code: 'FILE_STAT_FAILED',
          message: String(error && error.message || error).slice(0, 240)
        });
      }
    }
    directories.push({
      rootId: spec.id,
      path: forward(path.relative(root, directory)) || '.',
      immediateEntries: entries.length,
      immediateFiles,
      immediateDirectories
    });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  directories.sort((left, right) => left.path.localeCompare(right.path));
  skippedSymlinks.sort();
  readIssues.sort((left, right) => left.path.localeCompare(right.path));
  return { id: spec.id, label: spec.label || spec.id, files, directories, skippedSymlinks, readIssues };
}

function hashFileStable(file) {
  const before = fs.lstatSync(file.absolute);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error('candidate is no longer a regular non-symlink file');
  const handle = fs.openSync(file.absolute, 'r');
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let offset = 0;
    while (true) {
      const read = fs.readSync(handle, buffer, 0, buffer.length, offset);
      if (!read) break;
      hash.update(buffer.subarray(0, read));
      offset += read;
    }
  } finally {
    fs.closeSync(handle);
  }
  const after = fs.lstatSync(file.absolute);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.size !== file.bytes) {
    throw new Error('candidate changed while hashing');
  }
  return hash.digest('hex');
}

function exactDuplicates(files, options = {}) {
  const hashMode = options.hashMode === 'none' ? 'none' : 'duplicates';
  const hashClasses = Array.isArray(options.hashClasses) && options.hashClasses.length
    ? new Set(options.hashClasses)
    : null;
  const eligibleFiles = hashClasses ? files.filter(file => hashClasses.has(file.retentionClass)) : files;
  const maxHashBytes = Number.isFinite(options.maxHashBytes) && options.maxHashBytes >= 0
    ? options.maxHashBytes
    : Number.POSITIVE_INFINITY;
  const bySize = new Map();
  for (const file of eligibleFiles) {
    if (!bySize.has(file.bytes)) bySize.set(file.bytes, []);
    bySize.get(file.bytes).push(file);
  }
  const candidates = Array.from(bySize.values()).filter(group => group.length > 1);
  const hashed = [];
  const hashIssues = [];
  let bytesHashed = 0;
  let filesHashed = 0;
  let filesSkippedByLimit = 0;
  if (hashMode !== 'none') {
    for (const group of candidates) {
      for (const file of group) {
        if (file.bytes > maxHashBytes) {
          filesSkippedByLimit += 1;
          continue;
        }
        try {
          hashed.push({ file, sha256: hashFileStable(file) });
          bytesHashed += file.bytes;
          filesHashed += 1;
        } catch (error) {
          hashIssues.push({
            rootId: file.rootId,
            path: file.path,
            code: 'HASH_READ_FAILED_OR_CHANGED',
            message: String(error && error.message || error).slice(0, 240)
          });
        }
      }
    }
  }
  const groups = new Map();
  for (const item of hashed) {
    const key = item.file.bytes + ':' + item.sha256;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item.file);
  }
  const duplicates = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const separator = key.indexOf(':');
    const bytes = Number(key.slice(0, separator));
    const digest = key.slice(separator + 1);
    const physicalCopies = new Set(group.map(file => file.physicalKey)).size;
    const classes = Array.from(new Set(group.map(file => file.retentionClass))).sort();
    const lowerRiskOnly = classes.every(value => LOWER_RISK_REVIEW_CLASSES.has(value));
    const paths = group.map(file => ({ rootId: file.rootId, path: file.path, retentionClass: file.retentionClass }))
      .sort((left, right) => left.rootId.localeCompare(right.rootId) || left.path.localeCompare(right.path));
    duplicates.push({
      id: digest.slice(0, 20) + '-' + bytes,
      sha256: digest,
      bytesPerFile: bytes,
      filePaths: group.length,
      physicalCopies,
      redundantLogicalPaths: group.length - 1,
      redundantPhysicalBytes: Math.max(0, physicalCopies - 1) * bytes,
      retentionClasses: classes,
      reviewState: lowerRiskOnly ? 'LOWER_RISK_REVIEW' : 'PROTECTED_OR_MIXED_HOLD',
      paths: paths.slice(0, 50),
      pathsOmitted: Math.max(0, paths.length - 50)
    });
  }
  duplicates.sort((left, right) =>
    right.redundantPhysicalBytes - left.redundantPhysicalBytes ||
    right.redundantLogicalPaths - left.redundantLogicalPaths ||
    left.id.localeCompare(right.id)
  );
  return {
    mode: hashMode,
    scope: hashClasses ? Array.from(hashClasses).sort() : ['ALL_CLASSES'],
    eligibleFiles: eligibleFiles.length,
    candidateSizeGroups: candidates.length,
    candidateFiles: candidates.reduce((sum, group) => sum + group.length, 0),
    filesHashed,
    bytesHashed,
    filesSkippedByLimit,
    hashIssues,
    coverageComplete: hashMode !== 'none' && filesSkippedByLimit === 0 && hashIssues.length === 0,
    wholeRootCoverageComplete: !hashClasses && hashMode !== 'none' && filesSkippedByLimit === 0 && hashIssues.length === 0,
    groups: duplicates
  };
}

function summarizeClasses(files, duplicateGroups) {
  const summary = Object.fromEntries(CLASSES.map(id => [id, {
    id, files: 0, logicalBytes: 0, allocatedBytesEstimate: 0,
    exactDuplicateGroupMemberships: 0
  }]));
  for (const file of files) {
    const item = summary[file.retentionClass];
    item.files += 1;
    item.logicalBytes += file.bytes;
    item.allocatedBytesEstimate += file.allocatedBytesEstimate;
  }
  for (const group of duplicateGroups) {
    for (const retentionClass of group.retentionClasses) {
      summary[retentionClass].exactDuplicateGroupMemberships += 1;
    }
  }
  return CLASSES.map(id => summary[id]);
}

function previousDelta(current, previous) {
  if (!previous || previous.schema !== PRESSURE_SCHEMA || !previous.summary) {
    return { state: 'BASELINE_ONLY', previousSnapshotId: null, elapsedHours: null, totalFiles: null, logicalBytes: null, logicalBytesPerDay: null };
  }
  const currentMs = Date.parse(current.measuredAt);
  const previousMs = Date.parse(previous.measuredAt);
  if (!Number.isFinite(currentMs) || !Number.isFinite(previousMs) || currentMs <= previousMs) {
    return { state: 'INVALID_OR_NON_FORWARD_WINDOW', previousSnapshotId: previous.snapshotId || null, elapsedHours: null, totalFiles: null, logicalBytes: null, logicalBytesPerDay: null };
  }
  const elapsedHours = (currentMs - previousMs) / 3600000;
  const logicalBytes = current.summary.logicalBytes - Number(previous.summary.logicalBytes || 0);
  return {
    state: elapsedHours < 1 ? 'SHORT_WINDOW_ESTIMATE' : 'MEASURED_WINDOW',
    previousSnapshotId: previous.snapshotId || null,
    elapsedHours,
    totalFiles: current.summary.files - Number(previous.summary.files || 0),
    logicalBytes,
    logicalBytesPerDay: logicalBytes / (elapsedHours / 24)
  };
}

function scanRoots(rootSpecs, options = {}) {
  if (!Array.isArray(rootSpecs) || !rootSpecs.length) throw new Error('at least one explicit root is required');
  const ids = rootSpecs.map(spec => String(spec.id || '').trim());
  if (ids.some(id => !/^[a-z0-9][a-z0-9._-]*$/i.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error('root IDs must be unique safe tokens');
  }
  const allocationUnit = Number.isFinite(options.allocationUnit) && options.allocationUnit > 0
    ? Math.floor(options.allocationUnit)
    : DEFAULT_ALLOCATION_UNIT;
  const walkedRoots = rootSpecs.map(spec => walkRoot(spec, { allocationUnit }));
  const files = walkedRoots.flatMap(root => root.files);
  const duplicateEvidence = exactDuplicates(files, options);
  const classSummary = summarizeClasses(files, duplicateEvidence.groups);
  const measuredAt = options.now || new Date().toISOString();
  const rootSummary = walkedRoots.map(root => ({
    id: root.id,
    label: root.label,
    files: root.files.length,
    directories: root.directories.length,
    logicalBytes: root.files.reduce((sum, file) => sum + file.bytes, 0),
    allocatedBytesEstimate: root.files.reduce((sum, file) => sum + file.allocatedBytesEstimate, 0),
    skippedSymlinks: root.skippedSymlinks.length,
    readIssues: root.readIssues.length
  }));
  const directoryPressure = walkedRoots.flatMap(root => root.directories)
    .sort((left, right) => right.immediateEntries - left.immediateEntries || left.rootId.localeCompare(right.rootId) || left.path.localeCompare(right.path))
    .slice(0, 100);
  const duplicateGroups = duplicateEvidence.groups.slice(0, 100);
  const summary = {
    roots: rootSummary.length,
    files: files.length,
    directories: rootSummary.reduce((sum, root) => sum + root.directories, 0),
    logicalBytes: rootSummary.reduce((sum, root) => sum + root.logicalBytes, 0),
    allocatedBytesEstimate: rootSummary.reduce((sum, root) => sum + root.allocatedBytesEstimate, 0),
    allocationOverheadEstimate: rootSummary.reduce((sum, root) => sum + root.allocatedBytesEstimate - root.logicalBytes, 0),
    exactDuplicateGroups: duplicateEvidence.groups.length,
    exactDuplicateLogicalPaths: duplicateEvidence.groups.reduce((sum, group) => sum + group.redundantLogicalPaths, 0),
    exactDuplicatePhysicalBytes: duplicateEvidence.groups.reduce((sum, group) => sum + group.redundantPhysicalBytes, 0),
    lowerRiskReviewGroups: duplicateEvidence.groups.filter(group => group.reviewState === 'LOWER_RISK_REVIEW').length,
    protectedOrMixedHoldGroups: duplicateEvidence.groups.filter(group => group.reviewState === 'PROTECTED_OR_MIXED_HOLD').length,
    skippedSymlinks: rootSummary.reduce((sum, root) => sum + root.skippedSymlinks, 0),
    readIssues: rootSummary.reduce((sum, root) => sum + root.readIssues, 0) + duplicateEvidence.hashIssues.length
  };
  const fingerprintMaterial = {
    allocationUnit,
    rootSummary,
    classSummary,
      duplicateCoverage: {
        mode: duplicateEvidence.mode,
        scope: duplicateEvidence.scope,
        eligibleFiles: duplicateEvidence.eligibleFiles,
      filesHashed: duplicateEvidence.filesHashed,
      bytesHashed: duplicateEvidence.bytesHashed,
      filesSkippedByLimit: duplicateEvidence.filesSkippedByLimit,
      hashIssues: duplicateEvidence.hashIssues
    },
    duplicateGroups: duplicateEvidence.groups,
    directoryPressure,
    skippedSymlinks: walkedRoots.map(root => ({ id: root.id, paths: root.skippedSymlinks })),
    readIssues: walkedRoots.map(root => ({ id: root.id, issues: root.readIssues }))
  };
  const map = {
    schema: PRESSURE_SCHEMA,
    version: 'v0.1',
    snapshotId: 'storage-pressure-' + measuredAt.replace(/[^0-9]/g, '').slice(0, 17),
    measuredAt,
    source: {
      fingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
      rootPathsIncluded: false,
      symlinksFollowed: false,
      fileBodiesRead: 'same-size SHA-256 duplicate candidates only',
      allocationUnitBytes: allocationUnit,
      allocatedBytesState: 'CLUSTER_ROUNDED_ESTIMATE_NOT_SPARSE_OR_COMPRESSION_AWARE'
    },
    summary,
    roots: rootSummary,
    retentionClasses: classSummary,
    duplicateCoverage: {
      mode: duplicateEvidence.mode,
      scope: duplicateEvidence.scope,
      eligibleFiles: duplicateEvidence.eligibleFiles,
      candidateSizeGroups: duplicateEvidence.candidateSizeGroups,
      candidateFiles: duplicateEvidence.candidateFiles,
      filesHashed: duplicateEvidence.filesHashed,
      bytesHashed: duplicateEvidence.bytesHashed,
      filesSkippedByLimit: duplicateEvidence.filesSkippedByLimit,
      coverageComplete: duplicateEvidence.coverageComplete,
      wholeRootCoverageComplete: duplicateEvidence.wholeRootCoverageComplete,
      hashIssues: duplicateEvidence.hashIssues
    },
    exactDuplicateGroups: duplicateGroups,
    exactDuplicateGroupsOmitted: Math.max(0, duplicateEvidence.groups.length - duplicateGroups.length),
    directoryPressure,
    growth: null,
    reviewProposals: [
      {
        id: 'exact-duplicate-review',
        state: duplicateEvidence.groups.length ? 'REVIEW_AVAILABLE' : 'NO_GROUP_OBSERVED',
        groups: duplicateEvidence.groups.length,
        boundary: 'Review content identity and ownership. No keep/delete target is selected.'
      },
      {
        id: 'repetitive-telemetry-retention-review',
        state: classSummary.find(item => item.id === 'REPETITIVE_TELEMETRY').files ? 'REVIEW_AVAILABLE' : 'NO_FILES_OBSERVED',
        files: classSummary.find(item => item.id === 'REPETITIVE_TELEMETRY').files,
        boundary: 'Prefer bounded checkpoints plus aggregate counts only after the owning module confirms replay and audit needs.'
      },
      {
        id: 'derived-view-regeneration-review',
        state: classSummary.find(item => item.id === 'DERIVED_VIEW').files ? 'REVIEW_AVAILABLE' : 'NO_FILES_OBSERVED',
        files: classSummary.find(item => item.id === 'DERIVED_VIEW').files,
        boundary: 'Regenerability is not assumed from path class alone. Verify a rebuild path before any cleanup proposal.'
      }
    ],
    classificationBoundary: 'Retention classes are deterministic path-based operational labels, not semantic truth. CANONICAL_STATE, DURABLE_EVENT, PRIVATE_OR_USER_SOURCE, and UNCLASSIFIED are protected by default. A duplicate hash proves equal bytes at observation time, not that either path is disposable.',
    truth: {
      contentIdentityForReportedGroupsProven: duplicateEvidence.groups.length > 0,
      duplicateScopeCoverageComplete: duplicateEvidence.coverageComplete,
      duplicateCoverageComplete: duplicateEvidence.wholeRootCoverageComplete,
      allocatedBytesExact: false,
      semanticImportanceInferred: false,
      deletionTargetSelected: false,
      deletionPerformed: false,
      compressionPerformed: false,
      hardlinkPerformed: false,
      sourceMutationPerformed: false,
      permissionChanged: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
  map.growth = previousDelta(map, options.previous);
  return map;
}

module.exports = {
  PRESSURE_SCHEMA,
  DEFAULT_ALLOCATION_UNIT,
  CLASSES,
  classifyPath,
  allocatedEstimate,
  walkRoot,
  hashFileStable,
  exactDuplicates,
  previousDelta,
  scanRoots
};
