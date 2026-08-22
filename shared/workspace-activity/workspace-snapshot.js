#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('./workspace-activity-core');

const DEFAULT_MAX_FILES = 200000;
const GIT_OBSERVATION_POLICY = Object.freeze({
  optionalLocksDisabled: true,
  fsMonitorDisabled: true,
  hooksPathDisabled: true,
  terminalPromptDisabled: true,
  repositoryFiltersGloballyDisabled: true
});

const DEFAULT_EXCLUDES = new Set([
  '.git', '.cache', '.next', '.pytest_cache', '__pycache__', 'build',
  'coverage', 'dist', 'exports', 'logs', 'node_modules', 'state', 'venv',
  '.venv'
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function integer(value, fallback, label) {
  const parsed = value == null ? fallback : Number(value);
  assert(Number.isInteger(parsed) && parsed > 0, label + ' must be a positive integer');
  return parsed;
}

function timeMs(value) {
  if (value == null) return Date.now();
  const parsed = typeof value === 'number' ? value : Date.parse(String(value));
  assert(Number.isFinite(parsed), 'now must be a timestamp');
  return parsed;
}

function normalizedExcludeNames(value) {
  return Array.from(new Set(Array.from(value || DEFAULT_EXCLUDES, function (item) {
    return String(item).trim().toLowerCase();
  }).filter(Boolean))).sort();
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function trimFinalNewline(value) {
  return String(value || '').replace(/(?:\r?\n)+$/, '');
}

function filterOverrideArgs(filterNames) {
  const output = [];
  (filterNames || []).forEach(function (name) {
    assert(/^[a-z0-9._-]+$/i.test(name), 'configured Git filter name cannot be safely overridden: ' + name);
    ['process', 'clean', 'smudge'].forEach(function (key) { output.push('-c', 'filter.' + name + '.' + key + '='); });
    output.push('-c', 'filter.' + name + '.required=false');
  });
  return output;
}

function gitInvocationArgs(root, args, filterNames) {
  return ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=']
    .concat(filterOverrideArgs(filterNames), ['-C', root], args);
}

function gitInvocationEnvironment() {
  return Object.assign({}, process.env, {
    GIT_OPTIONAL_LOCKS: '0',
    GIT_TERMINAL_PROMPT: '0',
    GIT_PAGER: 'cat'
  });
}

function git(root, args, encoding, filterNames) {
  const result = childProcess.spawnSync('git', gitInvocationArgs(root, args, filterNames), {
    encoding: encoding === undefined ? 'utf8' : encoding,
    env: gitInvocationEnvironment(),
    windowsHide: true,
    shell: false,
    timeout: 30000,
    maxBuffer: 64 * 1024 * 1024
  });
  return {
    ok: !result.error && result.status === 0,
    stdout: result.stdout || (encoding === null ? Buffer.alloc(0) : ''),
    stderr: String(result.stderr || result.error || ''),
    status: result.status
  };
}

function configuredGitFilters(root) {
  const result = git(root, ['config', '--name-only', '--get-regexp', '^filter\\..*\\.(clean|smudge|process|required)$'], 'utf8', []);
  if (!result.ok && result.status !== 1) return { ok: false, names: [], digest: null, error: trimFinalNewline(result.stderr) || 'Git filter discovery failed' };
  const names = Array.from(new Set(String(result.stdout || '').split(/\r?\n/).map(function (key) {
    const match = /^filter\.(.+)\.(?:clean|smudge|process|required)$/i.exec(key.trim());
    return match ? match[1].toLowerCase() : null;
  }).filter(Boolean))).sort();
  const unsafe = names.filter(function (name) { return !/^[a-z0-9._-]+$/i.test(name); });
  if (unsafe.length) return { ok: false, names, digest: Core.sha256(names), error: 'Configured Git filter name cannot be safely overridden: ' + unsafe.join(', ') };
  return { ok: true, names, digest: Core.sha256(names), error: null };
}

function encodeGitPath(value) {
  value = String(value || '').replace(/\\/g, '/');
  return /\s|"|\\| -> /.test(value) ? JSON.stringify(value) : value;
}

function parsePorcelainZ(buffer) {
  const text = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '');
  const tokens = text.split('\0');
  if (tokens[tokens.length - 1] === '') tokens.pop();
  const lines = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.length < 4 || token[2] !== ' ') {
      lines.push(token);
      continue;
    }
    const xy = token.slice(0, 2);
    const target = token.slice(3);
    if (xy.includes('R') || xy.includes('C')) {
      const source = tokens[index + 1];
      if (source == null) {
        lines.push(token);
      } else {
        lines.push(xy + ' ' + encodeGitPath(source) + ' -> ' + encodeGitPath(target));
        index += 1;
      }
    } else {
      lines.push(xy + ' ' + encodeGitPath(target));
    }
  }
  return lines;
}

