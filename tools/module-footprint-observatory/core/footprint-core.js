'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FOOTPRINT_SCHEMA = 'axm.module-footprint-map/v1';
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
const EXCLUDED_DIRECTORIES = new Set([
  '.cache',
  '.git',
  'backups',
  'coverage',
  'exports',
  'local-data',
  'logs',
  'node_modules',
  'state'
]);

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

function posixRelative(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

function extensionOf(file) {
  const extension = path.extname(file).toLowerCase();
  return extension || '<none>';
}

function readManifest(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('manifest is not a regular non-symlink file');
  }
  const bytes = fs.readFileSync(file);
  return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
}

function walkModule(workshopRoot, moduleRoot) {
  const files = [];
  const skippedSymlinks = [];
  const excludedDirectories = [];
  const readIssues = [];
  const stack = [moduleRoot];

  while (stack.length) {
    const directory = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => right.name.localeCompare(left.name));
    } catch (error) {
      readIssues.push({
        path: posixRelative(workshopRoot, directory),
        code: 'DIRECTORY_READ_FAILED',
        message: String(error && error.message || error).slice(0, 240)
      });
      continue;
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = posixRelative(workshopRoot, absolute);
      if (entry.isSymbolicLink()) {
        skippedSymlinks.push(relative);
        continue;
      }
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name)) excludedDirectories.push(relative);
        else stack.push(absolute);
        continue;
      }
      if (!entry.isFile()) {
        readIssues.push({ path: relative, code: 'NON_REGULAR_ENTRY_SKIPPED', message: 'entry is not a regular file' });
        continue;
      }
      try {
        const stat = fs.lstatSync(absolute);
        files.push({ path: relative, bytes: stat.size, extension: extensionOf(entry.name) });
      } catch (error) {
        readIssues.push({
          path: relative,
          code: 'FILE_STAT_FAILED',
          message: String(error && error.message || error).slice(0, 240)
        });
      }
    }
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  skippedSymlinks.sort();
  excludedDirectories.sort();
  readIssues.sort((left, right) => left.path.localeCompare(right.path));
  return { files, skippedSymlinks, excludedDirectories, readIssues };
}

