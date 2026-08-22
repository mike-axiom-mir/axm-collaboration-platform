'use strict';

const crypto = require('node:crypto');

const SNAPSHOT_SCHEMA = 'shared-workspace-snapshot/v1';
const ANALYSIS_SCHEMA = 'axm.workspace-activity-analysis/v1';
const COMPARISON_SCHEMA = 'axm.workspace-activity-comparison/v1';
const DEFAULT_FUTURE_TOLERANCE_MS = 2 * 60 * 1000;
const DEFAULT_SAMPLE_LIMIT = 200;
const MAX_SAMPLE_LIMIT = 1000;
const WORKSHOP_EXACT_SHARED_SEAMS = new Set(['tools-index.json']);
const SHARED_SEAM_NAMES = new Set([
  'agents.md', 'package.json', 'package-lock.json', 'pnpm-lock.yaml',
  'yarn.lock', 'pyproject.toml', 'requirements.txt', 'cargo.toml',
  'cargo.lock', 'manifest.json', 'module.contract.json', 'skill.md'
]);
const SHARED_SEAM_WORDS = ['registry', 'catalog', 'manifest', 'contract', 'router', 'routes', 'schema', 'entrypoint', 'operations-api'];
const CONFLICT_CODES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sha256(value) {
  const body = typeof value === 'string' ? value : JSON.stringify(value);
  return crypto.createHash('sha256').update(body).digest('hex');
}

function sampleLimit(options) {
  return Math.min(MAX_SAMPLE_LIMIT, Math.max(1, Math.floor(finiteNumber(options && options.sampleLimit, DEFAULT_SAMPLE_LIMIT))));
}

function boundedRows(rows, limit, projection) {
  const projected = rows.map(projection || function (row) { return row; });
  return {
    rows: rows.slice(0, limit),
    evidence: {
      total: rows.length,
      returned: Math.min(rows.length, limit),
      truncated: rows.length > limit,
      sha256: sha256(projected)
    }
  };
}

function timestamp(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function relativePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function comparePath(a, b) {
  return a.path.localeCompare(b.path);
}

function isSharedSeam(path, declared) {
  const lower = path.toLowerCase();
  const name = lower.split('/').pop() || '';
  const stem = name.replace(/\.[^.]*$/, '');
  return declared === true || WORKSHOP_EXACT_SHARED_SEAMS.has(lower) || SHARED_SEAM_NAMES.has(name) || SHARED_SEAM_WORDS.some(function (word) { return stem.includes(word); });
}

function decodeGitPath(value) {
  value = String(value || '').trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try { return relativePath(JSON.parse(value)); }
    catch (_) { return relativePath(value.slice(1, -1)); }
  }
  return relativePath(value);
}

function parseGitStatusLine(line) {
  const raw = String(line == null ? '' : line);
  if (raw.length < 4 || raw[2] !== ' ') return { valid: false, raw };
  const xy = raw.slice(0, 2);
  let pathText = raw.slice(3);
  let fromPath = null;
  if ((xy.includes('R') || xy.includes('C')) && pathText.includes(' -> ')) {
    const parts = pathText.split(' -> ');
    pathText = parts.pop();
    fromPath = decodeGitPath(parts.join(' -> '));
  }
  const path = decodeGitPath(pathText);
  if (!path) return { valid: false, raw };
  const conflict = CONFLICT_CODES.has(xy);
  const untracked = xy === '??';
  const ignored = xy === '!!';
  return {
    valid: true,
    raw,
    xy,
    indexStatus: xy[0],
    worktreeStatus: xy[1],
    path,
    fromPath,
    sharedSeam: isSharedSeam(path, false),
    untracked,
    ignored,
    conflict,
    staged: !untracked && !ignored && !conflict && xy[0] !== ' ',
    worktreeChanged: !untracked && !ignored && !conflict && xy[1] !== ' '
  };
}

function normalizeGitStatus(lines) {
  return (Array.isArray(lines) ? lines : []).map(function (line, index) {
    const parsed = parseGitStatusLine(line);
    const raw = String(line == null ? '' : line);
    if (!parsed.valid && index === 0 && /^[MADRCUT] \S/.test(raw)) {
      const recovered = parseGitStatusLine(' ' + raw);
      if (recovered.valid) {
        recovered.raw = raw;
        recovered.transportRecovery = 'LEADING_INDEX_SPACE_STRIPPED';
        return recovered;
      }
    }
    return parsed;
  });
}