function gitSnapshot(root) {
  const filters = configuredGitFilters(root);
  if (!filters.ok) return { available: false, root: null, branch: null, status: [], configuredFilterNames: filters.names, configuredFilterDigest: filters.digest, error: filters.error };
  const repo = git(root, ['rev-parse', '--show-toplevel'], 'utf8', filters.names);
  if (!repo.ok) return { available: false, root: null, branch: null, status: [], configuredFilterNames: filters.names, configuredFilterDigest: filters.digest, error: trimFinalNewline(repo.stderr) || null };
  const branch = git(root, ['branch', '--show-current'], 'utf8', filters.names);
  const status = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], null, filters.names);
  return {
    available: true,
    root: trimFinalNewline(repo.stdout),
    branch: branch.ok ? trimFinalNewline(branch.stdout) || null : null,
    status: status.ok ? parsePorcelainZ(status.stdout) : [],
    configuredFilterNames: filters.names,
    configuredFilterDigest: filters.digest,
    error: status.ok ? null : trimFinalNewline(status.stderr) || 'git status failed'
  };
}

function scanFiles(root, options) {
  const recent = [];
  const active = [];
  const errors = [];
  const excludes = new Set(normalizedExcludeNames(options.excludes));
  const excludedDirectories = [];
  const metadataHash = crypto.createHash('sha256');
  const metadataRows = [];
  const stack = [root];
  let scanned = 0;
  let truncated = false;
  const skippedSymlinks = [];

  while (stack.length && !truncated) {
    const current = stack.pop();
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }).sort(function (a, b) { return a.name.localeCompare(b.name); }); }
    catch (error) {
      errors.push({ path: path.relative(root, current).replace(/\\/g, '/') || '.', code: error.code || 'READ_FAILED' });
      continue;
    }
    const directories = [];
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        skippedSymlinks.push(path.relative(root, absolute).replace(/\\/g, '/'));
        continue;
      }
      if (entry.isDirectory()) {
        if (excludes.has(entry.name.toLowerCase())) excludedDirectories.push(path.relative(root, absolute).replace(/\\/g, '/'));
        else directories.push(absolute);
        continue;
      }
      if (!entry.isFile()) continue;
      if (scanned >= options.maxFiles) {
        truncated = true;
        break;
      }
      scanned += 1;
      const relative = path.relative(root, absolute).replace(/\\/g, '/');
      let stat;
      try { stat = fs.statSync(absolute); }
      catch (error) {
        errors.push({ path: relative, code: error.code || 'STAT_FAILED' });
        continue;
      }
      const metadataRow = [relative, stat.size, stat.mtimeMs, stat.mode];
      metadataRows.push(metadataRow);
      metadataHash.update(JSON.stringify(metadataRow) + '\n');
      if (stat.mtimeMs < options.recentCutoffMs) continue;
      const item = {
        path: relative,
        modifiedAt: iso(stat.mtimeMs),
        sizeBytes: stat.size,
        sharedSeam: Core.isSharedSeam(relative, false)
      };
      recent.push(item);
      if (stat.mtimeMs >= options.activeCutoffMs) active.push(item);
    }
    for (let index = directories.length - 1; index >= 0; index -= 1) stack.push(directories[index]);
  }

  const newestFirst = function (a, b) { return b.modifiedAt.localeCompare(a.modifiedAt) || a.path.localeCompare(b.path); };
  recent.sort(newestFirst);
  active.sort(newestFirst);
  errors.sort(function (a, b) { return a.path.localeCompare(b.path) || a.code.localeCompare(b.code); });
  excludedDirectories.sort();
  skippedSymlinks.sort();
  return { recent, active, scanned, truncated, errors, skippedSymlinks, excludedDirectories, metadataRows, metadataDigest: metadataHash.digest('hex') };
}

