'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const KeySafeJson = require('./key-safe-json-transport-cell');

const CELL_ID = 'axm.mirror.foundation-public-source-inventory-cell/v1';
const INVENTORY_SCHEMA = 'axm.mirror.foundation-public-source-inventory/v1';
const MAX_FILES = 1024;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_DEPTH = 16;
const SOURCE_EXTENSIONS = Object.freeze(['.cjs', '.css', '.html', '.js', '.json', '.mjs']);
const REQUIRED_ANCHORS = Object.freeze([
  'package.json',
  'roots/AXM_ROOTS_v1.json',
  'runtime/server.js',
  'training/TRAINING_POLICY.json'
]);
const DISCOVERY_ROOTS = Object.freeze([
  Object.freeze({ path: 'roots', required: true }),
  Object.freeze({ path: 'kernel', required: true }),
  Object.freeze({ path: 'learning', required: false }),
  Object.freeze({ path: 'organs', required: true }),
  Object.freeze({ path: 'runtime', required: true }),
  Object.freeze({ path: 'contracts', required: true }),
  Object.freeze({ path: 'capabilities', required: false }),
  Object.freeze({ path: 'config', required: false }),
  Object.freeze({ path: 'adapters', required: false }),
  Object.freeze({ path: 'modules', required: false }),
  Object.freeze({ path: 'training', required: true }),
  Object.freeze({ path: 'scripts', required: false }),
  Object.freeze({ path: 'tests', required: false }),
  Object.freeze({ path: 'skills', required: false })
]);
const EXCLUDED_SEGMENTS = Object.freeze([
  '.git', '.cache', 'node_modules', 'state', 'logs', 'datasets', 'candidates',
  'checkpoints', 'packets', 'promotion_packets', 'rollback', 'lineage'
]);
const EXCLUDED_PAIRS = Object.freeze(['memory/private', 'storage/runtime']);

function stable(value) { return KeySafeJson.stable(value); }
function digest(value) { return KeySafeJson.digest(value); }
function byteDigest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function same(left, right) { return KeySafeJson.same(left, right); }
function posix(value) { return value.split(path.sep).join('/'); }
function boundedChild(root, relative) {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, relative);
  const relation = path.relative(absoluteRoot, absolute);
  if (!relation || relation.startsWith('..') || path.isAbsolute(relation)) throw new Error(`foundation source path escapes or aliases root: ${relative}`);
  return absolute;
}
function boundedLimit(value, maximum, field) {
  if (value === undefined) return maximum;
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error(`${field} may only lower the hard limit`);
  return value;
}
function excluded(relative) {
  const lower = posix(relative).toLowerCase();
  const segments = lower.split('/');
  if (segments.some(segment => EXCLUDED_SEGMENTS.includes(segment))) return true;
  return EXCLUDED_PAIRS.some(pair => lower === pair || lower.includes(`/${pair}/`) || lower.endsWith(`/${pair}`));
}
function hidden(name) { return name.startsWith('.'); }
function sensitive(relative) {
  const lower = posix(relative).toLowerCase();
  return lower.endsWith('.local.json') || /\.(token|key|secret)$/.test(lower);
}
function includedExtension(relative) { return SOURCE_EXTENSIONS.includes(path.extname(relative).toLowerCase()); }
function fileSeal(absolute, relative, limits) {
  const before = fs.lstatSync(absolute);
  if (!before.isFile() || before.isSymbolicLink()) throw new Error(`foundation public source is not a real file: ${relative}`);
  if (before.size > limits.maxFileBytes) throw new Error(`foundation public source exceeds file limit: ${relative}`);
  const bytes = fs.readFileSync(absolute);
  const after = fs.lstatSync(absolute);
  if (!after.isFile() || after.isSymbolicLink() || before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes.length !== after.size) throw new Error(`foundation public source changed during inventory: ${relative}`);
  return { path: posix(relative), bytes: bytes.length, sha256: byteDigest(bytes) };
}

