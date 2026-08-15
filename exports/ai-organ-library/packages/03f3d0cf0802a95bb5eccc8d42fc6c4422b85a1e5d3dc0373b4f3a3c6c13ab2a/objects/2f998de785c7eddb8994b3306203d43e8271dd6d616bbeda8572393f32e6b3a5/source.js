'use strict';

const fs = require('fs');
const path = require('path');
const Cell = require('../kernel/workspace-timestamp-provenance-cell');

const ORGAN_ID = 'axm.mirror.workspace-timestamp-provenance-organ/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'workspace-timestamp-provenance-runs');
const DEFAULT_EXCLUDED_DIRECTORY_NAMES = Object.freeze(['.git', 'node_modules', '.venv', 'venv', '__pycache__']);
const DEFAULT_EXCLUDED_RELATIVE_PREFIXES = Object.freeze(['logs', 'state', 'runtime/python']);

function rootDirectory(value) {
  const absolute = path.resolve(value);
  const stat = fs.lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('workspace root must be a real directory');
  return absolute;
}

function label(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(value)) throw new Error('workspace label must use 1-80 safe characters');
  return value;
}

function relativePath(root, absolute) {
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) throw new Error('observed file escaped the workspace root');
  return relative;
}

function scanWorkspace(workspaceRoot, options = {}) {
  const maxFiles = Number.isSafeInteger(options.maxFiles) ? options.maxFiles : 250000;
  const maxDepth = Number.isSafeInteger(options.maxDepth) ? options.maxDepth : 64;
  if (maxFiles < 1 || maxDepth < 1) throw new Error('scan bounds must be positive integers');
  const excludedNames = new Set((options.excludedDirectoryNames || DEFAULT_EXCLUDED_DIRECTORY_NAMES).map(name => String(name).toLowerCase()));
  const excludedPrefixes = (options.excludedRelativePrefixes || DEFAULT_EXCLUDED_RELATIVE_PREFIXES)
    .map(value => String(value).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').toLowerCase())
    .filter(Boolean);
  const records = [];
  const skippedSymlinks = [];
  const excludedDirectories = [];
  const pending = [{ absolute: workspaceRoot, depth: 0 }];
  while (pending.length) {
    const current = pending.pop();
    if (current.depth > maxDepth) throw new Error(`workspace scan exceeded maximum depth ${maxDepth}`);
    const entries = fs.readdirSync(current.absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      const absolute = path.join(current.absolute, entry.name);
      const relative = relativePath(workspaceRoot, absolute);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        skippedSymlinks.push(relative);
        continue;
      }
      if (stat.isDirectory()) {
        const lowerRelative = relative.toLowerCase();
        const excluded = excludedNames.has(entry.name.toLowerCase()) || excludedPrefixes.some(prefix => lowerRelative === prefix || lowerRelative.startsWith(`${prefix}/`));
        if (excluded) excludedDirectories.push(relative);
        else pending.push({ absolute, depth: current.depth + 1 });
        continue;
      }
      if (!stat.isFile()) continue;
      records.push({
        path: relative,
        bytes: stat.size,
        lastWriteMs: Math.trunc(stat.mtimeMs),
        creationMs: Number.isFinite(stat.birthtimeMs) && stat.birthtimeMs > 0 ? Math.trunc(stat.birthtimeMs) : null
      });
      if (records.length > maxFiles) throw new Error(`workspace scan exceeded maximum file count ${maxFiles}`);
    }
  }
  return {
    records: records.sort((a, b) => a.path.localeCompare(b.path)),
    skippedSymlinks: skippedSymlinks.sort((a, b) => a.localeCompare(b)),
    excludedDirectories: excludedDirectories.sort((a, b) => a.localeCompare(b))
  };
}