function boundedEvidence(rows, projection) {
  const normalized = rows.map(projection || function (row) { return row; });
  return {
    total: rows.length,
    returned: Math.min(rows.length, 20),
    truncated: rows.length > 20,
    sha256: Core.sha256(normalized),
    sample: rows.slice(0, 20)
  };
}

function scanPassDigest(scan) {
  return Core.sha256({
    filesScanned: scan.scanned,
    truncated: scan.truncated,
    metadataDigest: scan.metadataDigest,
    errors: scan.errors.map(function (item) { return [item.path, item.code]; }),
    excludedDirectories: scan.excludedDirectories,
    skippedSymlinks: scan.skippedSymlinks
  });
}

function gitStateDigest(state) {
  if (!state || !state.available || state.error) return null;
  return Core.sha256({
    root: String(state.root || '').replace(/\\/g, '/'),
    branch: state.branch || null,
    configuredFilterDigest: state.configuredFilterDigest || null,
    statusDigest: Core.analyzeGitStatus(state.status).statusDigest
  });
}

function compareMetadataRows(beforeRows, afterRows) {
  const before = new Map((beforeRows || []).map(function (row) { return [row[0], row.slice(1)]; }));
  const after = new Map((afterRows || []).map(function (row) { return [row[0], row.slice(1)]; }));
  const changes = [];
  after.forEach(function (identity, path) {
    const previous = before.get(path);
    if (!previous) changes.push({ path, kind: 'ENTERED_METADATA_PASS', before: null, after: identity });
    else if (JSON.stringify(previous) !== JSON.stringify(identity)) changes.push({ path, kind: 'METADATA_CHANGED_DURING_OBSERVATION', before: previous, after: identity });
  });
  before.forEach(function (identity, path) {
    if (!after.has(path)) changes.push({ path, kind: 'LEFT_METADATA_PASS', before: identity, after: null });
  });
  changes.sort(function (a, b) { return a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind); });
  return boundedEvidence(changes, function (item) { return [item.path, item.kind, item.before, item.after]; });
}

function compareObservationPasses(scanBefore, scanAfter, gitBefore, gitAfter) {
  const scanBeforeDigest = scanPassDigest(scanBefore);
  const scanAfterDigest = scanPassDigest(scanAfter);
  const scanComplete = !scanBefore.truncated && !scanAfter.truncated && scanBefore.errors.length === 0 && scanAfter.errors.length === 0;
  const gitBeforeDigest = gitStateDigest(gitBefore);
  const gitAfterDigest = gitStateDigest(gitAfter);
  let gitStatusStableAcrossObservation = false;
  if (!gitBefore.available && !gitAfter.available) gitStatusStableAcrossObservation = null;
  else if (gitBeforeDigest !== null && gitAfterDigest !== null) gitStatusStableAcrossObservation = gitBeforeDigest === gitAfterDigest;
  const scanStableAcrossObservation = scanComplete && scanBeforeDigest === scanAfterDigest;
  const metadataChangeEvidence = compareMetadataRows(scanBefore.metadataRows, scanAfter.metadataRows);
  return {
    scanBeforeDigest,
    scanAfterDigest,
    scanStableAcrossObservation,
    gitBeforeDigest,
    gitAfterDigest,
    gitStatusStableAcrossObservation,
    metadataChangeEvidence,
    coherentWithinDeclaredMetadataScope: scanStableAcrossObservation && gitStatusStableAcrossObservation !== false
  };
}