function collect(root, options = {}) {
  const absoluteRoot = path.resolve(root);
  const rootStat = fs.lstatSync(absoluteRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('foundation public source root must be a real directory');
  const limits = {
    maxFiles: boundedLimit(options.maxFiles, MAX_FILES, 'maxFiles'),
    maxFileBytes: boundedLimit(options.maxFileBytes, MAX_FILE_BYTES, 'maxFileBytes'),
    maxTotalBytes: boundedLimit(options.maxTotalBytes, MAX_TOTAL_BYTES, 'maxTotalBytes'),
    maxDepth: boundedLimit(options.maxDepth, MAX_DEPTH, 'maxDepth')
  };
  const byPath = new Map();
  const caseFolded = new Map();
  let totalBytes = 0;
  let excludedDirectories = 0;
  let excludedExtensions = 0;
  let excludedHiddenEntries = 0;

  function addFile(relative) {
    const normalized = posix(relative);
    if (sensitive(normalized)) throw new Error(`secret-class or local configuration found inside public source scope: ${normalized}`);
    if (!includedExtension(normalized)) {
      excludedExtensions += 1;
      return;
    }
    const folded = normalized.toLowerCase();
    if (caseFolded.has(folded) && caseFolded.get(folded) !== normalized) throw new Error(`case-ambiguous foundation source paths: ${caseFolded.get(folded)} and ${normalized}`);
    caseFolded.set(folded, normalized);
    if (byPath.has(normalized)) return;
    const seal = fileSeal(boundedChild(absoluteRoot, normalized), normalized, limits);
    totalBytes += seal.bytes;
    if (totalBytes > limits.maxTotalBytes) throw new Error('foundation public source inventory exceeds total byte limit');
    byPath.set(normalized, seal);
    if (byPath.size > limits.maxFiles) throw new Error('foundation public source inventory exceeds file-count limit');
  }

  function walk(relativeRoot, depth) {
    if (depth > limits.maxDepth) throw new Error(`foundation public source inventory exceeds depth limit: ${posix(relativeRoot)}`);
    const absolute = boundedChild(absoluteRoot, relativeRoot);
    const stat = fs.lstatSync(absolute);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`foundation public source discovery root is not a real directory: ${posix(relativeRoot)}`);
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = path.join(relativeRoot, entry.name);
      if (hidden(entry.name)) {
        if (entry.name !== '.gitkeep') throw new Error(`hidden entry found inside public source scope: ${posix(relative)}`);
        excludedHiddenEntries += 1;
        continue;
      }
      if (excluded(relative)) {
        excludedDirectories += 1;
        continue;
      }
      const child = boundedChild(absoluteRoot, relative);
      const childStat = fs.lstatSync(child);
      if (childStat.isSymbolicLink()) throw new Error(`symbolic link found inside public source scope: ${posix(relative)}`);
      if (childStat.isDirectory()) walk(relative, depth + 1);
      else if (childStat.isFile()) addFile(relative);
      else throw new Error(`non-file entry found inside public source scope: ${posix(relative)}`);
    }
  }

  for (const anchor of REQUIRED_ANCHORS) addFile(anchor);
  const rootsObserved = [];
  const optionalRootsAbsent = [];
  for (const rule of DISCOVERY_ROOTS) {
    const absolute = boundedChild(absoluteRoot, rule.path);
    if (!fs.existsSync(absolute)) {
      if (rule.required) throw new Error(`required foundation public source root absent: ${rule.path}`);
      optionalRootsAbsent.push(rule.path);
      continue;
    }
    rootsObserved.push(rule.path);
    walk(rule.path, 0);
  }
  const files = Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
  const inventory = {
    schema: INVENTORY_SCHEMA,
    digest: null,
    cell: { id: CELL_ID, learnedWeights: false, discoveryAuthority: false, executionAuthority: false },
    identity: 'axm.machine.mirror/seed-0',
    rules: {
      discoveryRoots: DISCOVERY_ROOTS.map(rule => ({ path: rule.path, required: rule.required })),
      requiredAnchors: REQUIRED_ANCHORS.slice(),
      sourceExtensions: SOURCE_EXTENSIONS.slice(),
      excludedSegments: EXCLUDED_SEGMENTS.slice(),
      excludedPairs: EXCLUDED_PAIRS.slice(),
      limits
    },
    files,
    summary: {
      files: files.length,
      totalBytes,
      rootsObserved: rootsObserved.sort(),
      optionalRootsAbsent: optionalRootsAbsent.sort(),
      excludedDirectories,
      excludedExtensions,
      excludedHiddenEntries
    },
    authority: {
      sourceExecution: false,
      capabilityClaim: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This bounded inventory observes hashes and byte counts for public Mirror source. Discovery is not trust, capability, correctness, permission, evidence admission, execution, training, promotion, canon, or action authority. Private state, datasets, candidates, checkpoints, runtime storage, logs, packets, rollback, lineage, secrets, keys, tokens, and local configuration are outside its source scope.'
  };
  inventory.digest = digest(Object.assign({}, inventory, { digest: null }));
  return stable(inventory);
}

function verify(inventory, root, options = {}) {
  if (!inventory || inventory.schema !== INVENTORY_SCHEMA || inventory.digest !== digest(Object.assign({}, inventory, { digest: null }))) throw new Error('foundation public source inventory digest changed');
  if (Object.values(inventory.authority || {}).some(Boolean) || inventory.cell.discoveryAuthority !== false || inventory.cell.executionAuthority !== false) throw new Error('foundation public source inventory authority changed');
  if (!same(collect(root, options), inventory)) throw new Error('foundation public source inventory content changed');
  return true;
}

module.exports = {
  CELL_ID,
  INVENTORY_SCHEMA,
  MAX_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  MAX_DEPTH,
  SOURCE_EXTENSIONS,
  REQUIRED_ANCHORS,
  DISCOVERY_ROOTS,
  EXCLUDED_SEGMENTS,
  EXCLUDED_PAIRS,
  stable,
  digest,
  collect,
  verify
};
