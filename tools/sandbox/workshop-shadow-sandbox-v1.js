'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const Readiness = require('../../shared/readiness/tool-readiness');
const Planner = require('../../shared/code-capability-fabric/workshop-shadow-improvement-planner-v1');

const VERSION = '1.0.0';
const RECEIPT_SCHEMA = 'axm.workshop-shadow-draft-receipt/v1';
const ROOT_NAMES = Object.freeze({ source: 'source', output: 'output', evidence: 'evidence' });
const ITERATION = /^iteration-([0-9]{3})$/;
const SHADOW_STATE_ROOT = path.resolve(__dirname, '../../state/workshop-shadow-sandboxes');
const REVIEW_CSP = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'self'";
const HOST_ROOT = path.resolve(__dirname, '../..');
const GENERATOR_PATHS = Object.freeze([
  'tools/sandbox/workshop-shadow-sandbox-v1.js',
  'shared/code-capability-fabric/workshop-shadow-improvement-planner-v1.js',
  'shared/readiness/tool-readiness.js',
  'hub/module-contract-verifier.js',
  'tools/deterministic-json-core/index.js'
]);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) { return Planner.canonical(value); }
function same(a, b) { return Planner.same(a, b); }
function hashBytes(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function hashValue(value) { return Planner.hashValue(value); }
function jsonBytes(value) { return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  if (!same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(label + ' fields are not closed');
}
function safeId(value, label) { if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,127}$/.test(value)) throw new Error(label + ' must be a portable id'); return value; }
function assertAbsolute(value, label) { if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(label + ' must be an absolute path'); return path.resolve(value); }
function contained(root, target) { const relative = path.relative(root, target); return !!relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); }
function assertContained(root, target, label) { if (!contained(root, target)) throw new Error(label + ' must be contained by its declared root'); }
function assertDisjoint(left, right, label) {
  const a = path.resolve(left).toLowerCase(), b = path.resolve(right).toLowerCase();
  if (a === b || contained(a, b) || contained(b, a)) throw new Error(label + ' must be physically disjoint');
}
function assertOrdinaryDirectory(target, label) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) throw new Error(label + ' must not be a symlink or junction alias');
  if (!stat.isDirectory()) throw new Error(label + ' must be an ordinary directory');
  const real = fs.realpathSync.native(target);
  if (path.resolve(real).toLowerCase() !== path.resolve(target).toLowerCase()) throw new Error(label + ' resolves through a symlink, junction, or alias');
}
function ensureStateParent(parentRoot) {
  const resolved = assertAbsolute(parentRoot, 'parentRoot');
  if (!fs.existsSync(SHADOW_STATE_ROOT)) fs.mkdirSync(SHADOW_STATE_ROOT, { recursive: true });
  assertOrdinaryDirectory(SHADOW_STATE_ROOT, 'shadow state root');
  if (resolved.toLowerCase() !== SHADOW_STATE_ROOT.toLowerCase()) {
    assertContained(SHADOW_STATE_ROOT, resolved, 'parentRoot');
    if (path.dirname(resolved).toLowerCase() !== SHADOW_STATE_ROOT.toLowerCase()) throw new Error('parentRoot must be the shadow state root or one direct child');
  }
  if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: false });
  assertOrdinaryDirectory(resolved, 'parentRoot');
  return resolved;
}
function assertSourceRoot(sourceRoot) {
  const root = assertAbsolute(sourceRoot, 'sourceRoot');
  assertOrdinaryDirectory(root, 'sourceRoot');
  for (const required of ['verify.js', 'tools', 'shared/readiness/promotion-ladder.json']) {
    const target = path.resolve(root, ...required.split('/'));
    assertContained(root, target, 'source marker');
    if (!fs.existsSync(target)) throw new Error('sourceRoot is missing Workshop marker: ' + required);
  }
  return root;
}
function resolveOrdinaryFile(root, relative, label) {
  const portable = Planner.portablePath(relative, label);
  const target = path.resolve(root, ...portable.split('/'));
  assertContained(root, target, label);
  if (!fs.existsSync(target)) throw new Error(label + ' is missing: ' + portable);
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(label + ' is not an ordinary file: ' + portable);
  const real = fs.realpathSync.native(target);
  assertContained(fs.realpathSync.native(root), real, label + ' real path');
  return { portable, target };
}
function readFileRef(root, relative, label) {
  const found = resolveOrdinaryFile(root, relative, label);
  const bytes = fs.readFileSync(found.target);
  return { path: found.portable, bytes, sha256: hashBytes(bytes), byteLength: bytes.length };
}
function publicFileRef(value) { return { path: value.path, sha256: value.sha256, byteLength: value.byteLength }; }
function generatorRefs() { return GENERATOR_PATHS.map((relative) => publicFileRef(readFileRef(HOST_ROOT, relative, 'trusted generator input'))); }
function validateDigest(value, label) { if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) throw new Error(label + ' must be a SHA-256 digest'); return value; }
function validateRef(value, label) {
  exact(value, ['id', 'schema', 'sha256'], label);
  safeId(value.id, label + '.id');
  if (typeof value.schema !== 'string' || !value.schema || value.schema.length > 180) throw new Error(label + '.schema is invalid');
  validateDigest(value.sha256, label + '.sha256');
  return value;
}
function validateFileRef(value, label) {
  exact(value, ['path', 'sha256', 'byteLength'], label);
  Planner.portablePath(value.path, label + '.path'); validateDigest(value.sha256, label + '.sha256');
  if (!Number.isSafeInteger(value.byteLength) || value.byteLength < 1) throw new Error(label + '.byteLength is invalid');
  return value;
}
function summarizeIndex(index) {
  const summary = index.summary || {};
  const queue = index.promotionQueue || {};
  return {
    tools: Number(summary.tools || 0), contractsPresent: Number(summary.contractsPresent || 0), contractsValid: Number(summary.contractsValid || 0),
    topLevelSelftests: Number(summary.topLevelSelftests || 0), capabilities: Number(summary.capabilities || 0),
    readyForHumanReview: Array.isArray(queue.readyForHumanReview) ? queue.readyForHumanReview.length : 0,
    blocked: Array.isArray(queue.blocked) ? queue.blocked.length : 0,
    claimsNeedingReverification: Array.isArray(queue.claimsNeedingReverification) ? queue.claimsNeedingReverification.length : 0
  };
}
function canonicalToolIds(index) { return Array.isArray(index.tools) ? Array.from(new Set(index.tools.map((tool) => safeId(tool.id, 'tool id')))).sort() : []; }
function sanitizeVerificationResults(index) {
  if (!index || !Array.isArray(index.tools)) return { schema: 'axm.tool-selftest-results/v1', generatedAt: null, workers: 0, timeoutMs: 0, results: [] };
  const results = [];
  for (const tool of index.tools) {
    const value = tool && tool.selftest && tool.selftest.result;
    if (!value || value.verdict !== 'PASS' || value.failureTail !== null) continue;
    const keys = ['id', 'path', 'selftestSha256', 'selftestDigestScope', 'verdict', 'exitCode', 'durationMs', 'outputSha256', 'failureTail'];
    if (!same(Object.keys(value).sort(), keys.slice().sort())) continue;
    try {
      const result = {
        id: safeId(value.id, 'verification result id'), path: Planner.portablePath(value.path, 'verification result path'),
        selftestSha256: String(value.selftestSha256), selftestDigestScope: String(value.selftestDigestScope), verdict: 'PASS',
        exitCode: value.exitCode, durationMs: value.durationMs, outputSha256: String(value.outputSha256), failureTail: null
      };
      if (!/^[0-9a-f]{64}$/.test(result.selftestSha256) || !/^[0-9a-f]{64}$/.test(result.outputSha256) || result.selftestDigestScope !== Readiness.SELFTEST_DIGEST_SCOPE || result.exitCode !== 0 || !Number.isSafeInteger(result.durationMs) || result.durationMs < 0) continue;
      results.push(result);
    } catch { /* malformed prior evidence remains omitted */ }
  }
  return { schema: 'axm.tool-selftest-results/v1', generatedAt: null, workers: 0, timeoutMs: 0, results: results.sort((a, b) => a.id.localeCompare(b.id)) };
}
function parseCurrentIndex(root) {
  const file = path.join(root, 'tools-index.json');
  if (!fs.existsSync(file)) return { state: 'MISSING', ref: null, sourceDigest: null, summary: null, toolIds: [], value: null };
  const source = readFileRef(root, 'tools-index.json', 'current tools index');
  let value = null;
  try { value = JSON.parse(source.bytes.toString('utf8')); } catch { /* invalid remains visible */ }
  const checked = value ? Readiness.validateIndex(value) : { pass: false };
  if (!checked.pass) return { state: 'INVALID', ref: publicFileRef(source), sourceDigest: null, summary: null, toolIds: [], value: null };
  return { state: 'VALID', ref: publicFileRef(source), sourceDigest: value.sourceDigest, summary: summarizeIndex(value), toolIds: canonicalToolIds(value), value };
}
function collectInputRefs(root, rebuilt, current) {
  const wanted = new Set(['shared/readiness/promotion-ladder.json']);
  if (current.ref) wanted.add('tools-index.json');
  for (const tool of rebuilt.tools) {
    if (tool.manifest && tool.manifest.path) wanted.add(tool.manifest.path);
    if (tool.contract && tool.contract.path) wanted.add(tool.contract.path);
    for (const selftest of tool.selftest && tool.selftest.paths || []) wanted.add(selftest);
  }
  const refs = [];
  const seen = new Set();
  for (const relative of Array.from(wanted).sort()) {
    const ref = readFileRef(root, relative, 'snapshot input');
    const key = ref.path.toLowerCase();
    if (seen.has(key)) throw new Error('snapshot input path collision: ' + ref.path);
    seen.add(key); refs.push(publicFileRef(ref));
  }
  return refs;
}
function scanSource(sourceRoot, inputRequest) {
  const root = assertSourceRoot(sourceRoot);
  const request = Planner.normalizeRequest(inputRequest);
  const current = parseCurrentIndex(root);
  const verificationResults = sanitizeVerificationResults(current.value);
  const rebuilt = Readiness.buildIndex(root, { now: request.evaluatedAt, verificationResults, promotionLadderFile: path.join(root, 'shared/readiness/promotion-ladder.json') });
  const checked = Readiness.validateIndex(rebuilt);
  if (!checked.pass) throw new Error('rebuilt tools index is invalid: ' + checked.errors.join('; '));
  const rebuiltBytes = jsonBytes(rebuilt);
  if (rebuiltBytes.length > request.resources.maxOutputBytes) throw new Error('rebuilt tools index exceeds output budget');
  const inputRefs = collectInputRefs(root, rebuilt, current);
  const inputBytes = inputRefs.reduce((sum, ref) => sum + ref.byteLength, 0);
  if (inputRefs.length > request.resources.maxInputFiles || inputBytes > request.resources.maxInputBytes) throw new Error('Workshop snapshot exceeds input budget');
  const snapshot = Planner.sealSnapshot({
    schema: Planner.SNAPSHOT_SCHEMA, version: VERSION, status: 'TEST', id: request.id + '-snapshot', sourceLabel: request.sourceLabel, evaluatedAt: request.evaluatedAt, scopeId: Planner.SCOPE_ID,
    inputRefs,
    currentIndex: { state: current.state, ref: current.ref, sourceDigest: current.sourceDigest, summary: current.summary, toolIds: current.toolIds },
    rebuiltIndex: { state: 'VALID', ref: { path: 'tools-index.json', sha256: hashBytes(rebuiltBytes), byteLength: rebuiltBytes.length }, sourceDigest: rebuilt.sourceDigest, summary: summarizeIndex(rebuilt), toolIds: canonicalToolIds(rebuilt) },
    resources: { inputFiles: inputRefs.length, inputBytes, enforced: true }, privacy: { rawSourceRetained: false, machinePathsRetained: false, secretsRead: false },
    truth: { sourceRead: true, sourceWritten: false, candidateExecuted: false, networkUsed: false, childProcessSpawned: false, installed: false, integrated: false, promoted: false, canonChanged: false }, authority: 'NONE'
  });
  return { root, request, snapshot, rebuilt, rebuiltBytes };
}
function prepare(options) {
  exact(options, ['sourceRoot', 'request'], 'prepare options');
  const observed = scanSource(options.sourceRoot, options.request);
  const planned = Planner.plan(observed.request, observed.snapshot);
  if (planned.plan.status === 'DRAFT_PLANNED' && hashBytes(observed.rebuiltBytes) !== planned.plan.changes[0].replacementSha256) throw new Error('planned replacement bytes drifted');
  const generators = generatorRefs();
  const core = { requestRef: planned.plan.requestRef, snapshotRef: planned.plan.snapshotRef, planRef: { id: planned.plan.id, schema: planned.plan.schema, sha256: planned.plan.planDigest }, generatorRefs: generators, replacementRef: observed.snapshot.rebuiltIndex.ref };
  return { sourceRoot: observed.root, request: planned.request, snapshot: planned.snapshot, plan: planned.plan, generatorRefs: generators, rebuiltBytes: observed.rebuiltBytes, preparedDigest: hashValue(core) };
}
function verifyPrepared(prepared) {
  exact(prepared, ['sourceRoot', 'request', 'snapshot', 'plan', 'generatorRefs', 'rebuiltBytes', 'preparedDigest'], 'prepared shadow draft');
  const rebuilt = Planner.plan(prepared.request, prepared.snapshot);
  const currentGenerators = generatorRefs();
  if (!same(rebuilt.plan, prepared.plan) || !same(prepared.generatorRefs, currentGenerators) || !Buffer.isBuffer(prepared.rebuiltBytes) || hashBytes(prepared.rebuiltBytes) !== prepared.snapshot.rebuiltIndex.ref.sha256 || prepared.rebuiltBytes.length !== prepared.snapshot.rebuiltIndex.ref.byteLength) throw new Error('prepared shadow draft lineage drifted');
  const core = { requestRef: prepared.plan.requestRef, snapshotRef: prepared.plan.snapshotRef, planRef: { id: prepared.plan.id, schema: prepared.plan.schema, sha256: prepared.plan.planDigest }, generatorRefs: prepared.generatorRefs, replacementRef: prepared.snapshot.rebuiltIndex.ref };
  if (prepared.preparedDigest !== hashValue(core)) throw new Error('prepared shadow draft digest mismatch');
  return prepared;
}
function writeExclusive(target, bytes) { fs.writeFileSync(target, bytes, { flag: 'wx' }); }
function makeReadonly(target) { fs.chmodSync(target, 0o444); }
function makeWritableTree(root) { if (!fs.existsSync(root)) return; for (const entry of fs.readdirSync(root, { withFileTypes: true })) { const target = path.join(root, entry.name); if (entry.isDirectory()) makeWritableTree(target); else if (entry.isFile()) fs.chmodSync(target, 0o644); } }
function iterationId(number) { return 'iteration-' + String(number).padStart(3, '0'); }
function outputFileRef(bytes) { return { path: 'tools-index.json', sha256: hashBytes(bytes), byteLength: bytes.length }; }
function receiptCore(sessionId, number, prepared, snapshotBytes, evidenceBytesExcludingReceipt) {
  const id = iterationId(number);
  return {
    schema: RECEIPT_SCHEMA, version: VERSION, status: 'TEST', sessionId, iteration: { id, number }, sourceLabel: prepared.request.sourceLabel,
    requestRef: clone(prepared.plan.requestRef), snapshotRef: clone(prepared.plan.snapshotRef), sourceStateDigest: prepared.snapshot.sourceStateDigest,
    planRef: { id: prepared.plan.id, schema: prepared.plan.schema, sha256: prepared.plan.planDigest }, generatorRefs: clone(prepared.generatorRefs), outputRef: outputFileRef(prepared.rebuiltBytes), roots: clone(ROOT_NAMES),
    resources: { inputFiles: prepared.snapshot.resources.inputFiles, inputBytes: prepared.snapshot.resources.inputBytes, snapshotFiles: 1, snapshotBytes: snapshotBytes.length, outputFiles: 1, outputBytes: prepared.rebuiltBytes.length, evidenceFiles: 2, evidenceBytesExcludingReceipt, networkRequests: 0, childProcesses: 0, enforced: true },
    privacy: { rawSourceRetained: false, stdoutRetained: false, stderrRetained: false, machinePathsRetained: false, secretsRead: false },
    truth: { sourceSnapshotReverifiedBeforeWrite: true, sourceWritten: false, draftDetached: true, candidateExecuted: false, previewStarted: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false }, authority: 'NONE'
  };
}
function reobserveMatches(prepared) {
  const fresh = scanSource(prepared.sourceRoot, prepared.request);
  return fresh.snapshot.sourceStateDigest === prepared.snapshot.sourceStateDigest && fresh.snapshot.snapshotDigest === prepared.snapshot.snapshotDigest;
}
function materializeIteration(sessionRoot, sessionId, number, prepared) {
  verifyPrepared(prepared);
  if (prepared.plan.status !== 'DRAFT_PLANNED') throw new Error('NO_SHADOW_IMPROVEMENT_TO_DRAFT');
  if (!reobserveMatches(prepared)) throw new Error('SOURCE_CHANGED_BEFORE_SHADOW_WRITE');
  const id = iterationId(number);
  const sourceRoot = path.join(sessionRoot, ROOT_NAMES.source), outputRoot = path.join(sessionRoot, ROOT_NAMES.output), evidenceRoot = path.join(sessionRoot, ROOT_NAMES.evidence);
  const snapshotPath = path.join(sourceRoot, id + '.snapshot.json'), iterationRoot = path.join(outputRoot, id), planPath = path.join(evidenceRoot, id + '.plan.json'), receiptPath = path.join(evidenceRoot, id + '.receipt.json');
  if (fs.existsSync(snapshotPath) || fs.existsSync(iterationRoot) || fs.existsSync(planPath) || fs.existsSync(receiptPath)) throw new Error('shadow iteration destination already exists');
  const snapshotBytes = jsonBytes(prepared.snapshot), planBytes = jsonBytes(prepared.plan);
  const evidenceBytesExcludingReceipt = planBytes.length;
  const core = receiptCore(sessionId, number, prepared, snapshotBytes, evidenceBytesExcludingReceipt);
  const receipt = { ...core, receiptDigest: hashValue(core) };
  const receiptBytes = jsonBytes(receipt);
  if (3 > prepared.request.resources.maxEvidenceFiles || snapshotBytes.length + evidenceBytesExcludingReceipt + receiptBytes.length > prepared.request.resources.maxEvidenceBytes) throw new Error('shadow evidence budget exceeded');
  fs.mkdirSync(iterationRoot, { recursive: false });
  try {
    writeExclusive(snapshotPath, snapshotBytes); writeExclusive(path.join(iterationRoot, 'tools-index.json'), prepared.rebuiltBytes); writeExclusive(planPath, planBytes); writeExclusive(receiptPath, receiptBytes);
    for (const target of [snapshotPath, path.join(iterationRoot, 'tools-index.json'), planPath, receiptPath]) makeReadonly(target);
    if (!reobserveMatches(prepared)) throw new Error('SOURCE_CHANGED_DURING_SHADOW_WRITE');
    return { id, number, receipt, snapshot: prepared.snapshot, plan: prepared.plan, outputRoot: iterationRoot };
  } catch (error) {
    for (const target of [snapshotPath, iterationRoot, planPath, receiptPath]) {
      if (!fs.existsSync(target)) continue;
      if (fs.lstatSync(target).isDirectory()) { makeWritableTree(target); fs.rmSync(target, { recursive: true, force: true }); }
      else { fs.chmodSync(target, 0o644); fs.rmSync(target, { force: true }); }
    }
    throw error;
  }
}
function createSession(options) {
  exact(options, ['parentRoot', 'sessionId', 'prepared'], 'createSession options');
  const prepared = verifyPrepared(options.prepared);
  const parentRoot = ensureStateParent(options.parentRoot), sourceRoot = assertSourceRoot(prepared.sourceRoot);
  assertDisjoint(sourceRoot, parentRoot, 'Workshop source and shadow state');
  const sessionId = safeId(options.sessionId, 'sessionId'), sessionRoot = path.resolve(parentRoot, sessionId);
  assertContained(parentRoot, sessionRoot, 'session root');
  if (fs.existsSync(sessionRoot)) throw new Error('shadow session already exists');
  fs.mkdirSync(sessionRoot, { recursive: false });
  try {
    for (const name of Object.values(ROOT_NAMES)) fs.mkdirSync(path.join(sessionRoot, name), { recursive: false });
    const realRoots = Object.values(ROOT_NAMES).map((name) => fs.realpathSync.native(path.join(sessionRoot, name)).toLowerCase());
    if (new Set(realRoots).size !== 3) throw new Error('shadow roots are not physically disjoint');
    const iteration = materializeIteration(sessionRoot, sessionId, 0, prepared);
    return { sessionId, sessionRoot, parentRoot, sourceRoot, request: clone(prepared.request), latest: iteration };
  } catch (error) {
    makeWritableTree(sessionRoot); fs.rmSync(sessionRoot, { recursive: true, force: true }); throw error;
  }
}
function listIterations(sessionRoot) {
  const outputRoot = path.join(sessionRoot, ROOT_NAMES.output);
  return fs.readdirSync(outputRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && ITERATION.test(entry.name)).map((entry) => ({ id: entry.name, number: Number(entry.name.match(ITERATION)[1]) })).sort((a, b) => a.number - b.number);
}
function readReceipt(sessionRoot, id) {
  const target = path.join(sessionRoot, ROOT_NAMES.evidence, id + '.receipt.json');
  const value = JSON.parse(fs.readFileSync(target, 'utf8'));
  exact(value, ['schema', 'version', 'status', 'sessionId', 'iteration', 'sourceLabel', 'requestRef', 'snapshotRef', 'sourceStateDigest', 'planRef', 'generatorRefs', 'outputRef', 'roots', 'resources', 'privacy', 'truth', 'authority', 'receiptDigest'], 'shadow receipt');
  if (value.schema !== RECEIPT_SCHEMA || value.version !== VERSION || value.status !== 'TEST' || value.authority !== 'NONE') throw new Error('shadow receipt identity or authority drifted: ' + id);
  safeId(value.sessionId, 'receipt.sessionId');
  exact(value.iteration, ['id', 'number'], 'receipt.iteration');
  if (value.iteration.id !== id || !ITERATION.test(id) || value.iteration.number !== Number(id.match(ITERATION)[1])) throw new Error('shadow receipt iteration drifted: ' + id);
  if (typeof value.sourceLabel !== 'string' || value.sourceLabel.length < 1 || value.sourceLabel.length > 160) throw new Error('shadow receipt source label is invalid');
  validateRef(value.requestRef, 'receipt.requestRef'); validateRef(value.snapshotRef, 'receipt.snapshotRef'); validateDigest(value.sourceStateDigest, 'receipt.sourceStateDigest'); validateRef(value.planRef, 'receipt.planRef');
  if (!Array.isArray(value.generatorRefs) || value.generatorRefs.length !== GENERATOR_PATHS.length) throw new Error('shadow receipt generator refs are invalid');
  value.generatorRefs.forEach((ref, index) => { validateFileRef(ref, 'receipt.generatorRefs[' + index + ']'); if (ref.path !== GENERATOR_PATHS[index]) throw new Error('shadow receipt generator path drifted'); });
  validateFileRef(value.outputRef, 'receipt.outputRef'); if (value.outputRef.path !== 'tools-index.json') throw new Error('shadow receipt output path drifted');
  exact(value.roots, ['source', 'output', 'evidence'], 'receipt.roots'); if (!same(value.roots, ROOT_NAMES)) throw new Error('shadow receipt roots drifted');
  exact(value.resources, ['inputFiles', 'inputBytes', 'snapshotFiles', 'snapshotBytes', 'outputFiles', 'outputBytes', 'evidenceFiles', 'evidenceBytesExcludingReceipt', 'networkRequests', 'childProcesses', 'enforced'], 'receipt.resources');
  for (const key of ['inputFiles', 'inputBytes', 'snapshotBytes', 'outputBytes', 'evidenceBytesExcludingReceipt']) if (!Number.isSafeInteger(value.resources[key]) || value.resources[key] < 1) throw new Error('shadow receipt resource measurement is invalid: ' + key);
  if (value.resources.snapshotFiles !== 1 || value.resources.outputFiles !== 1 || value.resources.evidenceFiles !== 2 || value.resources.networkRequests !== 0 || value.resources.childProcesses !== 0 || value.resources.enforced !== true) throw new Error('shadow receipt resource authority drifted');
  exact(value.privacy, ['rawSourceRetained', 'stdoutRetained', 'stderrRetained', 'machinePathsRetained', 'secretsRead'], 'receipt.privacy');
  if (!same(value.privacy, { rawSourceRetained: false, stdoutRetained: false, stderrRetained: false, machinePathsRetained: false, secretsRead: false })) throw new Error('shadow receipt privacy drifted');
  exact(value.truth, ['sourceSnapshotReverifiedBeforeWrite', 'sourceWritten', 'draftDetached', 'candidateExecuted', 'previewStarted', 'installed', 'integrated', 'published', 'promoted', 'canonChanged'], 'receipt.truth');
  if (!same(value.truth, { sourceSnapshotReverifiedBeforeWrite: true, sourceWritten: false, draftDetached: true, candidateExecuted: false, previewStarted: false, installed: false, integrated: false, published: false, promoted: false, canonChanged: false })) throw new Error('shadow receipt lifecycle truth drifted');
  validateDigest(value.receiptDigest, 'receipt.receiptDigest');
  const { receiptDigest, ...core } = value;
  if (receiptDigest !== hashValue(core)) throw new Error('shadow receipt integrity drifted: ' + id);
  return value;
}
function resumeSession(options) {
  exact(options, ['sourceRoot', 'parentRoot', 'sessionId', 'request'], 'resumeSession options');
  const parentRoot = ensureStateParent(options.parentRoot), sessionId = safeId(options.sessionId, 'sessionId'), sessionRoot = path.resolve(parentRoot, sessionId), sourceRoot = assertSourceRoot(options.sourceRoot), request = Planner.normalizeRequest(options.request);
  assertContained(parentRoot, sessionRoot, 'session root'); assertOrdinaryDirectory(sessionRoot, 'session root'); assertDisjoint(sourceRoot, parentRoot, 'Workshop source and shadow state');
  const iterations = listIterations(sessionRoot);
  if (!iterations.length) throw new Error('shadow session contains no iteration');
  const currentGenerators = generatorRefs();
  let previous = -1, latest = null;
  for (const iteration of iterations) {
    if (iteration.number !== previous + 1) throw new Error('shadow iteration sequence is not contiguous');
    previous = iteration.number; const receipt = readReceipt(sessionRoot, iteration.id);
    if (receipt.iteration.number !== iteration.number || receipt.sessionId !== sessionId || receipt.sourceLabel !== request.sourceLabel || receipt.requestRef.sha256 !== request.requestDigest || !same(receipt.generatorRefs, currentGenerators)) throw new Error('shadow iteration request or generator lineage drifted');
    const snapshotPath = path.join(sessionRoot, ROOT_NAMES.source, iteration.id + '.snapshot.json'), planPath = path.join(sessionRoot, ROOT_NAMES.evidence, iteration.id + '.plan.json');
    const snapshotBytes = fs.readFileSync(snapshotPath), planBytes = fs.readFileSync(planPath), snapshot = Planner.normalizeSnapshot(JSON.parse(snapshotBytes.toString('utf8'))), storedPlan = JSON.parse(planBytes.toString('utf8')), rebuiltPlan = Planner.plan(request, snapshot).plan;
    if (snapshot.snapshotDigest !== receipt.snapshotRef.sha256 || snapshot.sourceStateDigest !== receipt.sourceStateDigest || snapshotBytes.length !== receipt.resources.snapshotBytes || !same(storedPlan, rebuiltPlan) || storedPlan.planDigest !== receipt.planRef.sha256 || planBytes.length !== receipt.resources.evidenceBytesExcludingReceipt) throw new Error('shadow snapshot or plan lineage drifted: ' + iteration.id);
    const output = fs.readFileSync(path.join(sessionRoot, ROOT_NAMES.output, iteration.id, 'tools-index.json'));
    if (hashBytes(output) !== receipt.outputRef.sha256 || output.length !== receipt.outputRef.byteLength || receipt.outputRef.sha256 !== snapshot.rebuiltIndex.ref.sha256 || receipt.outputRef.byteLength !== snapshot.rebuiltIndex.ref.byteLength) throw new Error('shadow output bytes drifted: ' + iteration.id);
    latest = { ...iteration, receipt, snapshot, plan: storedPlan, outputRoot: path.join(sessionRoot, ROOT_NAMES.output, iteration.id) };
  }
  return { sessionId, sessionRoot, parentRoot, sourceRoot, request, latest };
}
function refreshSession(session) {
  const prepared = prepare({ sourceRoot: session.sourceRoot, request: session.request });
  if (prepared.snapshot.sourceStateDigest === session.latest.receipt.sourceStateDigest) return { status: 'CURRENT_NO_NEW_ITERATION', session, prepared };
  if (prepared.plan.status !== 'DRAFT_PLANNED') return { status: 'CURRENT_SOURCE_NO_DRAFT', session, prepared };
  const nextNumber = session.latest.number + 1;
  if (nextNumber >= session.request.resources.maxIterations) throw new Error('shadow iteration ceiling reached');
  const latest = materializeIteration(session.sessionRoot, session.sessionId, nextNumber, prepared);
  session.latest = latest;
  return { status: 'REFRESHED_WITH_NEW_DRAFT', session, prepared };
}
function html(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function reviewShell(session, plan) {
  const before = plan.comparison.summaryBefore, after = plan.comparison.summaryAfter;
  const metric = (label, key) => '<div><strong>' + html(after[key]) + '</strong><span>' + html(label) + '</span><small>before ' + html(before ? before[key] : 'missing') + '</small></div>';
  const added = plan.comparison.addedToolIds.length ? plan.comparison.addedToolIds.join(', ') : 'none';
  const removed = plan.comparison.removedToolIds.length ? plan.comparison.removedToolIds.join(', ') : 'none';
  return Buffer.from('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AXM Workshop Shadow Draft · TEST</title><style>body{margin:0;background:#061018;color:#edf7ff;font:16px system-ui;line-height:1.5}main{max-width:980px;margin:auto;padding:32px}header{border:1px solid #29506a;border-radius:18px;padding:24px;background:#0a1a26}b{color:#65e7ff}h1{font-size:clamp(32px,7vw,68px);line-height:1;margin:.2em 0}.gate{color:#ffcf67}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:22px 0}.grid div,section{border:1px solid #294459;border-radius:14px;padding:16px;background:#0b1822}.grid strong{display:block;font-size:30px;color:#86f3b2}.grid span,.grid small{display:block}.grid small{color:#8ca8b8}code{overflow-wrap:anywhere;color:#9eeaff}a{color:#65e7ff}summary{cursor:pointer;color:#65e7ff;font-weight:700}li{margin:.35em 0}</style></head><body><main><header><b>AXM WORKSHOP SHADOW · TEST</b><h1>One current snapshot.<br>One detached draft.</h1><p class="gate">Not installed · no source write-back · no candidate execution</p><p>The Fabric detected <strong>' + html(plan.finding) + '</strong> from exact current scoped bytes and drafted only <code>tools-index.json</code>.</p></header><div class="grid">' + metric('tools', 'tools') + metric('valid contracts', 'contractsValid') + metric('top selftests', 'topLevelSelftests') + metric('capabilities', 'capabilities') + '</div><section><h2>Byte-bound change</h2><p>Before source digest: <code>' + html(plan.comparison.sourceDigestBefore || 'missing/invalid') + '</code></p><p>After source digest: <code>' + html(plan.comparison.sourceDigestAfter) + '</code></p><p>Added tool ids: ' + html(added) + '</p><p>Removed tool ids: ' + html(removed) + '</p><p><a href="/candidate/tools-index.json">Inspect the detached candidate JSON</a></p></section><section><h2>Boundary</h2><p>This page is generated by the trusted review shell. It contains no script and does not execute the candidate. If the scoped Workshop bytes change, this preview refuses to open until a new immutable iteration is drafted.</p><details><summary>Show exact boundary controls</summary><ul><li>Source write-back: denied</li><li>Candidate execution: denied</li><li>Install, integrate, publish, promote, CANON: denied</li><li>Authority: NONE</li></ul></details></section></main></body></html>\n', 'utf8');
}
function send(response, status, headers, body, headOnly) { response.writeHead(status, headers); response.end(headOnly ? undefined : body); }
async function startPreview(session) {
  const fresh = prepare({ sourceRoot: session.sourceRoot, request: session.request });
  if (fresh.snapshot.sourceStateDigest !== session.latest.receipt.sourceStateDigest || fresh.plan.planDigest !== session.latest.receipt.planRef.sha256 || !same(fresh.generatorRefs, session.latest.receipt.generatorRefs)) throw new Error('SHADOW_DRAFT_STALE_REFRESH_REQUIRED');
  const candidate = fs.readFileSync(path.join(session.latest.outputRoot, 'tools-index.json'));
  if (hashBytes(candidate) !== session.latest.receipt.outputRef.sha256) throw new Error('shadow preview candidate bytes drifted');
  const shell = reviewShell(session, fresh.plan);
  const server = http.createServer((request, response) => {
    const headOnly = request.method === 'HEAD';
    if (request.method !== 'GET' && !headOnly) return send(response, 405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' }, Buffer.from('method denied\n'), false);
    let pathname;
    try { pathname = new URL(request.url, 'http://127.0.0.1').pathname; } catch { return send(response, 400, { 'Cache-Control': 'no-store' }, Buffer.from('bad request\n'), headOnly); }
    if (pathname === '/') return send(response, 200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': REVIEW_CSP, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }, shell, headOnly);
    if (pathname === '/meta') return send(response, 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, jsonBytes({ schema: 'axm.workshop-shadow-preview-meta/v1', status: 'TEST', sessionId: session.sessionId, iteration: session.latest.id, sourceStateDigest: session.latest.receipt.sourceStateDigest, candidateExecuted: false, installed: false, authority: 'NONE' }), headOnly);
    if (pathname === '/candidate/tools-index.json') return send(response, 200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Security-Policy': "default-src 'none'", 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, candidate, headOnly);
    return send(response, 404, { 'Cache-Control': 'no-store' }, Buffer.from('not found\n'), headOnly);
  });
  server.maxHeadersCount = 48; server.requestTimeout = 5000; server.headersTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  return { url: 'http://127.0.0.1:' + address.port + '/', sourceStateDigest: fresh.snapshot.sourceStateDigest, candidateProcesses: 0, candidateExecuted: false, installed: false, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

module.exports = { VERSION, RECEIPT_SCHEMA, ROOT_NAMES, SHADOW_STATE_ROOT, REVIEW_CSP, GENERATOR_PATHS, clone, hashBytes, hashValue, summarizeIndex, sanitizeVerificationResults, scanSource, prepare, verifyPrepared, createSession, resumeSession, refreshSession, startPreview, reviewShell };