function analyzeGitStatus(lines) {
  const rows = normalizeGitStatus(lines);
  const valid = rows.filter(function (row) { return row.valid; });
  const invalid = rows.filter(function (row) { return !row.valid; });
  const countCode = function (code) { return valid.filter(function (row) { return row.xy.includes(code); }).length; };
  const shared = valid.filter(function (row) { return row.sharedSeam; }).map(function (row) { return row.path; }).sort();
  const concentrations = new Map();
  valid.forEach(function (row) {
    const topLevel = row.path.includes('/') ? row.path.split('/')[0] : '<root>';
    const group = concentrations.get(topLevel) || { path: topLevel, total: 0, tracked: 0, untracked: 0, deleted: 0, conflicted: 0, sharedSeams: 0 };
    group.total += 1;
    group.tracked += row.untracked || row.ignored ? 0 : 1;
    group.untracked += row.untracked ? 1 : 0;
    group.deleted += row.xy.includes('D') ? 1 : 0;
    group.conflicted += row.conflict ? 1 : 0;
    group.sharedSeams += row.sharedSeam ? 1 : 0;
    concentrations.set(topLevel, group);
  });
  const rankedConcentrations = Array.from(concentrations.values()).sort(function (a, b) { return b.total - a.total || a.path.localeCompare(b.path); });
  const normalizedDigestRows = rows.map(function (row) {
    return row.valid
      ? [row.xy, row.path, row.fromPath, row.sharedSeam, row.transportRecovery || null]
      : ['INVALID', row.raw];
  }).sort(function (a, b) { return JSON.stringify(a).localeCompare(JSON.stringify(b)); });
  return {
    statusDigest: sha256(normalizedDigestRows),
    counts: {
      total: rows.length,
      valid: valid.length,
      invalid: invalid.length,
      transportRecovered: valid.filter(function (row) { return !!row.transportRecovery; }).length,
      tracked: valid.filter(function (row) { return !row.untracked && !row.ignored; }).length,
      untracked: valid.filter(function (row) { return row.untracked; }).length,
      ignored: valid.filter(function (row) { return row.ignored; }).length,
      staged: valid.filter(function (row) { return row.staged; }).length,
      worktreeChanged: valid.filter(function (row) { return row.worktreeChanged; }).length,
      conflicted: valid.filter(function (row) { return row.conflict; }).length,
      modified: countCode('M'),
      added: countCode('A'),
      deleted: countCode('D'),
      renamed: countCode('R'),
      copied: countCode('C'),
      typeChanged: countCode('T'),
      sharedSeams: shared.length
    },
    sampleSharedSeamPaths: shared.slice(0, 50),
    topLevelConcentrations: rankedConcentrations.slice(0, 25),
    sampleInvalidLines: invalid.slice(0, 20).map(function (row) { return row.raw; }),
    samplesTruncated: shared.length > 50 || invalid.length > 20 || rankedConcentrations.length > 25,
    truth: {
      categoriesOverlap: true,
      transportRecoveryApplied: valid.some(function (row) { return !!row.transportRecovery; }),
      ownershipAssigned: false,
      filesystemReadPerformed: false
    }
  };
}

function normalizeFiles(snapshot) {
  const byPath = new Map();
  const source = Array.isArray(snapshot.recentFiles) ? snapshot.recentFiles : [];
  source.forEach(function (item) {
    const path = relativePath(item && item.path);
    if (!path) return;
    byPath.set(path, {
      path,
      modifiedAt: item.modifiedAt == null ? null : String(item.modifiedAt),
      sizeBytes: Math.max(0, finiteNumber(item.sizeBytes, 0)),
      sharedSeam: isSharedSeam(path, item.sharedSeam),
      sha256: typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(item.sha256) ? item.sha256.toLowerCase() : null
    });
  });
  return Array.from(byPath.values()).sort(comparePath);
}

function normalizedScanScope(snapshot) {
  const scan = snapshot && snapshot.scan;
  if (!scan || typeof scan !== 'object' || Array.isArray(scan)) return null;
  const excludedDirectoryNames = Array.isArray(scan.excludedDirectoryNames)
    ? Array.from(new Set(scan.excludedDirectoryNames.map(function (name) { return String(name).trim().toLowerCase(); }).filter(Boolean))).sort()
    : [];
  const maxFiles = Number.isInteger(Number(scan.maxFiles)) && Number(scan.maxFiles) > 0 ? Number(scan.maxFiles) : null;
  return {
    maxFiles,
    excludedDirectoryNames,
    symlinksFollowed: typeof scan.symlinksFollowed === 'boolean' ? scan.symlinksFollowed : null,
    fileContentRead: typeof scan.fileContentRead === 'boolean' ? scan.fileContentRead : null
  };
}

function scanScopeSummary(snapshot) {
  const policy = normalizedScanScope(snapshot);
  const excludedDirectoryDigest = snapshot && snapshot.excludedDirectoryEvidence && /^[a-f0-9]{64}$/i.test(String(snapshot.excludedDirectoryEvidence.sha256 || ''))
    ? String(snapshot.excludedDirectoryEvidence.sha256).toLowerCase()
    : null;
  const skippedSymlinkDigest = snapshot && snapshot.skippedSymlinkEvidence && /^[a-f0-9]{64}$/i.test(String(snapshot.skippedSymlinkEvidence.sha256 || ''))
    ? String(snapshot.skippedSymlinkEvidence.sha256).toLowerCase()
    : null;
  return {
    declared: policy !== null,
    digest: policy === null ? null : sha256(policy),
    boundaryDigest: excludedDirectoryDigest === null && skippedSymlinkDigest === null ? null : sha256({ excludedDirectoryDigest, skippedSymlinkDigest }),
    policy
  };
}

