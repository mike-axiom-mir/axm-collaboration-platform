'use strict';

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const Generator = require('../../shared/code-capability-fabric/deterministic-game-candidate-generator-v1');
const Core = require('../../shared/code-capability-fabric/semantic-candidate-generator-v1');

const VERSION = '0.1.0';
const SESSION_SCHEMA = 'axm.disposable-candidate-sandbox-session/v1';
const REPAIR_SCHEMA = 'axm.disposable-candidate-repair-plan/v1';
const LESSON_SCHEMA = 'axm.capability-lesson-candidate/v1';
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const FINDING = /^[A-Z0-9][A-Z0-9_-]{1,79}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const ITERATION = /^iteration-([0-9]{3})$/;
const REPAIRABLE = new Set(['README.md', 'game-forge-project.json', 'game.config.json', 'game.js', 'index.html', 'styles.css', 'test-plan.json']);
const ROOT_NAMES = Object.freeze({ source: 'source', output: 'output', evidence: 'evidence', lessons: 'lessons' });
const SANDBOX_STATE_ROOT = path.resolve(__dirname, '../../state/disposable-candidate-sandboxes');
const CANDIDATE_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; child-src 'none'; media-src 'none'; font-src 'none'; manifest-src 'none'; form-action 'none'; frame-ancestors 'self'; base-uri 'none'";
const REVIEW_CSP = "default-src 'none'; frame-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; object-src 'none'";

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) { return Core.canonicalJson(value); }
function same(a, b) { return canonical(a) === canonical(b); }
function compareText(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function hashBytes(bytes) { return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'); }
function hashValue(value) { return hashBytes(Buffer.from(canonical(value), 'utf8')); }
function jsonBytes(value) { return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  if (!same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(label + ' fields must be exactly: ' + keys.slice().sort().join(', '));
}
function safeId(value, label) { if (typeof value !== 'string' || !ID.test(value)) throw new Error(label + ' must be a portable id'); return value; }
function digest(value, label) { if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a SHA-256 digest'); return value; }
function assertAbsolute(value, label) { if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(label + ' must be an absolute path'); return path.resolve(value); }
function assertContained(root, target, label) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) throw new Error(label + ' must be a direct contained child');
}
function assertOrdinaryDirectory(target, label) {
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(label + ' must be an ordinary directory, not a symlink or junction');
  const real = fs.realpathSync.native(target);
  if (path.resolve(real).toLowerCase() !== path.resolve(target).toLowerCase()) throw new Error(label + ' resolves through an alias or reparse point');
}
function ensureParentRoot(parentRoot) {
  const resolved = assertAbsolute(parentRoot, 'parentRoot');
  if (!fs.existsSync(SANDBOX_STATE_ROOT)) fs.mkdirSync(SANDBOX_STATE_ROOT, { recursive: true });
  assertOrdinaryDirectory(SANDBOX_STATE_ROOT, 'Sandbox state root');
  if (resolved.toLowerCase() !== SANDBOX_STATE_ROOT.toLowerCase()) {
    assertContained(SANDBOX_STATE_ROOT, resolved, 'parentRoot');
    if (path.dirname(resolved).toLowerCase() !== SANDBOX_STATE_ROOT.toLowerCase()) throw new Error('parentRoot must be the Sandbox state root or one direct child');
  }
  if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: false });
  assertOrdinaryDirectory(resolved, 'parentRoot');
  return resolved;
}
function writeExclusive(filePath, bytes) { fs.writeFileSync(filePath, bytes, { flag: 'wx' }); }
function makeFilesReadonly(root) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('candidate iteration contains a non-ordinary file');
    fs.chmodSync(path.join(root, entry.name), 0o444);
  }
}
function makeFilesWritable(root) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) if (entry.isFile()) fs.chmodSync(path.join(root, entry.name), 0o644);
}
function decodeBundle(bundle, resources) {
  exact(bundle, ['schema', 'requiredSeats', 'files'], 'module bundle');
  if (bundle.schema !== 'axm.module-bundle/v1' || ![1, 2].includes(bundle.requiredSeats) || !Array.isArray(bundle.files)) throw new Error('module bundle identity mismatch');
  if (bundle.files.length > resources.maxFiles) throw new Error('module bundle file ceiling exceeded');
  const seen = new Set(); let total = 0;
  const files = bundle.files.map((file, index) => {
    exact(file, ['path', 'encoding', 'content', 'sha256'], 'module bundle file[' + index + ']');
    const portable = Core.normalizePortablePath(file.path);
    const key = Core.pathKey(portable);
    if (portable.includes('/')) throw new Error('first game sandbox accepts root-level candidate files only');
    if (seen.has(key)) throw new Error('candidate path collision: ' + portable);
    seen.add(key);
    if (file.encoding !== 'base64' || typeof file.content !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.content)) throw new Error('candidate file content is not strict base64');
    const bytes = Buffer.from(file.content, 'base64');
    if (bytes.toString('base64') !== file.content || bytes.length < 1) throw new Error('candidate file base64 is non-canonical or empty');
    if (bytes.length > resources.maxFileBytes) throw new Error('candidate file byte ceiling exceeded: ' + portable);
    if (hashBytes(bytes) !== 'sha256:' + file.sha256) throw new Error('candidate file digest mismatch: ' + portable);
    total += bytes.length;
    return { path: portable, bytes, sha256: hashBytes(bytes), byteLength: bytes.length };
  }).sort((a, b) => compareText(a.path, b.path));
  if (total > resources.maxOutputBytes) throw new Error('candidate total byte ceiling exceeded');
  return { files, total, requiredSeats: bundle.requiredSeats };
}
function strictJson(bytes, name) { try { return JSON.parse(bytes.toString('utf8')); } catch (error) { throw new Error(name + ' is not valid JSON: ' + error.message); } }
function fileMap(files) { return new Map(files.map((file) => [Core.pathKey(file.path), file])); }
function forbid(text, patterns, label) { for (const pattern of patterns) if (pattern.test(text)) throw new Error(label + ' contains forbidden authority or network token: ' + pattern.source); }
function validateStaticFiles(files, resources, declaredSeats) {
  const candidatePaths = files.map((file) => file.path);
  const legacyFileSet = same(candidatePaths, Generator.LEGACY_REQUIRED_FILES);
  const assetAwareFileSet = same(candidatePaths, Generator.REQUIRED_FILES);
  if (!legacyFileSet && !assetAwareFileSet) throw new Error('candidate file set drifted');
  const map = fileMap(files);
  const get = (name) => map.get(Core.pathKey(name));
  const script = get('game.js').bytes.toString('utf8');
  new vm.Script(script, { filename: 'candidate/game.js', displayErrors: true });
  forbid(script, [/\bfetch\s*\(/i, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bEventSource\b/, /sendBeacon\s*\(/, /\bimport\s*\(/, /\brequire\s*\(/, /\bprocess\s*\./, /child_process/i, /https?:\/\//i, /file:\/\//i], 'game.js');
  const html = get('index.html').bytes.toString('utf8');
  if ((html.match(/<script\b/gi) || []).length !== 1 || !/<script\s+src=["']game\.js["']\s*>\s*<\/script>/i.test(html)) throw new Error('index.html must contain exactly one external game.js script');
  forbid(html, [/<base\b/i, /<iframe\b/i, /<form\b/i, /<object\b/i, /<embed\b/i, /\son\w+\s*=/i, /https?:\/\//i, /file:\/\//i], 'index.html');
  const css = get('styles.css').bytes.toString('utf8');
  forbid(css, [/@import/i, /url\s*\(/i, /https?:\/\//i, /file:\/\//i], 'styles.css');
  const contract = strictJson(get('module.contract.json').bytes, 'module.contract.json');
  if (contract.schema !== 'axm.module-contract/v1' || contract.status !== 'EXPERIMENTAL' || !same(contract.permissions, []) || !same(contract.boundaries.writes, [])) throw new Error('candidate contract authority expanded');
  for (const refusal of ['network-use', 'host-environment-access', 'filesystem-access', 'automatic-install', 'automatic-canon']) if (!contract.boundaries.refuses.includes(refusal)) throw new Error('candidate contract lost refusal: ' + refusal);
  const manifest = strictJson(get('sandbox.game.json').bytes, 'sandbox.game.json');
  if (manifest.network !== 'DISABLED' || manifest.installed !== false || manifest.authority !== 'NONE' || manifest.entry !== 'index.html') throw new Error('sandbox manifest authority expanded');
  const receipt = strictJson(get('candidate.receipt.json').bytes, 'candidate.receipt.json');
  if (Object.values(receipt.authority).some((value) => value !== false) || receipt.authorityCeiling !== 'NONE') throw new Error('candidate receipt claims authority');
  const gap = strictJson(get('installation-gap.json').bytes, 'installation-gap.json');
  if (gap.installAllowed !== false || gap.nextGate !== 'MIKE_INSTALLATION_DECISION') throw new Error('installation gap was removed');
  const config = strictJson(get('game.config.json').bytes, 'game.config.json');
  const gameShapes = {
    'axm.sandbox-grid-game-config/v1': { width: 16, height: 10, players: 1, candidateId: 'four-roots-run-native' },
    'axm.local-coop-action-game-config/v1': { width: 30, height: 17, players: 2, candidateId: 'twin-reactor-coop-native' }
  };
  if (!Object.prototype.hasOwnProperty.call(gameShapes, config.schema)) throw new Error('game config recipe or seat scope is unsupported');
  const shape = gameShapes[config.schema];
  if ((shape.players === 1 && !legacyFileSet) || (shape.players === 2 && !assetAwareFileSet)) throw new Error('candidate file set differs from the exact game recipe');
  if (!shape || !config.session || config.session.players !== shape.players || config.session.network !== 'DISABLED' || config.session.persistence !== 'SESSION_ONLY') throw new Error('game config recipe or seat scope is unsupported');
  if (declaredSeats !== undefined && declaredSeats !== shape.players) throw new Error('module bundle seat count differs from the exact game config');
  if (manifest.id !== shape.candidateId || contract.id !== shape.candidateId || receipt.candidate.id !== shape.candidateId) throw new Error('candidate identity differs across static records');
  if (shape.players === 2 && (!contract.provides.includes('axm.local-two-player-action-coop/v1') || !same(manifest.controls, ['p1-keyboard', 'p2-keyboard', 'visible-lifecycle-buttons']))) throw new Error('two-seat candidate lost its exact co-op contract');
  const project = strictJson(get('game-forge-project.json').bytes, 'game-forge-project.json');
  if (project.schema !== 'axm.game-forge-project/v1' || project.world.width !== shape.width || project.world.height !== shape.height || project.world.cells.length !== shape.width * shape.height) throw new Error('Game Forge project shape drifted');
  const allowedTerrain = new Set(['empty', 'ground', 'wall', 'water', 'spawn', 'goal', 'hazard', 'path']);
  if (!project.world.cells.every((cell) => cell && allowedTerrain.has(cell.terrain) && cell.height === 0)) throw new Error('Game Forge project terrain is unsupported');
  if (files.length > resources.maxFiles || files.some((file) => file.byteLength > resources.maxFileBytes) || files.reduce((sum, file) => sum + file.byteLength, 0) > resources.maxOutputBytes) throw new Error('static candidate exceeds declared resources');
  if (shape.players === 2) {
    const snapshot = strictJson(get('asset-capability-snapshot.json').bytes, 'asset-capability-snapshot.json');
    const plan = strictJson(get('prebuild-plan.json').bytes, 'prebuild-plan.json');
    const experience = strictJson(get('experience-flow-plan.json').bytes, 'experience-flow-plan.json');
    if (snapshot.schema !== 'axm.asset-factory-capability-snapshot/v1' || snapshot.truth.artifactBytesProduced !== false || snapshot.truth.providerCodeLoaded !== false) throw new Error('asset capability snapshot overclaims production or provider execution');
    if (plan.schema !== 'axm.game-prebuild-plan/v1' || !Array.isArray(plan.repairs) || plan.repairs.length < 1 || plan.repairs.some((repair) => repair.state !== 'APPLIED_BEFORE_BUILD') || plan.truth.assetArtifactsProduced !== false) throw new Error('asset-aware prebuild plan is absent or overclaims artifact production');
    if (config.prebuild.planDigest !== plan.planDigest || config.prebuild.snapshotDigest !== snapshot.snapshotDigest) throw new Error('game config lost exact asset-aware prebuild lineage');
    if (experience.schema !== 'axm.game-experience-flow-plan/v1' || experience.authority !== 'NONE' || experience.disclosure.mayHideTruth !== false || experience.truth.plannedBeforeCandidateSource !== true) throw new Error('game experience flow plan is absent, mutable, or overclaims authority');
    if (config.experience.planDigest !== experience.planDigest || project.experiencePlan.sha256 !== experience.planDigest || manifest.experienceFlowPlan !== 'experience-flow-plan.json') throw new Error('game config, project, or manifest lost exact experience-flow lineage');
  }
  return { verdict: 'PASS', requiredSeats: shape.players, checks: ['exact-file-set', 'byte-digests', 'script-parse-only', 'network-authority-denial', 'external-script-only', 'contract-authority-ceiling', 'installation-hold', 'exact-seat-contract', 'game-forge-project-shape', 'asset-prebuild-lineage', 'experience-flow-lineage', 'resource-ceilings'] };
}
function inspectDirectory(root, resources) {
  assertOrdinaryDirectory(root, 'iteration root');
  const entries = fs.readdirSync(root, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile() || entry.isSymbolicLink())) throw new Error('iteration contains a non-ordinary file');
  const files = entries.map((entry) => {
    const portable = Core.normalizePortablePath(entry.name);
    const bytes = fs.readFileSync(path.join(root, entry.name));
    return { path: portable, bytes, sha256: hashBytes(bytes), byteLength: bytes.length };
  }).sort((a, b) => compareText(a.path, b.path));
  const staticEvidence = validateStaticFiles(files, resources);
  const refs = files.map(({ path: filePath, sha256, byteLength }) => ({ path: filePath, sha256, byteLength }));
  return { files, refs, fileCount: files.length, sourceBytes: files.reduce((sum, file) => sum + file.byteLength, 0), iterationDigest: hashValue(refs), staticEvidence };
}
function writeFiles(root, files) {
  fs.mkdirSync(root, { recursive: false });
  for (const file of files) writeExclusive(path.join(root, file.path), file.bytes);
}
function iterationRef(sessionId, iterationId, iterationDigest) { return { id: sessionId + '-' + iterationId, schema: 'axm.sandbox-candidate-iteration/v1', sha256: iterationDigest }; }
function candidateRef(result) { return { id: result.packet.candidate.id, schema: result.packet.schema, sha256: result.packet.packetDigest }; }
function writeEvidence(evidenceRoot, name, value) { writeExclusive(path.join(evidenceRoot, name), jsonBytes(value)); }

function createSession(options) {
  exact(options, ['parentRoot', 'sessionId', 'request', 'generationResult'], 'createSession options');
  const request = Generator.normalizeRequest(options.request);
  const verification = Generator.verifyGeneration(options.generationResult, request);
  if (!verification.pass) throw new Error('generation result failed deterministic verification: ' + verification.errors.join('; '));
  const result = options.generationResult;
  if (!request.authorization.sandboxBuild || request.resources.maxCandidateProcesses !== 0) throw new Error('sandbox build is not authorized or grants candidate processes');
  const sessionId = safeId(options.sessionId, 'sessionId');
  const parentRoot = ensureParentRoot(options.parentRoot);
  const sessionRoot = path.resolve(parentRoot, sessionId);
  assertContained(parentRoot, sessionRoot, 'session root');
  if (fs.existsSync(sessionRoot)) throw new Error('sandbox session already exists');
  fs.mkdirSync(sessionRoot, { recursive: false });
  try {
    const roots = {};
    for (const [key, name] of Object.entries(ROOT_NAMES)) { roots[key] = path.join(sessionRoot, name); fs.mkdirSync(roots[key], { recursive: false }); }
    const realRoots = Object.values(roots).map((root) => fs.realpathSync.native(root).toLowerCase());
    if (new Set(realRoots).size !== 4) throw new Error('source/output/evidence/lesson roots are not disjoint');
    const decoded = decodeBundle(result.packet.moduleBundle, request.resources);
    validateStaticFiles(decoded.files, request.resources, decoded.requiredSeats);
    writeFiles(path.join(roots.source, 'packet'), decoded.files);
    const iterationId = 'iteration-000';
    const iterationRoot = path.join(roots.output, iterationId);
    writeFiles(iterationRoot, decoded.files);
    makeFilesReadonly(path.join(roots.source, 'packet'));
    makeFilesReadonly(iterationRoot);
    const inspected = inspectDirectory(iterationRoot, request.resources);
    const staticReceipt = {
      schema: 'axm.sandbox-static-evidence/v1', version: VERSION, status: 'TEST', sessionId, iterationRef: iterationRef(sessionId, iterationId, inspected.iterationDigest),
      fileRefs: inspected.refs, checks: inspected.staticEvidence.checks, verdict: 'PASS', candidateProcesses: 0, hostEnvironmentInheritedByCandidate: false,
      sourceRetainedInEvidence: false, stdoutRetained: false, stderrRetained: false, machinePathsRetained: false, authority: 'NONE'
    };
    writeEvidence(roots.evidence, iterationId + '.static.json', staticReceipt);
    const core = {
      schema: SESSION_SCHEMA, version: VERSION, status: 'TEST', sessionId, candidateRef: candidateRef(result),
      requestRef: { id: request.id, schema: request.schema, sha256: request.requestDigest }, authorizationRef: clone(request.authorization.decisionRef), roots: clone(ROOT_NAMES),
      iteration: { id: iterationId, number: 0, digest: inspected.iterationDigest, fileCount: inspected.fileCount, sourceBytes: inspected.sourceBytes, staticVerdict: 'PASS' },
      resources: { candidateProcesses: 0, networkDomains: [], fileCountEnforced: true, fileBytesEnforced: true, totalBytesEnforced: true, iterationCeilingEnforced: true },
      truth: { sourceOutputEvidenceDisjoint: true, sourceImmutable: true, candidateCodeExecuted: false, previewStarted: false, runtimeBehaviorProven: false, visualBehaviorProven: false, playJourneyProven: false, installed: false, integrated: false, lessonActive: false, canonChanged: false }, authority: 'NONE'
    };
    const receipt = { ...core, sessionDigest: hashValue(core) };
    writeEvidence(roots.evidence, 'session.receipt.json', receipt);
    return { sessionId, parentRoot, sessionRoot, roots, request, generationResult: clone(result), currentIteration: clone(receipt.iteration), receipt };
  } catch (error) {
    if (fs.existsSync(sessionRoot)) fs.rmSync(sessionRoot, { recursive: true, force: true });
    throw error;
  }
}

function resumeSession(options) {
  exact(options, ['parentRoot', 'sessionId', 'request', 'generationResult'], 'resumeSession options');
  const request = Generator.normalizeRequest(options.request);
  const verification = Generator.verifyGeneration(options.generationResult, request);
  if (!verification.pass) throw new Error('generation result failed deterministic verification: ' + verification.errors.join('; '));
  const parentRoot = ensureParentRoot(options.parentRoot);
  const sessionId = safeId(options.sessionId, 'sessionId');
  const sessionRoot = path.resolve(parentRoot, sessionId);
  assertContained(parentRoot, sessionRoot, 'session root');
  assertOrdinaryDirectory(sessionRoot, 'session root');
  const roots = Object.fromEntries(Object.entries(ROOT_NAMES).map(([key, name]) => [key, path.join(sessionRoot, name)]));
  const realRoots = Object.values(roots).map((root) => { assertOrdinaryDirectory(root, keyLabel(root)); return fs.realpathSync.native(root).toLowerCase(); });
  if (new Set(realRoots).size !== 4) throw new Error('source/output/evidence/lesson roots are not disjoint');
  const receiptPath = path.join(roots.evidence, 'session.receipt.json');
  if (!fs.existsSync(receiptPath)) throw new Error('session receipt is missing');
  const receipt = strictJson(fs.readFileSync(receiptPath), 'session.receipt.json');
  exact(receipt, ['schema', 'version', 'status', 'sessionId', 'candidateRef', 'requestRef', 'authorizationRef', 'roots', 'iteration', 'resources', 'truth', 'authority', 'sessionDigest'], 'session receipt');
  const { sessionDigest, ...core } = receipt;
  if (receipt.schema !== SESSION_SCHEMA || receipt.version !== VERSION || receipt.status !== 'TEST' || receipt.sessionId !== sessionId || receipt.authority !== 'NONE' || hashValue(core) !== sessionDigest) throw new Error('session receipt identity or digest drifted');
  if (!same(receipt.roots, ROOT_NAMES) || !same(receipt.candidateRef, candidateRef(options.generationResult)) || receipt.requestRef.sha256 !== request.requestDigest || receipt.authorizationRef.sha256 !== request.authorization.decisionRef.sha256) throw new Error('session receipt lineage drifted');
  const source = inspectDirectory(path.join(roots.source, 'packet'), request.resources);
  const generatedRefs = options.generationResult.packet.sourceFiles.slice().sort((a, b) => compareText(a.path, b.path));
  if (!same(source.refs, generatedRefs)) throw new Error('immutable source packet bytes drifted');
  const iterationIds = fs.readdirSync(roots.output, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && ITERATION.test(entry.name))
    .map((entry) => entry.name).sort(compareText);
  if (!iterationIds.length || iterationIds.length > request.resources.maxIterations || iterationIds[0] !== receipt.iteration.id) throw new Error('session iteration lineage is missing or exceeds its ceiling');
  const session = { sessionId, parentRoot, sessionRoot, roots, request, generationResult: clone(options.generationResult), currentIteration: clone(receipt.iteration), receipt };
  for (const iterationId of iterationIds) {
    const observed = readIteration(session, iterationId);
    const evidencePath = path.join(roots.evidence, iterationId + '.static.json');
    if (!fs.existsSync(evidencePath)) throw new Error('iteration static evidence is missing: ' + iterationId);
    const evidence = strictJson(fs.readFileSync(evidencePath), iterationId + '.static.json');
    if (evidence.verdict !== 'PASS' || evidence.iterationRef.sha256 !== observed.iterationDigest) throw new Error('iteration evidence lineage drifted: ' + iterationId);
    session.currentIteration = { id: iterationId, number: observed.number, digest: observed.iterationDigest, fileCount: observed.fileCount, sourceBytes: observed.sourceBytes, staticVerdict: 'PASS' };
  }
  return session;
}

function keyLabel(root) { return 'session root ' + path.basename(root); }

function readIteration(session, iterationId) {
  const match = typeof iterationId === 'string' && iterationId.match(ITERATION);
  if (!match) throw new Error('iteration id is invalid');
  const root = path.resolve(session.roots.output, iterationId);
  assertContained(session.roots.output, root, 'iteration root');
  if (!fs.existsSync(root)) throw new Error('iteration does not exist');
  return { root, number: Number(match[1]), ...inspectDirectory(root, session.request.resources) };
}
function repairPlan(session, findings, replacements) {
  if (!Array.isArray(findings) || !findings.length || findings.some((item) => typeof item !== 'string' || !FINDING.test(item))) throw new Error('repair findings must be typed codes');
  const base = readIteration(session, session.currentIteration.id);
  const baseMap = fileMap(base.files);
  const changes = Object.entries(replacements).map(([filePath, content]) => {
    const portable = Core.normalizePortablePath(filePath);
    if (!REPAIRABLE.has(portable)) throw new Error('repair path is not allowlisted: ' + portable);
    const existing = baseMap.get(Core.pathKey(portable));
    if (!existing) throw new Error('repair path is absent: ' + portable);
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
    return { path: portable, expectedSha256: existing.sha256, replacementEncoding: 'base64', replacementContent: bytes.toString('base64'), replacementSha256: hashBytes(bytes), byteLength: bytes.length };
  }).sort((a, b) => compareText(a.path, b.path));
  if (!changes.length) throw new Error('repair needs at least one replacement');
  const core = { schema: REPAIR_SCHEMA, sessionId: session.sessionId, baseIterationId: session.currentIteration.id, baseIterationDigest: base.iterationDigest, findings: Array.from(new Set(findings)).sort(compareText), changes, authority: 'NONE' };
  return { ...core, planDigest: hashValue(core) };
}
function normalizeRepairPlan(value) {
  exact(value, ['schema', 'sessionId', 'baseIterationId', 'baseIterationDigest', 'findings', 'changes', 'authority', 'planDigest'], 'repair plan');
  const { planDigest, ...core } = value;
  if (value.schema !== REPAIR_SCHEMA || value.authority !== 'NONE' || !ID.test(value.sessionId) || !ITERATION.test(value.baseIterationId) || !DIGEST.test(value.baseIterationDigest)) throw new Error('repair plan identity mismatch');
  if (!Array.isArray(value.findings) || value.findings.length < 1 || value.findings.length > 32 || value.findings.some((item) => !FINDING.test(item)) || !same(value.findings, Array.from(new Set(value.findings)).sort(compareText))) throw new Error('repair findings are malformed or non-canonical');
  if (!Array.isArray(value.changes) || value.changes.length < 1 || value.changes.length > 8) throw new Error('repair changes are malformed');
  const seen = new Set();
  for (const change of value.changes) {
    exact(change, ['path', 'expectedSha256', 'replacementEncoding', 'replacementContent', 'replacementSha256', 'byteLength'], 'repair change');
    const portable = Core.normalizePortablePath(change.path);
    if (!REPAIRABLE.has(portable) || seen.has(Core.pathKey(portable))) throw new Error('repair path is not unique and allowlisted');
    seen.add(Core.pathKey(portable));
    if (change.replacementEncoding !== 'base64' || !DIGEST.test(change.expectedSha256) || !DIGEST.test(change.replacementSha256) || typeof change.replacementContent !== 'string') throw new Error('repair change encoding or digest is invalid');
    const bytes = Buffer.from(change.replacementContent, 'base64');
    if (bytes.toString('base64') !== change.replacementContent || bytes.length !== change.byteLength || hashBytes(bytes) !== change.replacementSha256) throw new Error('repair replacement bytes do not match their lineage');
  }
  if (!same(value.changes.map((item) => item.path), value.changes.map((item) => item.path).slice().sort(compareText))) throw new Error('repair changes are not canonical');
  if (hashValue(core) !== planDigest) throw new Error('repair plan digest mismatch');
  return clone(value);
}
function deriveLesson(session, plan, base, result) {
  const id = session.sessionId + '-lesson-' + String(result.number).padStart(3, '0');
  const core = {
    schema: LESSON_SCHEMA, version: VERSION, status: 'EXPERIMENTAL', id, candidateRef: candidateRef(session.generationResult),
    baseIterationRef: iterationRef(session.sessionId, plan.baseIterationId, base.iterationDigest), resultIterationRef: iterationRef(session.sessionId, result.id, result.iterationDigest),
    findingTypes: plan.findings.slice(), changedPaths: plan.changes.map((item) => item.path),
    privacy: { rawSourceRetained: false, promptRetained: false, stdoutRetained: false, stderrRetained: false, privateContentRetained: false, machinePathsRetained: false },
    admission: { active: false, installed: false, requiresNewLibraryVersion: true, nextGate: 'TIER_3_HUMAN_LIBRARY_ADMISSION' },
    truth: { generalizationProven: false, heldOutRegressionPassed: false }, authority: 'NONE'
  };
  return { ...core, lessonDigest: hashValue(core) };
}
function applyRepair(session, proposedPlan) {
  const plan = normalizeRepairPlan(proposedPlan);
  if (!session.request.authorization.sandboxRepair || !session.request.authorization.lessonCandidate) throw new Error('repair or lesson candidate is not authorized');
  if (plan.sessionId !== session.sessionId || plan.baseIterationId !== session.currentIteration.id || plan.baseIterationDigest !== session.currentIteration.digest) throw new Error('repair plan is stale or bound to different bytes');
  const base = readIteration(session, plan.baseIterationId);
  if (base.iterationDigest !== plan.baseIterationDigest) throw new Error('base iteration digest drifted on disk');
  const nextNumber = base.number + 1;
  if (nextNumber >= session.request.resources.maxIterations) throw new Error('repair iteration ceiling reached');
  const nextId = 'iteration-' + String(nextNumber).padStart(3, '0');
  const tempRoot = path.join(session.roots.output, '.' + nextId + '.tmp');
  const nextRoot = path.join(session.roots.output, nextId);
  if (fs.existsSync(tempRoot) || fs.existsSync(nextRoot)) throw new Error('repair destination already exists');
  fs.mkdirSync(tempRoot, { recursive: false });
  try {
    for (const file of base.files) writeExclusive(path.join(tempRoot, file.path), file.bytes);
    makeFilesWritable(tempRoot);
    const baseMap = fileMap(base.files);
    for (const change of plan.changes) {
      const current = baseMap.get(Core.pathKey(change.path));
      if (!current || current.sha256 !== change.expectedSha256) throw new Error('repair expected-byte lineage drifted: ' + change.path);
      const replacement = Buffer.from(change.replacementContent, 'base64');
      if (replacement.length > session.request.resources.maxFileBytes) throw new Error('repair file byte ceiling exceeded');
      fs.writeFileSync(path.join(tempRoot, change.path), replacement, { flag: 'w' });
    }
    const inspected = inspectDirectory(tempRoot, session.request.resources);
    makeFilesReadonly(tempRoot);
    fs.renameSync(tempRoot, nextRoot);
    const iteration = { id: nextId, number: nextNumber, digest: inspected.iterationDigest, fileCount: inspected.fileCount, sourceBytes: inspected.sourceBytes, staticVerdict: 'PASS' };
    const staticReceipt = {
      schema: 'axm.sandbox-static-evidence/v1', version: VERSION, status: 'TEST', sessionId: session.sessionId, iterationRef: iterationRef(session.sessionId, nextId, inspected.iterationDigest),
      baseIterationRef: iterationRef(session.sessionId, plan.baseIterationId, base.iterationDigest), repairPlanRef: { id: session.sessionId + '-repair-' + String(nextNumber).padStart(3, '0'), schema: REPAIR_SCHEMA, sha256: plan.planDigest },
      fileRefs: inspected.refs, checks: inspected.staticEvidence.checks, verdict: 'PASS', candidateProcesses: 0, hostEnvironmentInheritedByCandidate: false,
      sourceRetainedInEvidence: false, stdoutRetained: false, stderrRetained: false, machinePathsRetained: false, authority: 'NONE'
    };
    writeEvidence(session.roots.evidence, nextId + '.static.json', staticReceipt);
    const lesson = deriveLesson(session, plan, base, { ...iteration, iterationDigest: inspected.iterationDigest });
    writeExclusive(path.join(session.roots.lessons, lesson.id + '.json'), jsonBytes(lesson));
    session.currentIteration = iteration;
    return { iteration: clone(iteration), staticEvidence: staticReceipt, lesson };
  } catch (error) {
    if (fs.existsSync(tempRoot)) { makeFilesWritable(tempRoot); fs.rmSync(tempRoot, { recursive: true, force: true }); }
    throw error;
  }
}

function contentType(filePath) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8' })[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}
function send(response, status, headers, body, headOnly) { response.writeHead(status, headers); response.end(headOnly ? undefined : body); }
function reviewShell(session, iteration) {
  const title = 'AXM Detached Game Candidate Review';
  return Buffer.from('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title><style>body{margin:0;background:#02050a;color:#f5f8ff;font:16px system-ui}header{padding:12px 18px;border-bottom:1px solid #31465f;background:#0a1421}strong{color:#ffcf5a}iframe{display:block;width:100%;height:calc(100vh - 74px);border:0;background:white}</style></head><body><header><strong>TEST / detached / not installed</strong> · ' + session.sessionId + ' · ' + iteration.id + '</header><iframe title="Detached game candidate" sandbox="allow-scripts" src="/candidate/index.html"></iframe></body></html>\n', 'utf8');
}
async function startPreview(session, requestedIterationId, requestedPort = 0) {
  if (!session.request.authorization.sandboxPreview) throw new Error('sandbox preview is not authorized');
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) throw new Error('preview port must be an integer from 0 through 65535');
  const iteration = readIteration(session, requestedIterationId || session.currentIteration.id);
  const root = iteration.root;
  const server = http.createServer((request, response) => {
    const headOnly = request.method === 'HEAD';
    if (request.method !== 'GET' && !headOnly) return send(response, 405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' }, Buffer.from('method denied\n'), false);
    let pathname;
    try { pathname = new URL(request.url, 'http://127.0.0.1').pathname; } catch { return send(response, 400, { 'Cache-Control': 'no-store' }, Buffer.from('bad request\n'), headOnly); }
    if (pathname === '/health') return send(response, 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, jsonBytes({ status: 'TEST', candidateProcesses: 0, installed: false }), headOnly);
    if (pathname === '/meta') return send(response, 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, jsonBytes({ schema: 'axm.sandbox-preview-meta/v1', sessionId: session.sessionId, iteration: iterationRef(session.sessionId, requestedIterationId || session.currentIteration.id, iteration.iterationDigest), candidateProcesses: 0, authority: 'NONE' }), headOnly);
    if (pathname === '/') return send(response, 200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': REVIEW_CSP, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }, reviewShell(session, { id: requestedIterationId || session.currentIteration.id }), headOnly);
    if (!pathname.startsWith('/candidate/')) return send(response, 404, { 'Cache-Control': 'no-store' }, Buffer.from('not found\n'), headOnly);
    let relative;
    try { relative = decodeURIComponent(pathname.slice('/candidate/'.length)); } catch { return send(response, 400, { 'Cache-Control': 'no-store' }, Buffer.from('bad path\n'), headOnly); }
    try { relative = Core.normalizePortablePath(relative); } catch { return send(response, 404, { 'Cache-Control': 'no-store' }, Buffer.from('not found\n'), headOnly); }
    if (relative.includes('/')) return send(response, 404, { 'Cache-Control': 'no-store' }, Buffer.from('not found\n'), headOnly);
    const target = path.resolve(root, relative);
    try { assertContained(root, target, 'preview file'); } catch { return send(response, 404, { 'Cache-Control': 'no-store' }, Buffer.from('not found\n'), headOnly); }
    if (!fs.existsSync(target) || !fs.lstatSync(target).isFile() || fs.lstatSync(target).isSymbolicLink()) return send(response, 404, { 'Cache-Control': 'no-store' }, Buffer.from('not found\n'), headOnly);
    return send(response, 200, { 'Content-Type': contentType(target), 'Content-Security-Policy': CANDIDATE_CSP, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }, fs.readFileSync(target), headOnly);
  });
  server.maxHeadersCount = 48;
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(requestedPort, '127.0.0.1', resolve); });
  const address = server.address();
  return { url: 'http://127.0.0.1:' + address.port + '/', iteration: { id: requestedIterationId || session.currentIteration.id, digest: iteration.iterationDigest }, candidateProcesses: 0, close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) };
}

module.exports = { VERSION, SESSION_SCHEMA, REPAIR_SCHEMA, LESSON_SCHEMA, ROOT_NAMES, REPAIRABLE, SANDBOX_STATE_ROOT, CANDIDATE_CSP, REVIEW_CSP, clone, hashBytes, hashValue, decodeBundle, validateStaticFiles, inspectDirectory, createSession, resumeSession, readIteration, repairPlan, normalizeRepairPlan, applyRepair, startPreview };