function buildSnapshot(root, options) {
  options = options || {};
  root = path.resolve(root || '.');
  const rootStat = fs.statSync(root);
  assert(rootStat.isDirectory(), 'workspace root must be a directory');
  const minutes = integer(options.minutes, 30, 'minutes');
  const activeMinutes = integer(options.activeMinutes, 5, 'activeMinutes');
  assert(activeMinutes <= minutes, 'activeMinutes must not exceed minutes');
  const maxFiles = integer(options.maxFiles, DEFAULT_MAX_FILES, 'maxFiles');
  const excludedDirectoryNames = normalizedExcludeNames(options.excludes);
  const fixedNow = options.now != null;
  const startedMs = fixedNow ? timeMs(options.now) : Date.now();
  const scanOptions = {
    recentCutoffMs: startedMs - minutes * 60000,
    activeCutoffMs: startedMs - activeMinutes * 60000,
    maxFiles,
    excludes: excludedDirectoryNames
  };
  const gitBefore = gitSnapshot(root);
  const scanBefore = scanFiles(root, scanOptions);
  const scanAfter = scanFiles(root, scanOptions);
  const gitAfter = gitSnapshot(root);
  const completedMs = fixedNow ? startedMs : Date.now();
  const coherence = compareObservationPasses(scanBefore, scanAfter, gitBefore, gitAfter);
  const scanErrors = scanBefore.errors.map(function (item) { return Object.assign({ pass: 'before' }, item); })
    .concat(scanAfter.errors.map(function (item) { return Object.assign({ pass: 'after' }, item); }));
  const truncated = scanBefore.truncated || scanAfter.truncated;
  const scanComplete = !truncated && scanErrors.length === 0;
  const recent = scanAfter.recent.filter(function (item) { return Date.parse(item.modifiedAt) >= completedMs - minutes * 60000; });
  const active = recent.filter(function (item) { return Date.parse(item.modifiedAt) >= completedMs - activeMinutes * 60000; });
  const activeSharedSeams = active.filter(function (item) { return item.sharedSeam; }).length;
  const gitComplete = gitBefore.available && !gitBefore.error && gitAfter.available && !gitAfter.error;
  const cautions = [
    active.length ? 'Files changed inside the active window; re-read shared seams before patching.' : null,
    activeSharedSeams ? 'An actively changing shared seam was detected.' : null,
    truncated ? 'At least one metadata pass reached its file limit; the snapshot is incomplete.' : null,
    scanErrors.length ? scanErrors.length + ' filesystem path-pass observation(s) could not be inspected.' : null,
    gitBefore.error || gitAfter.error ? 'Git status could not be read completely across the observation.' : null,
    !coherence.scanStableAcrossObservation ? 'Filesystem metadata changed or was incomplete across the two observation passes.' : null,
    coherence.gitStatusStableAcrossObservation === false ? 'Git status changed or was incomplete across the observation.' : null
  ].filter(Boolean);
  return {
    schema: Core.SNAPSHOT_SCHEMA,
    root,
    generatedAt: iso(completedMs),
    windowsMinutes: { recent: minutes, active: activeMinutes },
    observation: {
      startedAt: iso(startedMs),
      completedAt: iso(completedMs),
      durationMs: Math.max(0, completedMs - startedMs),
      metadataPasses: 2,
      scanBeforeDigest: coherence.scanBeforeDigest,
      scanAfterDigest: coherence.scanAfterDigest,
      scanStableAcrossObservation: coherence.scanStableAcrossObservation,
      gitBeforeDigest: coherence.gitBeforeDigest,
      gitAfterDigest: coherence.gitAfterDigest,
      gitStatusStableAcrossObservation: coherence.gitStatusStableAcrossObservation,
      metadataChangeEvidence: coherence.metadataChangeEvidence,
      coherentWithinDeclaredMetadataScope: coherence.coherentWithinDeclaredMetadataScope
    },
    scan: {
      complete: scanComplete,
      maxFiles,
      excludedDirectoryNames,
      symlinksFollowed: false,
      fileContentRead: false,
      metadataDigest: scanAfter.metadataDigest
    },
    git: {
      available: gitAfter.available,
      complete: gitComplete,
      root: gitAfter.root,
      branch: gitAfter.branch,
      status: gitAfter.status,
      statusBeforeDigest: coherence.gitBeforeDigest,
      statusAfterDigest: coherence.gitAfterDigest,
      stableAcrossObservation: coherence.gitStatusStableAcrossObservation,
      observationPolicy: Object.assign({}, GIT_OBSERVATION_POLICY, {
        configuredFilterCount: Array.isArray(gitAfter.configuredFilterNames) ? gitAfter.configuredFilterNames.length : 0,
        configuredFilterDigest: gitAfter.configuredFilterDigest || null
      })
    },
    counts: {
      filesScanned: scanAfter.scanned,
      filesScannedAcrossPasses: scanBefore.scanned + scanAfter.scanned,
      recentFiles: recent.length,
      activeFiles: active.length,
      activeSharedSeams,
      scanErrors: scanErrors.length,
      skippedSymlinks: scanAfter.skippedSymlinks.length,
      excludedDirectories: scanAfter.excludedDirectories.length
    },
    recentFiles: recent,
    activeFiles: active,
    scanErrorSample: scanErrors.slice(0, 20),
    scanErrorEvidence: boundedEvidence(scanErrors, function (item) { return [item.pass, item.path, item.code]; }),
    excludedDirectoryEvidence: boundedEvidence(scanAfter.excludedDirectories),
    skippedSymlinkEvidence: boundedEvidence(scanAfter.skippedSymlinks),
    cautions,
    truncated,
    truth: {
      readOnlyInspectionIntent: true,
      repositoryWritesRequested: false,
      readOnlySideEffectsFullyProven: false,
      symlinksFollowed: false,
      fileContentRead: false,
      scanCompleteWithinDeclaredScope: scanComplete,
      coherentWithinDeclaredMetadataScope: coherence.coherentWithinDeclaredMetadataScope,
      fileContentStabilityProven: false,
      gitOptionalWritesDisabled: true,
      gitHooksAndFsMonitorDisabled: true,
      configuredExternalFilterSideEffectsExcluded: true,
      ownershipAssigned: false,
      automaticAction: false,
      canonChanged: false
    }
  };
}