function scanIntegrityIssues(snapshot) {
  const issues = [];
  const counts = snapshot && snapshot.counts || {};
  const scan = snapshot && snapshot.scan;
  const computedComplete = snapshot && snapshot.truncated !== true && Math.max(0, finiteNumber(counts.scanErrors, 0)) === 0;
  const policy = normalizedScanScope(snapshot);
  if (scan) {
    if (typeof scan.complete !== 'boolean') issues.push('SCAN_COMPLETE_UNDECLARED');
    else if (scan.complete !== computedComplete) issues.push('SCAN_COMPLETE_CONTRADICTS_COUNTS');
    if (policy.maxFiles === null || !Array.isArray(scan.excludedDirectoryNames) || policy.symlinksFollowed === null || policy.fileContentRead === null) issues.push('SCAN_POLICY_INCOMPLETE');
  }
  [
    ['scanErrorEvidence', 'scanErrors', 'SCAN_ERROR'],
    ['excludedDirectoryEvidence', 'excludedDirectories', 'EXCLUDED_DIRECTORY'],
    ['skippedSymlinkEvidence', 'skippedSymlinks', 'SKIPPED_SYMLINK']
  ].forEach(function (pair) {
    const evidence = snapshot && snapshot[pair[0]];
    if (!evidence || typeof evidence !== 'object') {
      if (scan) issues.push(pair[2] + '_EVIDENCE_MISSING');
      return;
    }
    const total = Number(evidence.total);
    const count = Math.max(0, finiteNumber(counts[pair[1]], 0));
    if (!Number.isInteger(total) || total < 0 || total !== count) issues.push(pair[2] + '_TOTAL_MISMATCH');
    if (!/^[a-f0-9]{64}$/i.test(String(evidence.sha256 || ''))) issues.push(pair[2] + '_DIGEST_INVALID');
  });
  return issues;
}

function observationCoherenceSummary(snapshot) {
  const observation = snapshot && snapshot.observation;
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    return { declared: false, coherent: null, issues: [], startedAt: null, completedAt: null, durationMs: null, metadataPasses: null };
  }
  const issues = [];
  const startedMs = timestamp(observation.startedAt);
  const completedMs = timestamp(observation.completedAt);
  const durationMs = finiteNumber(observation.durationMs, null);
  const metadataPasses = Number(observation.metadataPasses);
  const scanStable = observation.scanStableAcrossObservation;
  const gitStable = observation.gitStatusStableAcrossObservation;
  const coherent = observation.coherentWithinDeclaredMetadataScope;
  const scanBeforeDigest = /^[a-f0-9]{64}$/i.test(String(observation.scanBeforeDigest || '')) ? String(observation.scanBeforeDigest).toLowerCase() : null;
  const scanAfterDigest = /^[a-f0-9]{64}$/i.test(String(observation.scanAfterDigest || '')) ? String(observation.scanAfterDigest).toLowerCase() : null;
  const gitBeforeDigest = /^[a-f0-9]{64}$/i.test(String(observation.gitBeforeDigest || '')) ? String(observation.gitBeforeDigest).toLowerCase() : null;
  const gitAfterDigest = /^[a-f0-9]{64}$/i.test(String(observation.gitAfterDigest || '')) ? String(observation.gitAfterDigest).toLowerCase() : null;
  const sourceMetadataEvidence = observation.metadataChangeEvidence;
  let metadataChangeEvidence = null;
  if (!sourceMetadataEvidence || typeof sourceMetadataEvidence !== 'object' || Array.isArray(sourceMetadataEvidence)) {
    issues.push('METADATA_CHANGE_EVIDENCE_MISSING');
  } else {
    const total = Number(sourceMetadataEvidence.total);
    const returned = Number(sourceMetadataEvidence.returned);
    const sample = Array.isArray(sourceMetadataEvidence.sample) ? sourceMetadataEvidence.sample.slice(0, 20) : null;
    const digest = /^[a-f0-9]{64}$/i.test(String(sourceMetadataEvidence.sha256 || '')) ? String(sourceMetadataEvidence.sha256).toLowerCase() : null;
    if (!Number.isInteger(total) || total < 0 || !Number.isInteger(returned) || returned < 0 || returned > total || sample === null || sample.length !== returned || sourceMetadataEvidence.sample.length > 20 || digest === null || typeof sourceMetadataEvidence.truncated !== 'boolean' || sourceMetadataEvidence.truncated !== (total > returned)) issues.push('METADATA_CHANGE_EVIDENCE_INVALID');
    metadataChangeEvidence = { total: Number.isInteger(total) ? total : null, returned: Number.isInteger(returned) ? returned : null, truncated: sourceMetadataEvidence.truncated === true, sha256: digest, sample: sample || [] };
  }
  if (startedMs === null || completedMs === null || completedMs < startedMs) issues.push('OBSERVATION_WINDOW_INVALID');
  if (startedMs !== null && completedMs !== null && (durationMs === null || durationMs < 0 || durationMs !== completedMs - startedMs)) issues.push('OBSERVATION_DURATION_MISMATCH');
  if (completedMs !== null && timestamp(snapshot.generatedAt) !== completedMs) issues.push('GENERATED_AT_NOT_OBSERVATION_COMPLETION');
  if (!Number.isInteger(metadataPasses) || metadataPasses < 2) issues.push('METADATA_BRACKET_INCOMPLETE');
  if (typeof scanStable !== 'boolean') issues.push('SCAN_STABILITY_UNDECLARED');
  if (!(typeof gitStable === 'boolean' || gitStable === null)) issues.push('GIT_STABILITY_UNDECLARED');
  if (typeof coherent !== 'boolean') issues.push('OBSERVATION_COHERENCE_UNDECLARED');
  if (scanBeforeDigest === null || scanAfterDigest === null) issues.push('SCAN_BRACKET_DIGEST_INVALID');
  if (gitStable === true && (gitBeforeDigest === null || gitAfterDigest === null)) issues.push('GIT_BRACKET_DIGEST_INVALID');
  if (scanBeforeDigest !== null && scanAfterDigest !== null && typeof scanStable === 'boolean' && scanStable !== (scanBeforeDigest === scanAfterDigest)) issues.push('SCAN_STABILITY_CONTRADICTS_DIGESTS');
  if (gitBeforeDigest !== null && gitAfterDigest !== null && typeof gitStable === 'boolean' && gitStable !== (gitBeforeDigest === gitAfterDigest)) issues.push('GIT_STABILITY_CONTRADICTS_DIGESTS');
  if (scanStable === false) issues.push('SCAN_CHANGED_DURING_OBSERVATION');
  if (scanStable === true && metadataChangeEvidence && metadataChangeEvidence.total !== 0) issues.push('STABLE_SCAN_HAS_METADATA_CHANGES');
  if (gitStable === false) issues.push('GIT_STATUS_CHANGED_DURING_OBSERVATION');
  if (typeof scanStable === 'boolean' && (typeof gitStable === 'boolean' || gitStable === null) && typeof coherent === 'boolean' && coherent !== (scanStable && gitStable !== false)) issues.push('OBSERVATION_COHERENCE_CONTRADICTS_BRACKETS');
  return {
    declared: true,
    coherent: coherent === true,
    issues,
    startedAt: startedMs === null ? null : new Date(startedMs).toISOString(),
    completedAt: completedMs === null ? null : new Date(completedMs).toISOString(),
    durationMs,
    metadataPasses: Number.isInteger(metadataPasses) ? metadataPasses : null,
    scanBeforeDigest,
    scanAfterDigest,
    gitBeforeDigest,
    gitAfterDigest,
    metadataChangeEvidence,
    scanStableAcrossObservation: typeof scanStable === 'boolean' ? scanStable : null,
    gitStatusStableAcrossObservation: typeof gitStable === 'boolean' || gitStable === null ? gitStable : null
  };
}