function observe(options = {}) {
  const workspaceRoot = rootDirectory(options.workspaceRoot);
  const workspaceLabel = label(options.workspaceLabel || path.basename(workspaceRoot));
  const observedAtMs = Number.isSafeInteger(options.observedAtMs) ? options.observedAtMs : Date.now();
  const recentWindowMs = Number.isSafeInteger(options.recentWindowMs) ? options.recentWindowMs : 15 * 60 * 1000;
  const futureToleranceMs = Number.isSafeInteger(options.futureToleranceMs) ? options.futureToleranceMs : 5 * 60 * 1000;
  const maximumFiles = Number.isSafeInteger(options.maxFiles) ? options.maxFiles : 250000;
  const maximumDepth = Number.isSafeInteger(options.maxDepth) ? options.maxDepth : 64;
  const excludedDirectoryNames = options.excludedDirectoryNames || DEFAULT_EXCLUDED_DIRECTORY_NAMES;
  const excludedRelativePrefixes = options.excludedRelativePrefixes || DEFAULT_EXCLUDED_RELATIVE_PREFIXES;
  const first = scanWorkspace(workspaceRoot, options);
  const second = scanWorkspace(workspaceRoot, options);
  const observation = Cell.buildObservation({
    workspaceLabel,
    observedAtMs,
    recentWindowMs,
    futureToleranceMs,
    maximumFiles,
    maximumDepth,
    excludedDirectoryNames,
    excludedRelativePrefixes,
    firstRecords: first.records,
    secondRecords: second.records,
    firstSkippedSymlinks: first.skippedSymlinks,
    secondSkippedSymlinks: second.skippedSymlinks,
    firstExcludedDirectories: first.excludedDirectories,
    secondExcludedDirectories: second.excludedDirectories
  });
  Cell.verifyObservation(observation);
  return observation;
}

function assessmentBody(observation) {
  return {
    schema: 'axm.mirror.workspace-timestamp-provenance-assessment/v1',
    organ: { id: ORGAN_ID, learnedWeights: false },
    source: {
      observationSchema: observation.schema,
      observationDigest: Cell.sha256(observation)
    },
    state: observation.state,
    observation,
    summary: {
      filesObserved: observation.snapshot.files,
      eligibleRecentFiles: observation.classification.eligibleRecentFiles,
      futureTimestampFiles: observation.classification.futureTimestampFiles,
      futureTimestampFilesExcludedFromActivity: observation.classification.futureTimestampFiles,
      futureMtimeWithNonFutureCreationTime: observation.classification.futureMtimeWithNonFutureCreationTime,
      timestampsRepaired: 0,
      workspaceWrites: 0,
      permissionsGranted: 0,
      trainingAdmissions: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    boundary: observation.boundary,
    authority: { privateAssessmentWrite: true, ...Cell.ZERO_AUTHORITY }
  };
}

function persistAssessment(assessment, stateDir = DEFAULT_STATE_DIR) {
  const digest = Cell.sha256(assessment);
  const assessmentId = `workspace-timestamp-provenance-${digest.slice(0, 24)}`;
  const complete = { assessmentDigest: digest, assessmentId, ...assessment };
  const runDir = path.join(path.resolve(stateDir), assessmentId);
  const file = path.join(runDir, 'assessment.json');
  const bytes = `${JSON.stringify(complete, null, 2)}\n`;
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== bytes) throw new Error('existing timestamp provenance assessment does not match its content address');
    return { assessment: complete, reused: true, runDir };
  }
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(file, bytes, { flag: 'wx' });
  return { assessment: complete, reused: false, runDir };
}

function run(options = {}) {
  const observation = observe(options);
  return persistAssessment(assessmentBody(observation), options.stateDir || DEFAULT_STATE_DIR);
}

module.exports = { ORGAN_ID, ROOT, DEFAULT_STATE_DIR, DEFAULT_EXCLUDED_DIRECTORY_NAMES, DEFAULT_EXCLUDED_RELATIVE_PREFIXES, rootDirectory, scanWorkspace, observe, assessmentBody, persistAssessment, run };
