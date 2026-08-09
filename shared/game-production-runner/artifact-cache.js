'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Codec = require('./canonical');
const Contracts = require('./contracts');

const ENTRY_SCHEMA = 'axm.production-artifact-cache-entry/v1';
const INVALIDATION_SCHEMA = 'axm.production-artifact-cache-invalidation/v1';
const KEY_SCHEMA = 'axm.production-artifact-cache-key/v1';
const POLICY = 'deterministic-v1';
const DIGEST = /^[a-f0-9]{64}$/;
const MAX_FACT_BYTES = 65536;

class CacheError extends Error {
  constructor(code) {
    super(code);
    this.name = 'CacheError';
    this.code = code;
  }
}

function fail(code) { throw new CacheError(code); }

function inside(root, candidate) {
  const base = path.resolve(root), target = path.resolve(candidate);
  return target === base || target.startsWith(base + path.sep);
}

function resolveExistingLinks(candidate) {
  let cursor = path.resolve(candidate);
  const tail = [];
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    tail.unshift(path.basename(cursor));
    cursor = parent;
  }
  const existing = fs.existsSync(cursor) ? fs.realpathSync.native(cursor) : cursor;
  return path.resolve(existing, ...tail);
}

function cacheRootState(cacheRoot, sourceRoot, jobRoot, create) {
  if (!path.isAbsolute(String(cacheRoot || ''))) fail('CACHE_ROOT_NOT_ABSOLUTE');
  const requested = path.resolve(cacheRoot), resolved = resolveExistingLinks(requested), parsed = path.parse(resolved);
  if (resolved === parsed.root) fail('CACHE_ROOT_IS_FILESYSTEM_ROOT');
  if (requested.toLowerCase() !== resolved.toLowerCase()) fail('CACHE_ROOT_TRAVERSES_LINK');
  if (sourceRoot) {
    const source = resolveExistingLinks(sourceRoot);
    if (inside(source, resolved) || inside(resolved, source)) fail('CACHE_ROOT_OVERLAPS_SOURCE');
  }
  if (jobRoot) {
    const jobs = resolveExistingLinks(jobRoot);
    if (inside(jobs, resolved) || inside(resolved, jobs)) fail('CACHE_ROOT_OVERLAPS_JOB_ROOT');
  }
  if (!fs.existsSync(resolved) && create) fs.mkdirSync(resolved, { recursive: true });
  const exists = fs.existsSync(resolved);
  if (exists) {
    const rootStat = fs.lstatSync(resolved);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('CACHE_ROOT_NOT_PLAIN_DIRECTORY');
    if (fs.realpathSync.native(resolved).toLowerCase() !== resolved.toLowerCase()) fail('CACHE_ROOT_BECAME_LINK');
  }
  const entriesRoot = path.join(resolved, 'entries');
  if (create && !fs.existsSync(entriesRoot)) fs.mkdirSync(entriesRoot, { recursive: false });
  const entriesExist = fs.existsSync(entriesRoot);
  if (entriesExist) {
    const entriesStat = fs.lstatSync(entriesRoot);
    if (!entriesStat.isDirectory() || entriesStat.isSymbolicLink() || fs.realpathSync.native(entriesRoot).toLowerCase() !== path.resolve(entriesRoot).toLowerCase()) fail('CACHE_ENTRIES_NOT_PLAIN_DIRECTORY');
  }
  return { root: resolved, exists, entriesRoot, entriesExist };
}

function assertCacheRoot(cacheRoot, sourceRoot, jobRoot) { return cacheRootState(cacheRoot, sourceRoot, jobRoot, true).root; }

function locate(options) {
  options = options || {};
  return Object.freeze(cacheRootState(options.cacheRoot, options.sourceRoot, options.jobRoot, false));
}

function refusePathLinks(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  let cursor = path.resolve(root);
  for (const part of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    let stat;
    try { stat = fs.lstatSync(cursor); }
    catch (error) {
      if (error && error.code === 'ENOENT') continue;
      throw error;
    }
    if (stat.isSymbolicLink()) fail('CACHE_PATH_TRAVERSES_LINK');
  }
}