function gitObservationPolicySummary(snapshot) {
  const source = snapshot && snapshot.git && snapshot.git.observationPolicy;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return { declared: false, digest: null, policy: null, issues: [] };
  const booleanOrNull = function (value) { return typeof value === 'boolean' ? value : null; };
  const configuredFilterCount = Number(source.configuredFilterCount);
  const configuredFilterDigest = /^[a-f0-9]{64}$/i.test(String(source.configuredFilterDigest || '')) ? String(source.configuredFilterDigest).toLowerCase() : null;
  const policy = {
    optionalLocksDisabled: booleanOrNull(source.optionalLocksDisabled),
    fsMonitorDisabled: booleanOrNull(source.fsMonitorDisabled),
    hooksPathDisabled: booleanOrNull(source.hooksPathDisabled),
    terminalPromptDisabled: booleanOrNull(source.terminalPromptDisabled),
    repositoryFiltersGloballyDisabled: booleanOrNull(source.repositoryFiltersGloballyDisabled),
    configuredFilterCount: Number.isInteger(configuredFilterCount) && configuredFilterCount >= 0 ? configuredFilterCount : null,
    configuredFilterDigest
  };
  const issues = [];
  if (policy.optionalLocksDisabled !== true) issues.push('GIT_OPTIONAL_LOCKS_NOT_DISABLED');
  if (policy.fsMonitorDisabled !== true) issues.push('GIT_FSMONITOR_NOT_DISABLED');
  if (policy.hooksPathDisabled !== true) issues.push('GIT_HOOKS_PATH_NOT_DISABLED');
  if (policy.terminalPromptDisabled !== true) issues.push('GIT_TERMINAL_PROMPT_NOT_DISABLED');
  if (policy.repositoryFiltersGloballyDisabled === null) issues.push('GIT_FILTER_BOUNDARY_UNDECLARED');
  if (policy.repositoryFiltersGloballyDisabled === true && (policy.configuredFilterCount === null || policy.configuredFilterDigest === null)) issues.push('GIT_FILTER_OVERRIDE_EVIDENCE_INVALID');
  return { declared: true, digest: sha256(policy), policy, issues };
}

function observationDigest(snapshot, files, gitStatus) {
  const declaredWindows = windows(snapshot);
  const declaredGitComplete = snapshot.git.complete === true ? true : snapshot.git.complete === false ? false : null;
  const scanScope = scanScopeSummary(snapshot);
  const observationCoherence = observationCoherenceSummary(snapshot);
  const gitObservationPolicy = gitObservationPolicySummary(snapshot);
  return sha256({
    schema: snapshot.schema,
    root: snapshot.root.replace(/\\/g, '/'),
    generatedAt: snapshot.generatedAt,
    branch: snapshot.git.branch || null,
    gitComplete: declaredGitComplete,
    scanComplete: snapshot.scan && typeof snapshot.scan.complete === 'boolean' ? snapshot.scan.complete : null,
    truncated: snapshot.truncated === true,
    filesScanned: Math.max(0, finiteNumber(snapshot.counts && snapshot.counts.filesScanned, 0)),
    scanErrors: Math.max(0, finiteNumber(snapshot.counts && snapshot.counts.scanErrors, 0)),
    skippedSymlinks: Math.max(0, finiteNumber(snapshot.counts && snapshot.counts.skippedSymlinks, 0)),
    excludedDirectories: Math.max(0, finiteNumber(snapshot.counts && snapshot.counts.excludedDirectories, 0)),
    scanScopeDigest: scanScope.digest,
    scanBoundaryDigest: scanScope.boundaryDigest,
    scanErrorEvidenceDigest: snapshot.scanErrorEvidence && /^[a-f0-9]{64}$/i.test(String(snapshot.scanErrorEvidence.sha256 || '')) ? String(snapshot.scanErrorEvidence.sha256).toLowerCase() : null,
    observationCoherence,
    gitObservationPolicy,
    windowsMinutes: { recent: declaredWindows.recentMinutes, active: declaredWindows.activeMinutes },
    gitStatusDigest: gitStatus.statusDigest,
    files: files.map(function (file) { return [file.path, file.modifiedAt, file.sizeBytes, file.sharedSeam, file.sha256]; })
  });
}

