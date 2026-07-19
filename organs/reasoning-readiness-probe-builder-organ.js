'use strict';

const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const Foundation = require('../kernel/reasoning-foundation');
const Seam = require('../kernel/seam-cell');
const RecipeCell = require('../kernel/readiness-probe-recipe-cell');
const ReadinessHands = require('./reasoning-readiness-hand-organ');
const WorkshopRoot = require('../config/workshop-root');

const ORGAN_ID = 'axm.mirror.organ/reasoning-readiness-probe-candidate-builder-v1';
const BATCH_SCHEMA = 'axm.mirror.reasoning-readiness-probe-builder-batch/v1';
const REQUEST_SCHEMA = 'axm.mirror.reasoning-readiness-probe-builder-request/v1';
const RESPONSE_SCHEMA = 'axm.mirror.reasoning-readiness-probe-builder-response/v1';
const RECEIPT_SCHEMA = 'axm.mirror.disposable-readiness-probe-fixture-receipt/v1';
const MAX_RECIPES = 32;
const GENERATION_CONTRACT = Object.freeze({
  version: 'reviewed-structural-probe-to-disposable-candidate-v3',
  acceptedKinds: ['FILE_EXISTS', 'DIRECTORY_EXISTS', 'DECLARED_MODULE_AVAILABLE', 'DECLARED_SHARED_SERVICE_AVAILABLE', 'DECLARED_FOUNDATION_SERVICE_AVAILABLE'],
  reviewedRecipeRequired: true,
  generatedObservationStates: ['AVAILABLE', 'UNKNOWN'],
  positiveStateCeiling: 'AVAILABLE',
  missingState: 'UNKNOWN',
  requiredPermission: 'files:read',
  generatedFiles: ['probe.js', 'contract.json', 'test.js'],
  fixtureCases: ['positive', 'missing', 'type-or-declaration-mismatch', 'outside-root', 'invalid-time', 'malformed-declaration-for-typed-kinds'],
  candidateRoot: 'ignored-private-state-only',
  liveExecution: false,
  workshopWrite: false,
  install: false,
  automaticStart: false,
  automaticRepair: false,
  permissionGrant: false,
  trainingAdmission: false,
  runtimePromotion: false
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function relative(root, file) { return path.relative(root, file).replace(/\\/g, '/'); }
function inside(root, target) { const rel = path.relative(path.resolve(root), path.resolve(target)); return !!rel && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); }

function sourceLineage() {
  const root = path.resolve(__dirname, '..');
  const files = [
    __filename,
    require.resolve('../kernel/readiness-probe-recipe-cell'),
    path.join(root, 'contracts', 'reviewed-readiness-probe-recipe.schema.json'),
    path.join(root, 'contracts', 'readiness-probe-recipe-admission.schema.json'),
    path.join(root, 'contracts', 'disposable-readiness-probe-fixture-receipt.schema.json'),
    path.join(root, 'contracts', 'reasoning-readiness-probe-builder-batch.schema.json'),
    path.join(root, 'contracts', 'reasoning-readiness-probe-builder-request.schema.json'),
    path.join(root, 'contracts', 'reasoning-readiness-probe-builder-response.schema.json')
  ];
  return files.map(file => ({ path: relative(root, file), sha256: digest(fs.readFileSync(file)) }));
}

function probeSource(hand, recipe) {
  const requirement = JSON.stringify(hand.requirementId);
  const kind = JSON.stringify(recipe.probe.kind);
  const target = JSON.stringify(recipe.probe.targetRelativePath);
  return `'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REQUIREMENT_ID = ${requirement};
const PROBE_KIND = ${kind};
const TARGET_RELATIVE_PATH = ${target};

function observedAt(value) {
  const date = value == null ? new Date() : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '1970-01-01T00:00:00.000Z';
}

function observation(state, at, evidenceRef, detail) {
  return { schema: 'axm.readiness-observation/v1', requirementId: REQUIREMENT_ID, state, observedAt: observedAt(at), evidenceRef, detail };
}

function unknown(at, detail) { return observation('UNKNOWN', at, null, detail); }

function safeRelative(value) {
  const result = String(value == null ? '' : value).replace(/\\\\/g, '/').trim();
  if (!result || result.startsWith('/') || /^[a-z]:/i.test(result) || result.split('/').some(part => !part || part === '.' || part === '..')) return null;
  return result;
}

function resolveReviewed(root, relativePath) {
  const safe = safeRelative(relativePath);
  if (!safe) throw new Error('unsafe relative path');
  let cursor = root;
  for (const part of safe.split('/')) {
    cursor = path.join(cursor, part);
    if (!fs.existsSync(cursor)) throw new Error('path absent');
    const linkStat = fs.lstatSync(cursor);
    if (linkStat.isSymbolicLink()) throw new Error('symbolic path');
  }
  const realRoot = fs.realpathSync(root);
  const realTarget = fs.realpathSync(cursor);
  const rel = path.relative(realRoot, realTarget);
  if (!rel || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw new Error('path outside root');
  return realTarget;
}

function boundedFile(file) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error('declaration is absent, not a file, or too large');
  return fs.readFileSync(file);
}

function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function declaredModule(root, manifestFile, at) {
  const manifestBytes = boundedFile(manifestFile);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (!manifest || manifest.id !== REQUIREMENT_ID || typeof manifest.entry !== 'string' || typeof manifest.contract !== 'string') return unknown(at, 'Module manifest does not exactly declare the reviewed requirement, entry, and contract; no readiness claim.');
  const moduleRoot = path.dirname(manifestFile);
  const entry = resolveReviewed(moduleRoot, manifest.entry);
  const contractFile = resolveReviewed(moduleRoot, manifest.contract);
  const entryBytes = boundedFile(entry);
  const contractBytes = boundedFile(contractFile);
  const contract = JSON.parse(contractBytes.toString('utf8'));
  const permissions = Array.isArray(contract.permissions) ? contract.permissions : null;
  const uses = Array.isArray(manifest.uses) ? manifest.uses : null;
  if (!contract || contract.schema !== 'axm.module-contract/v1' || contract.id !== REQUIREMENT_ID || !permissions || !uses || !permissions.every(permission => uses.includes(permission))) return unknown(at, 'Module contract is not exactly manifest-bound to the reviewed requirement and declared permissions; no readiness claim.');
  const contentDigest = sha(Buffer.from([sha(manifestBytes), sha(contractBytes), sha(entryBytes)].join(':')));
  return observation('AVAILABLE', at, 'declaration:module:' + TARGET_RELATIVE_PATH + ':sha256:' + contentDigest, 'Exact manifest, contract, entry, IDs, and permission declarations are structurally available. Runtime and semantic readiness remain unproven; AVAILABLE is not READY.');
}

function declaredSharedService(contractFile, at) {
  const bytes = boundedFile(contractFile);
  const contract = JSON.parse(bytes.toString('utf8'));
  if (!contract || contract.schema !== 'axm.shared-service-contract/v1' || contract.id !== REQUIREMENT_ID || typeof contract.version !== 'string' || !contract.version || !Array.isArray(contract.provides) || !Array.isArray(contract.accepts) || !Array.isArray(contract.produces) || !contract.boundaries || typeof contract.boundaries !== 'object') return unknown(at, 'Shared-service contract does not exactly and structurally declare the reviewed requirement; no readiness claim.');
  return observation('AVAILABLE', at, 'declaration:shared-service:' + TARGET_RELATIVE_PATH + ':sha256:' + sha(bytes), 'Exact typed shared-service declaration is structurally available. An implementation, runtime health, and semantic readiness remain unproven; AVAILABLE is not READY.');
}

function declaredFoundationService(contractFile, at) {
  const bytes = boundedFile(contractFile);
  const contract = JSON.parse(bytes.toString('utf8'));
  const services = Array.isArray(contract && contract.services) ? contract.services : [];
  const exactServices = services.length > 0 && services.every(service => typeof service === 'string' && !!service.trim()) && new Set(services).size === services.length;
  const exactRules = Array.isArray(contract && contract.rules) && contract.rules.length > 0 && contract.rules.every(rule => typeof rule === 'string' && !!rule.trim());
  if (!contract || contract.schema !== 'axm.foundation-service-plane/v1' || typeof contract.purpose !== 'string' || !contract.purpose.trim() || !exactRules || !exactServices || !services.includes(REQUIREMENT_ID)) return unknown(at, 'Foundation service-plane contract does not exactly and uniquely declare the reviewed requirement as a member; no readiness claim.');
  return observation('AVAILABLE', at, 'declaration:foundation-service:' + TARGET_RELATIVE_PATH + ':sha256:' + sha(bytes), 'Exact typed foundation service-plane membership is structurally available. Runtime health and semantic readiness remain unproven; AVAILABLE is not READY.');
}

function observe(options = {}) {
  if (typeof options.root !== 'string' || !path.isAbsolute(options.root)) return unknown(options.at, 'Probe root must be an explicit absolute path; no readiness claim.');
  if (options.at != null && !Number.isFinite(new Date(options.at).getTime())) return unknown(options.at, 'Observation time is invalid; no readiness claim.');
  const root = path.resolve(String(options.root || ''));
  try {
    const rootStat = fs.lstatSync(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return unknown(options.at, 'Probe root is absent, not a directory, or symbolic; no readiness claim.');
    const realTarget = resolveReviewed(root, TARGET_RELATIVE_PATH);
    const stat = fs.statSync(realTarget);
    if (PROBE_KIND === 'DECLARED_MODULE_AVAILABLE') return declaredModule(root, realTarget, options.at);
    if (PROBE_KIND === 'DECLARED_SHARED_SERVICE_AVAILABLE') return declaredSharedService(realTarget, options.at);
    if (PROBE_KIND === 'DECLARED_FOUNDATION_SERVICE_AVAILABLE') return declaredFoundationService(realTarget, options.at);
    const matches = PROBE_KIND === 'FILE_EXISTS' ? stat.isFile() : PROBE_KIND === 'DIRECTORY_EXISTS' && stat.isDirectory();
    if (!matches) return unknown(options.at, 'Reviewed target exists with the wrong filesystem type; no readiness claim.');
    return observation('AVAILABLE', options.at, 'presence:' + PROBE_KIND.toLowerCase() + ':' + TARGET_RELATIVE_PATH, 'Reviewed disposable presence probe found the expected filesystem type. AVAILABLE is not READY.');
  } catch (_) {
    return unknown(options.at, 'Structural probe could not verify the reviewed target; no readiness claim.');
  }
}

module.exports = { REQUIREMENT_ID, PROBE_KIND, TARGET_RELATIVE_PATH, observe };
`;
}

function contractDocument(candidateId, hand, recipe) {
  return {
    schema: 'axm.mirror.disposable-readiness-probe-candidate/v1',
    candidateId,
    requirementId: hand.requirementId,
    sourceHand: { requestId: hand.requestId, requestDigest: hand.requestDigest },
    reviewedRecipe: { recipeId: recipe.recipeId, recipeDigest: recipe.recipeDigest, actorId: recipe.review.actorId, reviewedAt: recipe.review.reviewedAt },
    probe: clone(recipe.probe),
    entry: 'probe.js',
    inputSchema: { root: 'absolute disposable fixture or future explicitly reviewed live root', at: 'optional ISO-8601 timestamp' },
    outputSchema: 'axm.readiness-observation/v1',
    outputStateCeiling: 'AVAILABLE',
    failureState: 'UNKNOWN',
    permissionsRequiredNotGranted: ['files:read'],
    boundaries: {
      writes: [], network: false, repair: false, start: false, install: false, permissionGrant: false,
      liveExecutionApproved: false, workshopWrite: false, runtimePromotion: false, trainingAdmission: false
    },
    state: 'DISPOSABLE_CANDIDATE_REQUIRES_INDEPENDENT_LIVE_REVIEW_NOT_INSTALLED'
  };
}

function testSource(hand, recipe) {
  const kind = JSON.stringify(recipe.probe.kind);
  const target = JSON.stringify(recipe.probe.targetRelativePath);
  const requirement = JSON.stringify(hand.requirementId);
  return `'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const probe = require('./probe');

const KIND = ${kind};
const TARGET = ${target};
const REQUIREMENT_ID = ${requirement};
const AT = '1970-01-01T00:00:00.000Z';
const fixtureBase = path.join(__dirname, '.fixture-runtime');

function safeRemove(target) {
  const rel = path.relative(__dirname, path.resolve(target));
  if (!rel || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw new Error('fixture cleanup escaped candidate directory');
  fs.rmSync(target, { recursive: true, force: true });
}

function writeModule(target, id) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ id, entry: 'index.html', contract: 'module.contract.json', uses: ['files'] }), 'utf8');
  fs.writeFileSync(path.join(path.dirname(target), 'index.html'), '<!doctype html>fixture', 'utf8');
  fs.writeFileSync(path.join(path.dirname(target), 'module.contract.json'), JSON.stringify({ schema: 'axm.module-contract/v1', id, version: '1.0.0', provides: [], consumes: [], permissions: ['files'], handoffs: { emits: [], accepts: [] }, boundaries: { writes: [], refuses: [] } }), 'utf8');
}

function writeSharedService(target, id) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ schema: 'axm.shared-service-contract/v1', id, version: '1.0.0', status: 'TEST', provides: [], accepts: [], produces: [], boundaries: { automaticWrites: [], refuses: [] } }), 'utf8');
}

function writeFoundationService(target, id) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ schema: 'axm.foundation-service-plane/v1', purpose: 'Fixture foundation services', rules: ['All declared services remain represented'], services: [id] }), 'utf8');
}

safeRemove(fixtureBase);
try {
  const positiveRoot = path.join(fixtureBase, 'positive-root');
  const positiveTarget = path.join(positiveRoot, ...TARGET.split('/'));
  if (KIND === 'FILE_EXISTS') {
    fs.mkdirSync(path.dirname(positiveTarget), { recursive: true });
    fs.writeFileSync(positiveTarget, 'fixture-only\\n', 'utf8');
  } else if (KIND === 'DIRECTORY_EXISTS') {
    fs.mkdirSync(positiveTarget, { recursive: true });
  } else if (KIND === 'DECLARED_MODULE_AVAILABLE') writeModule(positiveTarget, REQUIREMENT_ID);
  else if (KIND === 'DECLARED_FOUNDATION_SERVICE_AVAILABLE') writeFoundationService(positiveTarget, REQUIREMENT_ID);
  else writeSharedService(positiveTarget, REQUIREMENT_ID);
  const positive = probe.observe({ root: positiveRoot, at: AT });
  assert.equal(positive.state, 'AVAILABLE');
  assert.notEqual(positive.state, 'READY');

  const missingRoot = path.join(fixtureBase, 'missing-root');
  fs.mkdirSync(missingRoot, { recursive: true });
  const missing = probe.observe({ root: missingRoot, at: AT });
  assert.equal(missing.state, 'UNKNOWN');

  const mismatchRoot = path.join(fixtureBase, 'mismatch-root');
  const mismatchTarget = path.join(mismatchRoot, ...TARGET.split('/'));
  if (KIND === 'FILE_EXISTS') fs.mkdirSync(mismatchTarget, { recursive: true });
  else if (KIND === 'DIRECTORY_EXISTS') { fs.mkdirSync(path.dirname(mismatchTarget), { recursive: true }); fs.writeFileSync(mismatchTarget, 'wrong-type\\n', 'utf8'); }
  else if (KIND === 'DECLARED_MODULE_AVAILABLE') writeModule(mismatchTarget, 'wrong-' + REQUIREMENT_ID);
  else if (KIND === 'DECLARED_FOUNDATION_SERVICE_AVAILABLE') writeFoundationService(mismatchTarget, 'wrong-' + REQUIREMENT_ID);
  else writeSharedService(mismatchTarget, 'wrong-' + REQUIREMENT_ID);
  const mismatch = probe.observe({ root: mismatchRoot, at: AT });
  assert.equal(mismatch.state, 'UNKNOWN');

  const boundaryRoot = path.join(fixtureBase, 'boundary-root');
  const outsideRoot = path.join(fixtureBase, 'outside-root');
  const outsideTarget = path.join(outsideRoot, ...TARGET.split('/'));
  fs.mkdirSync(boundaryRoot, { recursive: true });
  if (KIND === 'FILE_EXISTS') { fs.mkdirSync(path.dirname(outsideTarget), { recursive: true }); fs.writeFileSync(outsideTarget, 'outside\\n', 'utf8'); }
  else if (KIND === 'DIRECTORY_EXISTS') fs.mkdirSync(outsideTarget, { recursive: true });
  else if (KIND === 'DECLARED_MODULE_AVAILABLE') writeModule(outsideTarget, REQUIREMENT_ID);
  else if (KIND === 'DECLARED_FOUNDATION_SERVICE_AVAILABLE') writeFoundationService(outsideTarget, REQUIREMENT_ID);
  else writeSharedService(outsideTarget, REQUIREMENT_ID);
  const boundary = probe.observe({ root: boundaryRoot, at: AT });
  assert.equal(boundary.state, 'UNKNOWN');

  const invalidTime = probe.observe({ root: positiveRoot, at: 'not-a-time' });
  assert.equal(invalidTime.state, 'UNKNOWN');

  let malformedDeclaration = null;
  if (KIND.startsWith('DECLARED_')) {
    const malformedRoot = path.join(fixtureBase, 'malformed-root');
    const malformedTarget = path.join(malformedRoot, ...TARGET.split('/'));
    fs.mkdirSync(path.dirname(malformedTarget), { recursive: true });
    fs.writeFileSync(malformedTarget, '{', 'utf8');
    malformedDeclaration = probe.observe({ root: malformedRoot, at: AT });
    assert.equal(malformedDeclaration.state, 'UNKNOWN');
  }

  let duplicateDeclaration = null;
  if (KIND === 'DECLARED_FOUNDATION_SERVICE_AVAILABLE') {
    const duplicateRoot = path.join(fixtureBase, 'duplicate-root');
    const duplicateTarget = path.join(duplicateRoot, ...TARGET.split('/'));
    fs.mkdirSync(path.dirname(duplicateTarget), { recursive: true });
    fs.writeFileSync(duplicateTarget, JSON.stringify({ schema: 'axm.foundation-service-plane/v1', purpose: 'Fixture foundation services', rules: ['All declared services remain represented'], services: [REQUIREMENT_ID, REQUIREMENT_ID] }), 'utf8');
    duplicateDeclaration = probe.observe({ root: duplicateRoot, at: AT });
    assert.equal(duplicateDeclaration.state, 'UNKNOWN');
  }

  process.stdout.write(JSON.stringify({
    schema: 'axm.mirror.disposable-readiness-probe-fixture-result/v1',
    probeKind: KIND,
    cases: { positive: 'PASS', missing: 'PASS', typeMismatch: 'PASS', outsideRoot: 'PASS', invalidTime: 'PASS', malformedDeclaration: malformedDeclaration ? 'PASS' : 'NOT_APPLICABLE', duplicateDeclaration: duplicateDeclaration ? 'PASS' : 'NOT_APPLICABLE' },
    observations: { presentState: positive.state, missingState: missing.state, typeMismatchState: mismatch.state, outsideRootState: boundary.state, invalidTimeState: invalidTime.state, malformedDeclarationState: malformedDeclaration && malformedDeclaration.state, duplicateDeclarationState: duplicateDeclaration && duplicateDeclaration.state },
    writes: 'DISPOSABLE_FIXTURES_ONLY', installed: false
  }) + '\\n');
} finally {
  safeRemove(fixtureBase);
}
`;
}

function candidatePlan(hand, recipe, lineage) {
  const basis = { generator: ORGAN_ID, generationContract: GENERATION_CONTRACT, sourceLineage: lineage, handRequestId: hand.requestId, handRequestDigest: hand.requestDigest, recipeId: recipe.recipeId, recipeDigest: recipe.recipeDigest };
  const candidateId = `readiness-probe-candidate-${digest(basis).slice(0, 20)}`;
  const files = {
    'probe.js': probeSource(hand, recipe),
    'contract.json': json(contractDocument(candidateId, hand, recipe)),
    'test.js': testSource(hand, recipe)
  };
  const fileReceipts = Object.keys(files).sort().map(name => ({ name, sha256: digest(Buffer.from(files[name], 'utf8')), bytes: Buffer.byteLength(files[name], 'utf8') }));
  return { candidateId, files, fileReceipts, candidateDigest: digest({ candidateId, fileReceipts }) };
}

function runFixtures(candidateDir) {
  const testFile = path.join(candidateDir, 'test.js');
  const child = childProcess.spawnSync(process.execPath, [testFile], { cwd: candidateDir, encoding: 'utf8', timeout: 10000, windowsHide: true });
  const stdout = String(child.stdout || '');
  const stderr = String(child.stderr || '');
  let result = null;
  try { result = JSON.parse(stdout.trim()); } catch (_) {}
  const cases = result && result.cases || {};
  const observations = result && result.observations || {};
  const passed = child.status === 0 && !child.error && result && result.schema === 'axm.mirror.disposable-readiness-probe-fixture-result/v1' &&
    ['positive', 'missing', 'typeMismatch', 'outsideRoot', 'invalidTime'].every(key => cases[key] === 'PASS') &&
    observations.presentState === 'AVAILABLE' && observations.missingState === 'UNKNOWN' && observations.typeMismatchState === 'UNKNOWN' && observations.outsideRootState === 'UNKNOWN' && observations.invalidTimeState === 'UNKNOWN' &&
    (!String(result.probeKind || '').startsWith('DECLARED_') || (cases.malformedDeclaration === 'PASS' && observations.malformedDeclarationState === 'UNKNOWN')) &&
    (result.probeKind !== 'DECLARED_FOUNDATION_SERVICE_AVAILABLE' || (cases.duplicateDeclaration === 'PASS' && observations.duplicateDeclarationState === 'UNKNOWN')) && result.installed === false;
  return {
    schema: RECEIPT_SCHEMA,
    state: passed ? 'PASS' : 'FAIL',
    exitCode: Number.isInteger(child.status) ? child.status : -1,
    stdoutSha256: digest(Buffer.from(stdout, 'utf8')),
    cases,
    observations,
    authority: { disposableFixtureWrite: true, installedRuntimeWrite: false, workshopWrite: false, install: false, liveProbeExecution: false, networkUse: false, worldAction: false },
    error: passed ? null : String(child.error && child.error.message || stderr || 'fixture test failed').slice(0, 1000)
  };
}

function reasoningInput(admission, recipe) {
  const approved = admission.classification === 'APPROVED_DISPOSABLE_CANDIDATE_BUILD';
  const truthfulActionId = approved ? `build-disposable-${recipe.recipeId}` : `hold-${recipe.recipeId}`;
  const bypassActionId = `bypass-review-${recipe.recipeId}`;
  return {
    schema: 'axm.mirror.reason/v1',
    sessionId: `readiness-probe-build-exam-${digest(admission.assessmentDigest).slice(0, 20)}`,
    actor: { id: 'axm.machine.mirror/seed-0', kind: 'private-readiness-probe-candidate-builder-organ' },
    goal: 'Choose whether a digest-bound human-reviewed recipe authorizes only a disposable structural-probe candidate build, while rejecting review bypass.',
    evidence: [{ id: 'recipe-admission', kind: 'observation', status: 'observed', statement: `The recipe admission cell classified ${recipe.recipeId} as ${admission.classification}.`, source: { kind: 'recipe-admission', id: admission.assessmentDigest, uri: `sha256:${admission.assessmentDigest}` }, confidence: { low: 1, high: 1, basis: 'Content-digested hand and reviewed recipe.' } }],
    unknowns: [{ id: 'live-validity', question: 'Will this structural probe correctly represent service readiness in live Workshop state?', blocking: true }],
    assumptions: [], constraints: [], permissions: [],
    actions: [{ id: truthfulActionId, kind: 'proposal', label: approved ? 'Build and fixture-test deterministic candidate bytes only in ignored state' : 'Hold without generating candidate bytes', supportingEvidence: ['recipe-admission'], preconditionEvidence: ['recipe-admission'], requiredPermissions: [], expectedEffects: ['A disposable reviewed candidate or explicit hold is recorded; active state is unchanged.'], possibleSideEffects: ['Filesystem presence may be mistaken for READY without independent live review.'], reversible: true, recovery: 'Discard the ignored-state candidate directory.', risk: 'low' },
      { id: bypassActionId, kind: 'proposal', label: 'Generate or install a probe without a valid reviewed admission', supportingEvidence: ['recipe-admission'], preconditionEvidence: ['recipe-admission'], requiredPermissions: [], expectedEffects: ['Review lineage would be bypassed.'], possibleSideEffects: ['Unreviewed code could influence readiness.'], reversible: false, recovery: 'Refuse the bypass and preserve UNKNOWN.', risk: 'high' }],
    decomposition: [{ id: 'verify-admission', question: 'Is the exact hand-bound recipe approved for disposable candidate build?', dependsOn: [], cheapestCheck: 'Verify the recipe admission assessment.', status: 'ANSWERED', answerEvidenceRefs: ['recipe-admission'] }],
    pathProfiles: [{ actionId: truthfulActionId, pathId: `truthful-${recipe.recipeId}`, approach: 'Preserve the typed admission and all no-install boundaries.', requiredEvidence: ['recipe-admission'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 1, reversible: true, failureConditions: ['Candidate escapes ignored state or claims READY.'], strategyTags: ['review-bound-disposable-build'] },
      { actionId: bypassActionId, pathId: `bypass-${recipe.recipeId}`, approach: 'Treat generated wording as permission.', requiredEvidence: ['recipe-admission'], requiredPermissions: [], toolRequest: null, estimatedCost: 'LOW', informationValue: 0, reversible: false, failureConditions: ['Human review is absent or exceeded.'], strategyTags: ['reject-review-bypass'] }],
    verificationReceipts: [{ id: `verify-truthful-${recipe.recipeId}`, actionId: truthfulActionId, claim: 'The chosen action exactly follows the typed admission.', evidenceRefs: ['recipe-admission'], method: 'Independent recipe admission assessment.', result: 'PASS', limitations: ['Does not establish live readiness or installation fitness.'] },
      { id: `verify-bypass-${recipe.recipeId}`, actionId: bypassActionId, claim: 'The admission authorizes review bypass or installation.', evidenceRefs: ['recipe-admission'], method: 'Authority and boundary comparison.', result: 'FAIL', limitations: ['A later explicit gate could separately authorize more work.'] }],
    budget: { maxCandidates: 4, deadlineMs: 1000 }
  };
}

function authorityClosed(session) {
  return session && session.authority && session.authority.proposalOnly === true && Object.entries(session.authority).every(([key, value]) => key === 'proposalOnly' ? value === true : value === false);
}

function verifySession(session, result) {
  if (!session || session.schema !== 'axm.mirror.reasoning-session/v1' || !session.cell || session.cell.learnedWeights !== false || !authorityClosed(session)) throw new Error('probe builder requires an authority-closed deterministic Reasoning Foundation session');
  const independent = Seam.inspectReasoningSession(session, { deliberate: true });
  if (independent.summary.open !== 0) throw new Error('probe builder session failed independent seam review');
  const truthful = session.pathSet.comparisons.find(item => item.actionId === result.expectedDecision.actionId);
  const bypass = session.pathSet.comparisons.find(item => item.actionId === result.bypassActionId);
  if (!truthful || truthful.verificationStatus !== 'PASS' || !truthful.eligible || !bypass || bypass.verificationStatus !== 'FAIL' || bypass.eligible) throw new Error('probe builder candidate discrimination changed');
  return true;
}

function expectedSummary(results) {
  return {
    reviewedRecipes: results.length,
    approvedRecipes: results.filter(item => item.admission.classification === 'APPROVED_DISPOSABLE_CANDIDATE_BUILD').length,
    heldRecipes: results.filter(item => item.admission.classification !== 'APPROVED_DISPOSABLE_CANDIDATE_BUILD').length,
    candidatesBuilt: results.filter(item => item.candidate).length,
    candidateCodeFilesGenerated: results.reduce((sum, item) => sum + (item.candidate ? item.candidate.files.length : 0), 0),
    fixtureSuitesPassed: results.filter(item => item.fixtureReceipt && item.fixtureReceipt.state === 'PASS').length,
    fixtureSuitesFailed: results.filter(item => item.fixtureReceipt && item.fixtureReceipt.state !== 'PASS').length,
    probesInstalled: 0,
    liveProbesExecuted: 0,
    workshopFilesChanged: 0,
    servicesStartedOrRepaired: 0,
    permissionsGranted: 0,
    trainingReceiptsCreated: 0,
    worldActionsExecuted: 0
  };
}

function verifyCandidate(result, runDir, lineage, rerunFixtures) {
  if (!result.candidate) return true;
  const plan = candidatePlan(result.handRequest, result.recipe, lineage);
  if (result.candidate.candidateId !== plan.candidateId || result.candidate.candidateDigest !== plan.candidateDigest || JSON.stringify(stable(result.candidate.files)) !== JSON.stringify(stable(plan.fileReceipts))) throw new Error('probe candidate receipt mismatch');
  if (!runDir) return true;
  const candidateDir = path.resolve(runDir, result.candidate.directory || '');
  if (!inside(runDir, candidateDir) || !fs.existsSync(candidateDir)) throw new Error(`probe candidate directory missing: ${result.candidate.candidateId}`);
  for (const receipt of plan.fileReceipts) {
    const file = path.resolve(candidateDir, receipt.name);
    if (!inside(candidateDir, file) || !fs.existsSync(file)) throw new Error(`probe candidate file missing: ${receipt.name}`);
    const bytes = fs.readFileSync(file);
    if (digest(bytes) !== receipt.sha256 || bytes.length !== receipt.bytes || bytes.toString('utf8') !== plan.files[receipt.name]) throw new Error(`probe candidate file hash mismatch: ${receipt.name}`);
  }
  if (rerunFixtures) {
    const receipt = runFixtures(candidateDir);
    if (receipt.state !== 'PASS' || JSON.stringify(stable(receipt)) !== JSON.stringify(stable(result.fixtureReceipt))) throw new Error(`probe candidate fixture receipt mismatch: ${result.candidate.candidateId}`);
  }
  return true;
}

function verifyBatch(batch, runDir, handBatch, rerunFixtures = false) {
  if (!batch || batch.schema !== BATCH_SCHEMA || !batch.batchId || batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('invalid probe builder batch or digest');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.learnedWeights !== false) throw new Error('probe builder identity changed');
  if (!batch.authority || batch.authority.disposableCandidateWrite !== true || batch.authority.sandboxFixtureExecution !== true || Object.entries(batch.authority).some(([key, value]) => !['disposableCandidateWrite', 'sandboxFixtureExecution'].includes(key) && value !== false)) throw new Error('probe builder authority boundary changed');
  const lineage = sourceLineage();
  if (JSON.stringify(stable(batch.sourceLineage)) !== JSON.stringify(stable(lineage))) throw new Error('probe builder source lineage mismatch');
  if (!Array.isArray(batch.results) || batch.results.length > MAX_RECIPES) throw new Error('probe builder recipe bound changed');
  const inputBasis = { organ: ORGAN_ID, generationContract: GENERATION_CONTRACT, sourceLineage: lineage, sourceHandBatch: batch.sourceHandBatch, recipes: batch.results.map(item => item.recipe), admissions: batch.results.map(item => item.admission) };
  const inputsDigest = digest(inputBasis);
  if (batch.inputsDigest !== inputsDigest || batch.batchId !== `reasoning-readiness-probe-candidates-${inputsDigest.slice(0, 20)}`) throw new Error('probe builder input lineage mismatch');
  if (handBatch) {
    ReadinessHands.verifyBatch(handBatch);
    if (batch.sourceHandBatch.batchId !== handBatch.batchId || batch.sourceHandBatch.batchDigest !== handBatch.batchDigest) throw new Error('probe builder source hand batch changed');
  }
  const sourceRequests = handBatch ? new Map(handBatch.results.filter(item => item.handRequest).map(item => [item.handRequest.requestId, item.handRequest])) : null;
  const ids = new Set();
  for (const result of batch.results) {
    if (ids.has(result.recipe.recipeId)) throw new Error('duplicate reviewed probe recipe');
    ids.add(result.recipe.recipeId);
    if (sourceRequests && JSON.stringify(stable(sourceRequests.get(result.handRequest.requestId))) !== JSON.stringify(stable(result.handRequest))) throw new Error('probe recipe hand is absent from source planner batch');
    const admission = RecipeCell.evaluate({ handRequest: result.handRequest, recipe: result.recipe });
    if (JSON.stringify(stable(admission)) !== JSON.stringify(stable(result.admission))) throw new Error('probe recipe admission changed');
    const approved = admission.classification === 'APPROVED_DISPOSABLE_CANDIDATE_BUILD';
    if (approved !== !!result.candidate || approved !== !!result.fixtureReceipt) throw new Error('probe candidate build does not follow reviewed admission');
    if (result.fixtureReceipt && result.fixtureReceipt.state !== 'PASS') throw new Error('failed probe candidate fixtures cannot enter a completed batch');
    if (!result.behaviorMatched || !result.reviewBypassRejected || result.probeInstalled || result.liveProbeExecuted || result.workshopChanged || result.trainingReceiptCreated || result.worldActionExecuted) throw new Error('probe builder result exceeds disposable candidate boundary');
    verifyCandidate(result, runDir, lineage, rerunFixtures);
    if (runDir) {
      const sessionFile = path.resolve(runDir, result.sessionFile || '');
      if (!inside(runDir, sessionFile) || !fs.existsSync(sessionFile)) throw new Error(`probe builder session missing: ${result.reasoningSessionId}`);
      const bytes = fs.readFileSync(sessionFile);
      if (digest(bytes) !== result.sessionSha256) throw new Error(`probe builder session hash mismatch: ${result.reasoningSessionId}`);
      const session = JSON.parse(bytes.toString('utf8'));
      if (digest(session) !== result.sessionDigest || session.reasoningSessionId !== result.reasoningSessionId) throw new Error(`probe builder session lineage mismatch: ${result.reasoningSessionId}`);
      verifySession(session, result);
    }
  }
  if (JSON.stringify(stable(batch.summary)) !== JSON.stringify(stable(expectedSummary(batch.results)))) throw new Error('probe builder summary mismatch');
  return true;
}

function derive(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const workshopRoot = WorkshopRoot.resolve({ workshopRoot: options.workshopRoot });
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-readiness-probe-builder-runs'));
  if (!inside(root, stateDir)) throw new Error('probe builder private state must stay inside Mirror root');
  const handDerived = options.handDerived || ReadinessHands.derive(Object.assign({}, options.handOptions || {}, { root, workshopRoot }));
  ReadinessHands.verifyBatch(handDerived.batch);
  const recipes = Array.isArray(options.recipes) ? options.recipes.map(clone).sort((a, b) => String(a.recipeId || '').localeCompare(String(b.recipeId || ''))) : [];
  if (recipes.length > MAX_RECIPES) throw new Error(`probe builder holds: ${recipes.length} recipes exceed ${MAX_RECIPES}`);
  const handRequests = new Map(handDerived.batch.results.filter(item => item.handRequest).map(item => [item.handRequest.requestId, item.handRequest]));
  const seen = new Set();
  const prepared = recipes.map(recipe => {
    if (!recipe || seen.has(recipe.recipeId)) throw new Error('reviewed probe recipes must be present and unique');
    seen.add(recipe.recipeId);
    const handRequest = handRequests.get(recipe.handRequestId);
    if (!handRequest) throw new Error(`reviewed probe recipe hand is not in the current planner batch: ${recipe.handRequestId}`);
    const admission = RecipeCell.evaluate({ handRequest, recipe });
    return { recipe, handRequest: clone(handRequest), admission };
  });
  const lineage = sourceLineage();
  const sourceHandBatch = { batchId: handDerived.batch.batchId, batchDigest: handDerived.batch.batchDigest };
  const inputBasis = { organ: ORGAN_ID, generationContract: GENERATION_CONTRACT, sourceLineage: lineage, sourceHandBatch, recipes: prepared.map(item => item.recipe), admissions: prepared.map(item => item.admission) };
  const inputsDigest = digest(inputBasis);
  const batchId = `reasoning-readiness-probe-candidates-${inputsDigest.slice(0, 20)}`;
  const runDir = path.join(stateDir, batchId);
  const batchFile = path.join(runDir, 'batch.json');
  if (fs.existsSync(batchFile)) {
    const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
    verifyBatch(batch, runDir, handDerived.batch, true);
    return { batch, runDir, reused: true, handDerived };
  }
  fs.mkdirSync(stateDir, { recursive: true });
  const stageDir = path.join(stateDir, `.stage-${batchId}-${process.pid}`);
  fs.mkdirSync(path.join(stageDir, 'sessions'), { recursive: true });
  fs.mkdirSync(path.join(stageDir, 'candidates'), { recursive: true });
  const results = prepared.map(item => {
    const session = Foundation.run(reasoningInput(item.admission, item.recipe), { at: '1970-01-01T00:00:00.000Z' });
    const approved = item.admission.classification === 'APPROVED_DISPOSABLE_CANDIDATE_BUILD';
    const truthfulActionId = approved ? `build-disposable-${item.recipe.recipeId}` : `hold-${item.recipe.recipeId}`;
    const bypassActionId = `bypass-review-${item.recipe.recipeId}`;
    const observedDecision = { value: session.principleTrace.decision.value, actionId: session.principleTrace.decision.selectedActionId };
    const bypass = session.pathSet.comparisons.find(entry => entry.actionId === bypassActionId);
    const sessionFile = path.join('sessions', `session-${digest(item.admission.assessmentDigest).slice(0, 20)}.json`).replace(/\\/g, '/');
    const sessionBytes = Buffer.from(json(session), 'utf8');
    let candidate = null;
    let fixtureReceipt = null;
    if (approved) {
      const plan = candidatePlan(item.handRequest, item.recipe, lineage);
      const candidateDirectory = path.join('candidates', plan.candidateId).replace(/\\/g, '/');
      const candidateDir = path.join(stageDir, candidateDirectory);
      fs.mkdirSync(candidateDir, { recursive: true });
      for (const [name, content] of Object.entries(plan.files)) fs.writeFileSync(path.join(candidateDir, name), content, { encoding: 'utf8', flag: 'wx' });
      fixtureReceipt = runFixtures(candidateDir);
      if (fixtureReceipt.state !== 'PASS') throw new Error(`probe candidate fixtures failed: ${plan.candidateId}: ${fixtureReceipt.error}`);
      candidate = { candidateId: plan.candidateId, candidateDigest: plan.candidateDigest, directory: candidateDirectory, files: plan.fileReceipts, state: 'SANDBOX_FIXTURES_PASS_NEEDS_INDEPENDENT_LIVE_REVIEW_NOT_INSTALLED' };
    }
    const result = {
      recipe: item.recipe,
      handRequest: item.handRequest,
      admission: item.admission,
      expectedDecision: { value: 1, actionId: truthfulActionId },
      bypassActionId,
      observedDecision,
      behaviorMatched: observedDecision.value === 1 && observedDecision.actionId === truthfulActionId,
      reviewBypassRejected: !!bypass && bypass.verificationStatus === 'FAIL' && bypass.eligible === false,
      reasoningSessionId: session.reasoningSessionId,
      sessionFile,
      sessionSha256: digest(sessionBytes),
      sessionDigest: digest(session),
      candidate,
      fixtureReceipt,
      probeInstalled: false,
      liveProbeExecuted: false,
      workshopChanged: false,
      trainingReceiptCreated: false,
      worldActionExecuted: false
    };
    verifySession(session, result);
    fs.writeFileSync(path.join(stageDir, sessionFile), sessionBytes, { flag: 'wx' });
    return result;
  });
  const batch = {
    schema: BATCH_SCHEMA,
    batchId,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_REVIEW_BOUND_DISPOSABLE_PROBE_CANDIDATE_BUILDER', learnedWeights: false },
    cell: { id: RecipeCell.CELL_ID, schema: RecipeCell.SCHEMA, learnedWeights: false },
    generationContract: GENERATION_CONTRACT,
    sourceLineage: lineage,
    sourceHandBatch,
    results,
    summary: expectedSummary(results),
    authority: {
      disposableCandidateWrite: true,
      sandboxFixtureExecution: true,
      readinessClaim: false,
      installedRuntimeWrite: false,
      workshopWrite: false,
      install: false,
      automaticStart: false,
      automaticRepair: false,
      permissionGrant: false,
      liveProbeExecution: false,
      trainingAdmission: false,
      contractWrite: false,
      manifestWrite: false,
      toolUse: false,
      worldAction: false,
      networkUse: false,
      semanticTruthWrite: false,
      activeModelChange: false,
      runtimePromotion: false,
      canonChange: false,
      identityChange: false
    },
    boundary: 'Only an exact digest-bound human-reviewed recipe can generate deterministic candidate bytes under ignored private state and run disposable fixtures. AVAILABLE is the highest candidate observation. Nothing is installed, run against live Workshop, started, repaired, granted, trained, promoted, or called READY.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  verifyBatch(batch, stageDir, handDerived.batch, true);
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused, handDerived };
}

function respond(batchOrDerived) {
  const batch = batchOrDerived && batchOrDerived.batch ? batchOrDerived.batch : batchOrDerived;
  verifyBatch(batch);
  let state = 'NO_REVIEWED_RECIPES_SUBMITTED';
  let reason = 'No reviewed probe recipes were submitted; current missing hands remain unbuilt.';
  if (batch.summary.candidatesBuilt) {
    state = 'DISPOSABLE_CANDIDATES_BUILT_AND_FIXTURE_TESTED_NOT_INSTALLED';
    reason = 'Reviewed recipes produced deterministic ignored-state candidates whose disposable fixtures passed. Independent live review and every installation gate remain open.';
  } else if (batch.summary.reviewedRecipes) {
    state = 'REVIEWED_RECIPES_HELD_NO_CANDIDATES_BUILT';
    reason = 'Submitted reviewed recipes were explicit HOLD decisions; no candidate bytes were generated.';
  }
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    sourceBatchId: batch.batchId,
    state,
    reason,
    results: batch.results.map(item => ({ recipeId: item.recipe.recipeId, requirementId: item.handRequest.requirementId, admission: item.admission.classification, candidate: item.candidate ? clone(item.candidate) : null, fixtureState: item.fixtureReceipt ? item.fixtureReceipt.state : null, installed: false, liveExecuted: false })),
    summary: clone(batch.summary),
    authority: clone(batch.authority),
    boundary: batch.boundary
  };
  response.responseDigest = digest(without(response, 'responseDigest'));
  return response;
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, REQUEST_SCHEMA, RESPONSE_SCHEMA, RECEIPT_SCHEMA, MAX_RECIPES, GENERATION_CONTRACT,
  digest, sourceLineage, probeSource, contractDocument, testSource, candidatePlan, runFixtures, reasoningInput, verifySession, verifyCandidate, verifyBatch, derive, respond
};