function safeTarget(root, relative) {
  if (!Contracts.safeRelative(relative)) fail('CACHE_RELATIVE_PATH_INVALID');
  const target = path.resolve(root, String(relative).replace(/\//g, path.sep));
  if (!inside(root, target) || target === path.resolve(root)) fail('CACHE_PATH_ESCAPE');
  refusePathLinks(root, target);
  if (!inside(resolveExistingLinks(root), resolveExistingLinks(target))) fail('CACHE_LINK_ESCAPE');
  return target;
}

function normalizeInputs(inputs) {
  if (!Array.isArray(inputs)) fail('CACHE_INPUTS_INVALID');
  const normalized = inputs.map((item) => {
    if (!item || !Contracts.portableId(item.package_id) || !Contracts.safeRelative(item.path) || !DIGEST.test(String(item.digest || '')) || !Number.isInteger(item.bytes) || item.bytes < 0) fail('CACHE_INPUT_INVALID');
    return { package_id: item.package_id, path: item.path, digest: item.digest, bytes: item.bytes };
  }).sort((left, right) => (left.package_id + '\0' + left.path).localeCompare(right.package_id + '\0' + right.path));
  const keys = normalized.map((item) => item.package_id + '\0' + item.path);
  if (new Set(keys).size !== keys.length) fail('CACHE_INPUT_DUPLICATE');
  return normalized;
}

function bindingFor(pkg, inputs, seed) {
  if (!pkg || !Contracts.portableId(pkg.id) || !Contracts.exactVersion(pkg.version) || !DIGEST.test(String(pkg.digest || '')) || !Contracts.exactIdentity(pkg.executor) || !Contracts.exactIdentity(pkg.verifier)) fail('CACHE_PACKAGE_BINDING_INVALID');
  return {
    schema: KEY_SCHEMA,
    package_ref: { id: pkg.id, version: pkg.version, digest: pkg.digest },
    inputs: normalizeInputs(inputs),
    executor: Codec.clone(pkg.executor),
    verifier: Codec.clone(pkg.verifier),
    seed_digest: Codec.sha256(Buffer.from(String(seed), 'utf8'))
  };
}

function keyFor(pkg, inputs, seed) { return Codec.digest(bindingFor(pkg, inputs, seed)); }

function entryDirectory(root, key) {
  if (!DIGEST.test(String(key || ''))) fail('CACHE_KEY_INVALID');
  return safeTarget(root, 'entries/' + key.slice(0, 2) + '/' + key);
}

function factRecord(value) {
  const facts = Codec.clone(value || {});
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) fail('CACHE_FACTS_NOT_RECORD');
  if (Codec.bytes(facts).length > MAX_FACT_BYTES) fail('CACHE_FACTS_BUDGET_EXCEEDED');
  return facts;
}

function normalizedArtifacts(pkg, produced) {
  if (!produced || !Array.isArray(produced.artifacts)) fail('CACHE_ARTIFACTS_INVALID');
  const declared = (pkg.outputs || []).map((item) => item.path).slice().sort();
  const artifacts = produced.artifacts.map((artifact) => {
    if (!artifact || !Contracts.safeRelative(artifact.path)) fail('CACHE_ARTIFACT_PATH_INVALID');
    const content = Buffer.isBuffer(artifact.content) ? Buffer.from(artifact.content) : Buffer.from(String(artifact.content == null ? '' : artifact.content), 'utf8');
    return { path: artifact.path, bytes: content.length, digest: Codec.sha256(content), content };
  }).sort((left, right) => left.path.localeCompare(right.path));
  const observed = artifacts.map((item) => item.path);
  if (Codec.canonical(observed) !== Codec.canonical(declared) || new Set(observed).size !== observed.length) fail('CACHE_ARTIFACT_DECLARATION_MISMATCH');
  const total = artifacts.reduce((sum, item) => sum + item.bytes, 0);
  if (total > pkg.resource_budget.max_output_bytes) fail('CACHE_ARTIFACT_BUDGET_EXCEEDED');
  return artifacts;
}

function manifestFor(key, binding, pkg, produced) {
  const artifacts = normalizedArtifacts(pkg, produced);
  return {
    manifest: Codec.seal({
      schema: ENTRY_SCHEMA,
      version: '0.1.0',
      key,
      binding,
      artifacts: artifacts.map((item) => ({ path: item.path, bytes: item.bytes, digest: item.digest, entry_relative_path: 'artifacts/' + item.path })),
      facts: factRecord(produced.facts),
      verification: { verifier: Codec.clone(pkg.verifier), source_verdict: 'VERIFIED', reverify_on_hit: true },
      authority: { execution: false, installed: false, promoted: false, canon: false, released: false }
    }),
    artifacts
  };
}

function validateManifest(entryRoot, manifest, key, binding, pkg) {
  if (!manifest || manifest.schema !== ENTRY_SCHEMA || manifest.version !== '0.1.0' || manifest.key !== key || !Codec.validDigest(manifest)) fail('CACHE_MANIFEST_INTEGRITY_MISMATCH');
  if (Codec.digest(manifest.binding) !== key || Codec.canonical(manifest.binding) !== Codec.canonical(binding)) fail('CACHE_BINDING_MISMATCH');
  if (!manifest.authority || manifest.authority.execution !== false || manifest.authority.installed !== false || manifest.authority.promoted !== false || manifest.authority.canon !== false || manifest.authority.released !== false) fail('CACHE_AUTHORITY_INVALID');
  if (!manifest.verification || Codec.canonical(manifest.verification.verifier) !== Codec.canonical(pkg.verifier) || manifest.verification.source_verdict !== 'VERIFIED' || manifest.verification.reverify_on_hit !== true) fail('CACHE_VERIFICATION_BINDING_INVALID');
  const facts = factRecord(manifest.facts);
  if (!Array.isArray(manifest.artifacts)) fail('CACHE_MANIFEST_ARTIFACTS_INVALID');
  const declared = (pkg.outputs || []).map((item) => item.path).slice().sort();
  const observed = manifest.artifacts.map((item) => item && item.path).slice().sort();
  if (Codec.canonical(observed) !== Codec.canonical(declared) || new Set(observed).size !== observed.length) fail('CACHE_MANIFEST_OUTPUT_MISMATCH');
  const artifacts = [];
  let total = 0;
  for (const descriptor of manifest.artifacts) {
    if (!descriptor || !Contracts.safeRelative(descriptor.path) || descriptor.entry_relative_path !== 'artifacts/' + descriptor.path || !Number.isInteger(descriptor.bytes) || descriptor.bytes < 0 || !DIGEST.test(String(descriptor.digest || ''))) fail('CACHE_ARTIFACT_DESCRIPTOR_INVALID');
    const file = safeTarget(entryRoot, descriptor.entry_relative_path);
    if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) fail('CACHE_ARTIFACT_MISSING');
    const content = fs.readFileSync(file);
    if (content.length !== descriptor.bytes || Codec.sha256(content) !== descriptor.digest) fail('CACHE_ARTIFACT_INTEGRITY_MISMATCH');
    total += content.length;
    artifacts.push({ path: descriptor.path, content });
  }
  if (total > pkg.resource_budget.max_output_bytes) fail('CACHE_ARTIFACT_BUDGET_EXCEEDED');
  const order = new Map((pkg.outputs || []).map((item, index) => [item.path, index]));
  artifacts.sort((left, right) => order.get(left.path) - order.get(right.path));
  return { artifacts, facts };
}