function windows(snapshot) {
  const declared = snapshot.windowsMinutes || {};
  const recentMinutes = Math.max(1, finiteNumber(declared.recent, 30));
  const activeMinutes = Math.min(recentMinutes, Math.max(1, finiteNumber(declared.active, 5)));
  return {
    recentMinutes,
    activeMinutes,
    recentMs: recentMinutes * 60 * 1000,
    activeMs: activeMinutes * 60 * 1000
  };
}

function validateSnapshot(snapshot) {
  assert(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot), 'workspace snapshot must be an object');
  assert(snapshot.schema === SNAPSHOT_SCHEMA, 'unsupported workspace snapshot schema');
  assert(typeof snapshot.root === 'string' && snapshot.root.trim(), 'workspace snapshot root is required');
  assert(timestamp(snapshot.generatedAt) !== null, 'workspace snapshot generatedAt must be an ISO timestamp');
  assert(snapshot.git && typeof snapshot.git === 'object', 'workspace snapshot git section is required');
  assert(Array.isArray(snapshot.git.status), 'workspace snapshot git.status must be an array');
  assert(Array.isArray(snapshot.recentFiles), 'workspace snapshot recentFiles must be an array');
  return true;
}

function analyzeSnapshot(snapshot, options) {
  validateSnapshot(snapshot);
  options = options || {};
  const observedMs = timestamp(snapshot.generatedAt);
  const limit = sampleLimit(options);
  const futureToleranceMs = Math.max(0, finiteNumber(options.futureToleranceMs, DEFAULT_FUTURE_TOLERANCE_MS));
  const declaredWindows = windows(snapshot);
  const files = normalizeFiles(snapshot);
  const gitStatus = analyzeGitStatus(snapshot.git.status);
  const scanErrors = Math.max(0, finiteNumber(snapshot.counts && snapshot.counts.scanErrors, 0));
  const skippedSymlinks = Math.max(0, finiteNumber(snapshot.counts && snapshot.counts.skippedSymlinks, 0));
  const excludedDirectories = Math.max(0, finiteNumber(snapshot.counts && snapshot.counts.excludedDirectories, 0));
  const scanScope = scanScopeSummary(snapshot);
  const scanIntegrity = { issues: scanIntegrityIssues(snapshot) };
  const observationCoherence = observationCoherenceSummary(snapshot);
  const gitObservationPolicy = gitObservationPolicySummary(snapshot);
  const gitIncomplete = snapshot.git.complete === false;
  const plausibleActive = [];
  const plausibleRecent = [];
  const futureDated = [];
  const invalidTime = [];
  const quiet = [];

  files.forEach(function (file) {
    const modifiedMs = timestamp(file.modifiedAt);
    if (modifiedMs === null) {
      invalidTime.push(Object.assign({}, file, { classification: 'INVALID_TIME' }));
      return;
    }
    const ageMs = observedMs - modifiedMs;
    const row = Object.assign({}, file, { ageMs });
    if (ageMs < -futureToleranceMs) {
      futureDated.push(Object.assign(row, { classification: 'FUTURE_DATED' }));
    } else if (ageMs <= declaredWindows.activeMs) {
      plausibleActive.push(Object.assign(row, { classification: 'ACTIVE' }));
    } else if (ageMs <= declaredWindows.recentMs) {
      plausibleRecent.push(Object.assign(row, { classification: 'RECENT' }));
    } else {
      quiet.push(Object.assign(row, { classification: 'OUTSIDE_DECLARED_WINDOW' }));
    }
  });

  const activeSharedSeams = plausibleActive.filter(function (item) { return item.sharedSeam; });
  const recentSharedSeams = plausibleRecent.filter(function (item) { return item.sharedSeam; });
  const truncated = snapshot.truncated === true;
  const activityVerdict = plausibleActive.length ? 'MOVEMENT_OBSERVED' : 'NO_ACTIVE_MOVEMENT_OBSERVED';
  const confidence = truncated || scanErrors || scanIntegrity.issues.length || observationCoherence.issues.length || gitObservationPolicy.issues.length || gitIncomplete || invalidTime.length || futureDated.length || gitStatus.counts.invalid || gitStatus.counts.transportRecovered ? 'QUALIFIED' : 'SCOPED';
  plausibleActive.sort(comparePath);
  plausibleRecent.sort(comparePath);
  futureDated.sort(comparePath);
  invalidTime.sort(comparePath);
  const activeSample = boundedRows(plausibleActive, limit, function (row) { return [row.path, row.modifiedAt, row.sizeBytes, row.sharedSeam, row.sha256, row.classification]; });
  const recentSample = boundedRows(plausibleRecent, limit, function (row) { return [row.path, row.modifiedAt, row.sizeBytes, row.sharedSeam, row.sha256, row.classification]; });
  const futureSample = boundedRows(futureDated, limit, function (row) { return [row.path, row.modifiedAt, row.sizeBytes, row.sharedSeam, row.sha256, row.classification]; });
  const invalidSample = boundedRows(invalidTime, limit, function (row) { return [row.path, row.modifiedAt, row.sizeBytes, row.sharedSeam, row.sha256, row.classification]; });

  return {
    schema: ANALYSIS_SCHEMA,
    sourceSchema: snapshot.schema,
    root: snapshot.root,
    observedAt: snapshot.generatedAt,
    branch: snapshot.git.branch || null,
    sourceObservationDigest: observationDigest(snapshot, files, gitStatus),
    windowsMinutes: {
      recent: declaredWindows.recentMinutes,
      active: declaredWindows.activeMinutes,
      futureTolerance: futureToleranceMs / 60000
    },
    verdict: activityVerdict,
    confidence,
    scanScope,
    scanIntegrity,
    observationCoherence,
    gitObservationPolicy,
    counts: {
      gitStatusPaths: gitStatus.counts.total,
      filesScanned: Math.max(0, finiteNumber(snapshot.counts && snapshot.counts.filesScanned, 0)),
      scanErrors,
      skippedSymlinks,
      excludedDirectories,
      rawRecentFiles: files.length,
      rawActiveFiles: Math.max(0, finiteNumber(snapshot.counts && snapshot.counts.activeFiles, Array.isArray(snapshot.activeFiles) ? snapshot.activeFiles.length : 0)),
      plausibleActiveFiles: plausibleActive.length,
      plausibleRecentFiles: plausibleRecent.length,
      plausibleActiveSharedSeams: activeSharedSeams.length,
      plausibleRecentSharedSeams: recentSharedSeams.length,
      futureDatedFiles: futureDated.length,
      invalidTimestampFiles: invalidTime.length,
      outsideDeclaredWindowFiles: quiet.length
    },
    plausibleActiveFiles: activeSample.rows,
    plausibleRecentFiles: recentSample.rows,
    futureDatedFiles: futureSample.rows,
    invalidTimestampFiles: invalidSample.rows,
    sampleEvidence: {
      limit,
      plausibleActiveFiles: activeSample.evidence,
      plausibleRecentFiles: recentSample.evidence,
      futureDatedFiles: futureSample.evidence,
      invalidTimestampFiles: invalidSample.evidence
    },
    gitStatus,
    cautions: [
      truncated ? 'The source scan was truncated; absence from the observation is not proof of absence.' : null,
      scanErrors ? scanErrors + ' filesystem scan error(s) make the observation incomplete.' : null,
      gitIncomplete ? 'The Git status observation is explicitly incomplete.' : null,
      excludedDirectories ? excludedDirectories + ' directory path(s) were outside the declared scan scope.' : null,
      skippedSymlinks ? skippedSymlinks + ' symbolic link(s) were not followed.' : null,
      scanIntegrity.issues.length ? 'The source scan evidence is internally inconsistent: ' + scanIntegrity.issues.join(', ') + '.' : null,
      observationCoherence.issues.length ? 'The observation is not internally coherent: ' + observationCoherence.issues.join(', ') + '.' : null,
      gitObservationPolicy.issues.length ? 'The Git observation policy is incomplete: ' + gitObservationPolicy.issues.join(', ') + '.' : null,
      gitObservationPolicy.policy && gitObservationPolicy.policy.repositoryFiltersGloballyDisabled === false ? 'Configured Git content filters were not globally disabled; use the observer only on an authorized repository.' : null,
      scanScope.policy && scanScope.policy.fileContentRead === false ? 'File content was not read; coherence is limited to filesystem metadata and Git status.' : null,
      futureDated.length ? futureDated.length + ' future-dated file(s) were excluded from active and recent activity counts.' : null,
      invalidTime.length ? invalidTime.length + ' file timestamp(s) could not be interpreted.' : null,
      gitStatus.counts.invalid ? gitStatus.counts.invalid + ' Git status line(s) could not be parsed.' : null,
      gitStatus.counts.transportRecovered ? gitStatus.counts.transportRecovered + ' first Git status line(s) required explicit leading-space transport recovery.' : null,
      activeSharedSeams.length ? activeSharedSeams.length + ' plausible active shared seam(s) require re-reading before and after any edit.' : null
    ].filter(Boolean),
    truth: {
      readOnlyAnalysis: true,
      arraysAreBoundedSamples: true,
      fullEvidenceReconstructibleFromOutput: false,
      sourceScanScopeDeclared: scanScope.declared,
      sourceScanCompleteWithinDeclaredScope: scanScope.declared ? !truncated && scanErrors === 0 && scanIntegrity.issues.length === 0 : null,
      sourceScanIntegrityConsistent: scanIntegrity.issues.length === 0,
      observationCoherenceDeclared: observationCoherence.declared,
      coherentWithinDeclaredMetadataScope: observationCoherence.declared ? observationCoherence.coherent && observationCoherence.issues.length === 0 : null,
      gitObservationPolicyDeclared: gitObservationPolicy.declared,
      gitOptionalWritesAndHooksDisabled: gitObservationPolicy.declared ? gitObservationPolicy.issues.length === 0 : null,
      configuredExternalFilterSideEffectsExcluded: gitObservationPolicy.policy ? gitObservationPolicy.policy.repositoryFiltersGloballyDisabled : null,
      fileContentStabilityProven: false,
      futureTimestampsCountedAsActivity: false,
      ownershipAssigned: false,
      stableWorkspaceClaimed: false,
      canonChanged: false
    }
  };
}