function scanWorkshop(rootInput, options = {}) {
  const root = path.resolve(rootInput || process.cwd());
  const toolsRoot = path.join(root, 'tools');
  const toolsStat = fs.lstatSync(toolsRoot);
  if (!toolsStat.isDirectory() || toolsStat.isSymbolicLink()) {
    throw new Error('tools root must be a regular non-symlink directory');
  }

  const modules = [];
  const topLevelSymlinks = [];
  const entries = fs.readdirSync(toolsRoot, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (entry.name.startsWith('_')) continue;
    if (entry.isSymbolicLink()) {
      topLevelSymlinks.push('tools/' + entry.name);
      continue;
    }
    if (!entry.isDirectory()) continue;
    const moduleRoot = path.join(toolsRoot, entry.name);
    const manifestPath = path.join(moduleRoot, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;

    let manifest;
    let manifestIssue = null;
    try {
      manifest = readManifest(manifestPath);
    } catch (error) {
      manifest = {};
      manifestIssue = String(error && error.message || error).slice(0, 240);
    }
    const walked = walkModule(root, moduleRoot);
    const extensionMap = new Map();
    for (const file of walked.files) {
      if (!extensionMap.has(file.extension)) extensionMap.set(file.extension, { extension: file.extension, files: 0, bytes: 0 });
      const group = extensionMap.get(file.extension);
      group.files += 1;
      group.bytes += file.bytes;
    }
    const extensions = Array.from(extensionMap.values())
      .sort((left, right) => right.bytes - left.bytes || left.extension.localeCompare(right.extension));
    const largestFile = walked.files.slice().sort((left, right) =>
      right.bytes - left.bytes || left.path.localeCompare(right.path)
    )[0] || null;
    modules.push({
      id: typeof manifest.id === 'string' && manifest.id.trim() ? manifest.id.trim() : entry.name,
      folder: entry.name,
      version: typeof manifest.version === 'string' ? manifest.version : 'UNKNOWN',
      status: typeof manifest.status === 'string' ? manifest.status : 'UNKNOWN',
      manifestState: manifestIssue ? 'INVALID' : 'PRESENT',
      manifestIssue,
      files: walked.files.length,
      bytes: walked.files.reduce((sum, file) => sum + file.bytes, 0),
      largestFile,
      extensions,
      excludedDirectories: walked.excludedDirectories,
      skippedSymlinks: walked.skippedSymlinks,
      readIssues: walked.readIssues,
      _fingerprintFiles: walked.files
    });
  }

  modules.sort((left, right) => left.id.localeCompare(right.id));
  const measuredAt = options.now || new Date().toISOString();
  const ttlMs = Number.isFinite(options.ttlMs) && options.ttlMs > 0
    ? Math.floor(options.ttlMs)
    : DEFAULT_TTL_MS;
  const fingerprintMaterial = {
    modules: modules.map(module => ({
      id: module.id,
      folder: module.folder,
      files: module._fingerprintFiles,
      excludedDirectories: module.excludedDirectories,
      skippedSymlinks: module.skippedSymlinks,
      readIssues: module.readIssues,
      manifestState: module.manifestState,
      manifestIssue: module.manifestIssue
    })),
    topLevelSymlinks
  };
  modules.forEach(module => delete module._fingerprintFiles);
  const allReadIssues = modules.flatMap(module => module.readIssues);
  const allSkippedSymlinks = topLevelSymlinks.concat(modules.flatMap(module => module.skippedSymlinks)).sort();
  const totalFiles = modules.reduce((sum, module) => sum + module.files, 0);
  const totalBytes = modules.reduce((sum, module) => sum + module.bytes, 0);

  return {
    schema: FOOTPRINT_SCHEMA,
    version: 'v0.1',
    measuredAt,
    freshnessTtlMs: ttlMs,
    source: {
      label: path.basename(root),
      footprintFingerprint: sha256(Buffer.from(stableJson(fingerprintMaterial))),
      excludedDirectoryNames: Array.from(EXCLUDED_DIRECTORIES).sort(),
      fileContentsHashed: false,
      symlinksFollowed: false
    },
    summary: {
      modules: modules.length,
      files: totalFiles,
      bytes: totalBytes,
      modulesWithSkippedSymlinks: modules.filter(module => module.skippedSymlinks.length).length,
      skippedSymlinks: allSkippedSymlinks.length,
      excludedDirectories: modules.reduce((sum, module) => sum + module.excludedDirectories.length, 0),
      invalidManifests: modules.filter(module => module.manifestState !== 'PRESENT').length,
      readIssues: allReadIssues.length
    },
    modules,
    skippedTopLevelSymlinks: topLevelSymlinks.sort(),
    scopeBoundary: 'Regular files below top-level tools/<module> roots are counted after named generated, dependency, cache, backup, log, local-data, export, coverage, and state directory exclusions. Symlinks are listed and never followed.',
    truth: {
      contentIdentityProven: false,
      duplicateContentInferred: false,
      qualityInferred: false,
      complexityInferred: false,
      performanceInferred: false,
      readinessInferred: false,
      sizeBudgetApplied: false,
      deletionRecommended: false,
      sourceMutationPerformed: false,
      packagingPerformed: false,
      installerStagingPerformed: false,
      installationPerformed: false,
      permissionChanged: false,
      promotionPerformed: false,
      canonChanged: false
    }
  };
}

function freshness(observation, options = {}) {
  const nowMs = Date.parse(options.now || new Date().toISOString());
  const observedMs = Date.parse(observation && observation.measuredAt);
  const ttlMs = Number(observation && observation.freshnessTtlMs);
  if (!Number.isFinite(nowMs) || !Number.isFinite(observedMs) || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    return { status: 'UNTIMED', ageMs: null, remainingMs: null };
  }
  const ageMs = Math.max(0, nowMs - observedMs);
  return {
    status: ageMs <= ttlMs ? 'LIVE' : 'STALE',
    ageMs,
    remainingMs: Math.max(0, ttlMs - ageMs)
  };
}

module.exports = {
  FOOTPRINT_SCHEMA,
  DEFAULT_TTL_MS,
  EXCLUDED_DIRECTORIES,
  extensionOf,
  walkModule,
  scanWorkshop,
  freshness
};