function codeFor(error) { return error instanceof CacheError ? error.code : 'CACHE_ENTRY_UNREADABLE'; }

function load(root, pkg, inputs, seed) {
  const binding = bindingFor(pkg, inputs, seed), key = Codec.digest(binding);
  try {
    const entryRoot = entryDirectory(root, key);
    if (!fs.existsSync(entryRoot)) return { state: 'MISS', key, entry_digest: null, reason: null, produced: null };
    const manifestFile = safeTarget(entryRoot, 'entry.json');
    if (!fs.existsSync(manifestFile) || !fs.lstatSync(manifestFile).isFile()) fail('CACHE_MANIFEST_MISSING');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const produced = validateManifest(entryRoot, manifest, key, binding, pkg);
    return { state: 'HIT', key, entry_digest: manifest.digest, reason: null, produced };
  } catch (error) {
    return { state: 'REJECTED', key, entry_digest: null, reason: codeFor(error), produced: null };
  }
}

function removeTemporary(parent, temporary, key) {
  if (!inside(parent, temporary) || path.dirname(temporary).toLowerCase() !== path.resolve(parent).toLowerCase() || !path.basename(temporary).startsWith(key + '.next-')) fail('CACHE_TEMP_CLEANUP_REFUSED');
  if (!fs.existsSync(temporary)) return;
  const link = fs.lstatSync(temporary);
  if (link.isSymbolicLink()) fs.unlinkSync(temporary);
  else fs.rmSync(temporary, { recursive: true, force: true });
}

function compareExisting(root, key, binding, pkg, expectedManifest) {
  const entryRoot = entryDirectory(root, key);
  try {
    const manifest = JSON.parse(fs.readFileSync(safeTarget(entryRoot, 'entry.json'), 'utf8'));
    validateManifest(entryRoot, manifest, key, binding, pkg);
    return Codec.canonical(manifest) === Codec.canonical(expectedManifest)
      ? { state: 'EXISTS', key, entry_digest: manifest.digest, reason: null }
      : { state: 'CONFLICT', key, entry_digest: manifest.digest, reason: 'CACHE_SAME_KEY_DIFFERENT_RESULT' };
  } catch (error) {
    return { state: 'REJECTED', key, entry_digest: null, reason: codeFor(error) };
  }
}