function fileIdentity(file) {
  return file.sha256 || [file.modifiedAt || '', file.sizeBytes].join(':');
}

function comparisonIssue(before, after) {
  if (before.root !== after.root) return 'ROOT_CHANGED';
  if ((before.git.branch || null) !== (after.git.branch || null)) return 'BRANCH_CHANGED';
  if (scanScopeSummary(before).digest !== scanScopeSummary(after).digest) return 'SCAN_SCOPE_CHANGED';
  if (scanScopeSummary(before).boundaryDigest !== scanScopeSummary(after).boundaryDigest) return 'SCAN_BOUNDARY_CHANGED';
  if (gitObservationPolicySummary(before).digest !== gitObservationPolicySummary(after).digest) return 'GIT_OBSERVATION_POLICY_CHANGED';
  return null;
}

function gitStatusMap(snapshot) {
  const rows = normalizeGitStatus(snapshot.git.status).filter(function (row) { return row.valid; });
  const map = new Map();
  rows.forEach(function (row) { map.set(row.path, row); });
  return map;
}

function compareGitStatus(beforeSnapshot, afterSnapshot) {
  const before = gitStatusMap(beforeSnapshot);
  const after = gitStatusMap(afterSnapshot);
  const changes = [];
  after.forEach(function (row, path) {
    const previous = before.get(path);
    if (!previous) changes.push({ path, kind: 'GIT_STATUS_ENTERED', sharedSeam: row.sharedSeam, before: null, after: row.xy });
    else if (previous.xy !== row.xy || previous.fromPath !== row.fromPath) changes.push({ path, kind: 'GIT_STATUS_CHANGED', sharedSeam: row.sharedSeam || previous.sharedSeam, before: previous.xy, after: row.xy });
  });
  before.forEach(function (row, path) {
    if (!after.has(path)) changes.push({ path, kind: 'GIT_STATUS_LEFT', sharedSeam: row.sharedSeam, before: row.xy, after: null });
  });
  return changes.sort(function (a, b) { return a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind); });
}