function parseArgs(argv) {
  const options = { root: '.', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--root') options.root = argv[++index];
    else if (arg === '--minutes') options.minutes = Number(argv[++index]);
    else if (arg === '--active-minutes') options.activeMinutes = Number(argv[++index]);
    else if (arg === '--max-files') options.maxFiles = Number(argv[++index]);
    else throw new Error('unknown argument: ' + arg);
  }
  return options;
}

function printText(snapshot) {
  process.stdout.write('Workspace: ' + snapshot.root + '\n');
  process.stdout.write('Git: ' + (snapshot.git.available ? (snapshot.git.branch || '(detached)') + '; ' + snapshot.git.status.length + ' changed path(s)' : 'not available') + '\n');
  process.stdout.write('Recent: ' + snapshot.counts.recentFiles + '; active: ' + snapshot.counts.activeFiles + '; active shared seams: ' + snapshot.counts.activeSharedSeams + '\n');
  snapshot.cautions.forEach(function (caution) { process.stdout.write('CAUTION: ' + caution + '\n'); });
}

function main(argv) {
  const args = parseArgs(argv);
  const snapshot = buildSnapshot(args.root, args);
  if (args.json) process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n');
  else printText(snapshot);
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(String(error && error.message || error) + '\n'); process.exitCode = 1; }
}

module.exports = { DEFAULT_MAX_FILES, DEFAULT_EXCLUDES, GIT_OBSERVATION_POLICY, normalizedExcludeNames, filterOverrideArgs, gitInvocationArgs, gitInvocationEnvironment, configuredGitFilters, encodeGitPath, parsePorcelainZ, gitSnapshot, scanFiles, scanPassDigest, gitStateDigest, compareMetadataRows, compareObservationPasses, buildSnapshot, parseArgs, main };