function publish(root, pkg, inputs, seed, produced) {
  const binding = bindingFor(pkg, inputs, seed), key = Codec.digest(binding);
  let expected;
  try { expected = manifestFor(key, binding, pkg, produced); }
  catch (error) { return { state: 'NOT_STORED', key, entry_digest: null, reason: codeFor(error) }; }
  let entryRoot;
  try { entryRoot = entryDirectory(root, key); }
  catch (error) { return { state: 'NOT_STORED', key, entry_digest: null, reason: codeFor(error) }; }
  const parent = path.dirname(entryRoot);
  fs.mkdirSync(parent, { recursive: true });
  if (fs.existsSync(entryRoot)) return compareExisting(root, key, binding, pkg, expected.manifest);
  const nonce = crypto.randomBytes(8).toString('hex');
  const temporary = path.join(parent, key + '.next-' + process.pid + '-' + nonce);
  try {
    fs.mkdirSync(temporary, { recursive: false });
    for (const artifact of expected.artifacts) {
      const target = safeTarget(temporary, 'artifacts/' + artifact.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, artifact.content, { flag: 'wx' });
    }
    fs.writeFileSync(safeTarget(temporary, 'entry.json'), JSON.stringify(expected.manifest, null, 2) + '\n', { flag: 'wx' });
    try { fs.renameSync(temporary, entryRoot); }
    catch (error) {
      if (!fs.existsSync(entryRoot)) throw error;
      return compareExisting(root, key, binding, pkg, expected.manifest);
    }
    return { state: 'STORED', key, entry_digest: expected.manifest.digest, reason: null };
  } catch (error) {
    return { state: 'NOT_STORED', key, entry_digest: null, reason: codeFor(error) };
  } finally {
    if (fs.existsSync(temporary)) removeTemporary(parent, temporary, key);
  }
}

function invalidationReceipt(key, status, explicit, entryRemoved) {
  return Codec.seal({ schema: INVALIDATION_SCHEMA, key: String(key || ''), status, entry_removed: entryRemoved === true, explicit: explicit === true, authority: { installed: false, promoted: false, canon: false } });
}

function invalidationNotRequested(key) { return invalidationReceipt(key, 'NOT_REQUESTED', false, false); }

function treeHasLink(directory) {
  for (const name of fs.readdirSync(directory)) {
    const target = path.join(directory, name), stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) return true;
    if (stat.isDirectory() && treeHasLink(target)) return true;
  }
  return false;
}

function invalidate(root, key, options) {
  const receipt = { schema: INVALIDATION_SCHEMA, key: String(key || ''), status: 'REFUSED', entry_removed: false, explicit: options && options.explicit === true, authority: { installed: false, promoted: false, canon: false } };
  if (!receipt.explicit) return Codec.seal(receipt);
  if (!DIGEST.test(receipt.key)) { receipt.status = 'INVALID_KEY'; return Codec.seal(receipt); }
  let entryRoot;
  try { entryRoot = entryDirectory(root, receipt.key); }
  catch (error) {
    receipt.status = error instanceof CacheError && ['CACHE_PATH_TRAVERSES_LINK', 'CACHE_LINK_ESCAPE'].includes(error.code) ? 'REFUSED_LINK' : 'FAILED';
    return Codec.seal(receipt);
  }
  if (!fs.existsSync(entryRoot)) { receipt.status = 'ABSENT'; return Codec.seal(receipt); }
  if (resolveExistingLinks(entryRoot).toLowerCase() !== path.resolve(entryRoot).toLowerCase() || treeHasLink(entryRoot)) { receipt.status = 'REFUSED_LINK'; return Codec.seal(receipt); }
  fs.rmSync(entryRoot, { recursive: true, force: true });
  receipt.status = fs.existsSync(entryRoot) ? 'FAILED' : 'REMOVED';
  receipt.entry_removed = receipt.status === 'REMOVED';
  return Codec.seal(receipt);
}

function open(options) {
  options = options || {};
  const root = assertCacheRoot(options.cacheRoot, options.sourceRoot, options.jobRoot);
  return Object.freeze({
    root,
    load: (pkg, inputs, seed) => load(root, pkg, inputs, seed),
    publish: (pkg, inputs, seed, produced) => publish(root, pkg, inputs, seed, produced),
    invalidate: (key, invalidateOptions) => invalidate(root, key, invalidateOptions)
  });
}

module.exports = { ENTRY_SCHEMA, INVALIDATION_SCHEMA, KEY_SCHEMA, POLICY, CacheError, assertCacheRoot, bindingFor, keyFor, invalidationNotRequested, locate, open };