function compareSnapshots(beforeSnapshot, afterSnapshot, options) {
  validateSnapshot(beforeSnapshot);
  validateSnapshot(afterSnapshot);
  const before = analyzeSnapshot(beforeSnapshot, options);
  const after = analyzeSnapshot(afterSnapshot, options);
  const beforeObservedMs = timestamp(beforeSnapshot.generatedAt);
  const afterObservedMs = timestamp(afterSnapshot.generatedAt);
  const futureToleranceMs = Math.max(0, finiteNumber(options && options.futureToleranceMs, DEFAULT_FUTURE_TOLERANCE_MS));
  const limit = sampleLimit(options);
  assert(afterObservedMs >= beforeObservedMs, 'after snapshot must not predate before snapshot');

  const issue = comparisonIssue(beforeSnapshot, afterSnapshot);
  const beforeFiles = new Map(normalizeFiles(beforeSnapshot).map(function (file) { return [file.path, file]; }));
  const afterFiles = new Map(normalizeFiles(afterSnapshot).map(function (file) { return [file.path, file]; }));
  const changed = [];
  const gitStatusChanges = compareGitStatus(beforeSnapshot, afterSnapshot);

  afterFiles.forEach(function (file, path) {
    const previous = beforeFiles.get(path);
    const modifiedMs = timestamp(file.modifiedAt);
    if (modifiedMs === null || modifiedMs > afterObservedMs + futureToleranceMs) return;
    if (!previous) {
      changed.push({ path, kind: 'ENTERED_OBSERVATION', sharedSeam: file.sharedSeam, before: null, after: fileIdentity(file) });
    } else if (fileIdentity(previous) !== fileIdentity(file)) {
      changed.push({ path, kind: 'CONTENT_OR_METADATA_CHANGED', sharedSeam: file.sharedSeam || previous.sharedSeam, before: fileIdentity(previous), after: fileIdentity(file) });
    }
  });

  const afterWindow = windows(afterSnapshot);
  beforeFiles.forEach(function (file, path) {
    if (afterFiles.has(path)) return;
    const modifiedMs = timestamp(file.modifiedAt);
    if (modifiedMs !== null && modifiedMs >= afterObservedMs - afterWindow.recentMs && modifiedMs <= afterObservedMs + futureToleranceMs) {
      changed.push({ path, kind: 'LEFT_OBSERVATION_BEFORE_WINDOW_EXPIRY', sharedSeam: file.sharedSeam, before: fileIdentity(file), after: null });
    }
  });

  changed.sort(function (a, b) { return a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind); });
  const incomplete = beforeSnapshot.truncated === true || afterSnapshot.truncated === true;
  const scanErrors = before.counts.scanErrors > 0 || after.counts.scanErrors > 0;
  const scanIntegrity = before.scanIntegrity.issues.length > 0 || after.scanIntegrity.issues.length > 0;
  const observationIncoherent = (before.observationCoherence.declared && (!before.observationCoherence.coherent || before.observationCoherence.issues.length > 0)) || (after.observationCoherence.declared && (!after.observationCoherence.coherent || after.observationCoherence.issues.length > 0));
  const gitPolicyUnsafe = before.gitObservationPolicy.issues.length > 0 || after.gitObservationPolicy.issues.length > 0;
  const gitIncomplete = beforeSnapshot.git.complete === false || afterSnapshot.git.complete === false;
  const invalid = before.counts.invalidTimestampFiles > 0 || after.counts.invalidTimestampFiles > 0;
  const invalidGitStatus = before.gitStatus.counts.invalid > 0 || after.gitStatus.counts.invalid > 0;
  const fileContentNotRead = (before.scanScope.policy && before.scanScope.policy.fileContentRead === false) || (after.scanScope.policy && after.scanScope.policy.fileContentRead === false);
  const gitFilterSideEffectsNotExcluded = (before.gitObservationPolicy.policy && before.gitObservationPolicy.policy.repositoryFiltersGloballyDisabled === false) || (after.gitObservationPolicy.policy && after.gitObservationPolicy.policy.repositoryFiltersGloballyDisabled === false);
  let verdict = 'STABLE_WITHIN_SNAPSHOT_SCOPE';
  if (issue || incomplete || scanErrors || scanIntegrity || observationIncoherent || gitPolicyUnsafe || gitIncomplete || invalid || invalidGitStatus) verdict = 'UNKNOWN';
  else if (changed.length || gitStatusChanges.length) verdict = 'MOVING_WORKSPACE';

  const changedSharedSeams = changed.concat(gitStatusChanges).filter(function (item) { return item.sharedSeam; });
  const changedSample = boundedRows(changed, limit, function (row) { return [row.path, row.kind, row.sharedSeam, row.before, row.after]; });
  const gitSample = boundedRows(gitStatusChanges, limit, function (row) { return [row.path, row.kind, row.sharedSeam, row.before, row.after]; });
  const seamSample = boundedRows(changedSharedSeams, limit, function (row) { return [row.path, row.kind, row.before, row.after]; });
  const comparisonDigest = sha256({
    before: before.sourceObservationDigest,
    after: after.sourceObservationDigest,
    verdict,
    qualifications: [issue, incomplete, scanErrors, scanIntegrity, observationIncoherent, gitPolicyUnsafe, gitIncomplete, invalid, invalidGitStatus, fileContentNotRead, gitFilterSideEffectsNotExcluded],
    changedPaths: changedSample.evidence.sha256,
    gitStatusChanges: gitSample.evidence.sha256,
    changedSharedSeams: seamSample.evidence.sha256
  });

  return {
    schema: COMPARISON_SCHEMA,
    root: afterSnapshot.root,
    branch: afterSnapshot.git.branch || null,
    beforeObservedAt: beforeSnapshot.generatedAt,
    afterObservedAt: afterSnapshot.generatedAt,
    comparisonDigest,
    verdict,
    changedPaths: changedSample.rows,
    gitStatusChanges: gitSample.rows,
    changedSharedSeams: seamSample.rows,
    changeEvidence: {
      limit,
      changedPaths: changedSample.evidence,
      gitStatusChanges: gitSample.evidence,
      changedSharedSeams: seamSample.evidence
    },
    qualifications: [
      issue,
      incomplete ? 'SCAN_TRUNCATED' : null,
      scanErrors ? 'SCAN_ERRORS_PRESENT' : null,
      scanIntegrity ? 'SCAN_EVIDENCE_INCONSISTENT' : null,
      observationIncoherent ? 'OBSERVATION_INTERNALLY_MOVING_OR_INCOHERENT' : null,
      gitPolicyUnsafe ? 'GIT_OBSERVATION_POLICY_UNSAFE_OR_INCOMPLETE' : null,
      gitIncomplete ? 'GIT_STATUS_INCOMPLETE' : null,
      invalid ? 'INVALID_TIMESTAMP_PRESENT' : null,
      invalidGitStatus ? 'INVALID_GIT_STATUS_PRESENT' : null,
      before.counts.futureDatedFiles || after.counts.futureDatedFiles ? 'FUTURE_DATED_FILES_EXCLUDED' : null,
      fileContentNotRead ? 'FILE_CONTENT_STABILITY_NOT_PROVEN' : null,
      gitFilterSideEffectsNotExcluded ? 'CONFIGURED_GIT_FILTER_SIDE_EFFECTS_NOT_EXCLUDED' : null,
      'STABILITY_IS_LIMITED_TO_DECLARED_FILE_METADATA_SCOPE_OBSERVED_FILES_AND_WINDOWS'
    ].filter(Boolean),
    analyses: { before, after },
    truth: {
      readOnlyAnalysis: true,
      arraysAreBoundedSamples: true,
      fullEvidenceReconstructibleFromOutput: false,
      ownershipAssigned: false,
      deletionProven: false,
      metadataStabilityProvenWithinDeclaredScope: verdict === 'STABLE_WITHIN_SNAPSHOT_SCOPE',
      fileContentStabilityProven: false,
      configuredGitFilterSideEffectsExcluded: !gitFilterSideEffectsNotExcluded,
      stableClaimScope: verdict === 'STABLE_WITHIN_SNAPSHOT_SCOPE' ? 'declared-file-metadata-scope-observed-files-and-windows' : null,
      canonChanged: false
    }
  };
}

module.exports = {
  SNAPSHOT_SCHEMA,
  ANALYSIS_SCHEMA,
  COMPARISON_SCHEMA,
  DEFAULT_FUTURE_TOLERANCE_MS,
  DEFAULT_SAMPLE_LIMIT,
  MAX_SAMPLE_LIMIT,
  WORKSHOP_EXACT_SHARED_SEAMS,
  SHARED_SEAM_NAMES,
  SHARED_SEAM_WORDS,
  validateSnapshot,
  sha256,
  isSharedSeam,
  parseGitStatusLine,
  analyzeGitStatus,
  normalizedScanScope,
  scanScopeSummary,
  scanIntegrityIssues,
  observationCoherenceSummary,
  gitObservationPolicySummary,
  analyzeSnapshot,
  compareSnapshots
};
