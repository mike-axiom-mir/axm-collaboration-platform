'use strict';

const fs = require('fs');
const path = require('path');
const Cell = require('../kernel/growth-step-declaration-cell');
const ImmutableStore = require('../kernel/immutable-batch-store');

const ROOT = path.resolve(__dirname, '..');
const ORGAN_ID = 'axm.mirror.organ/growth-step-declaration-audit-v1';
const AUDIT_SCHEMA = 'axm.mirror.growth-step-declaration-audit/v1';
const DEFAULT_DECLARATION_DIR = path.join(ROOT, 'capabilities', 'growth-steps');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'growth-step-declaration-audits');
const MAX_DECLARATIONS = 2048;
const MAX_FILE_BYTES = 1024 * 1024;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function same(left, right) { return JSON.stringify(Cell.stable(left)) === JSON.stringify(Cell.stable(right)); }
function relative(root, file) { return path.relative(root, file).replace(/\\/g, '/'); }
function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function authority() {
  return {
    readPublicDeclarations: true,
    privateAuditTraceWrite: true,
    executeSource: false,
    selectRoute: false,
    executeStep: false,
    writeSource: false,
    writeWorkshop: false,
    grantPermission: false,
    admitRuntime: false,
    promoteRuntime: false,
    changeCanon: false,
    changeIdentity: false,
    worldAction: false
  };
}
function boundedDirectory(root, candidate, label) {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(candidate);
  const rel = path.relative(absoluteRoot, absolute);
  if (!rel || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error(`${label} must stay inside Mirror root`);
  return absolute;
}

function collect(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const declarationDir = boundedDirectory(root, options.declarationDir || path.join(root, 'capabilities', 'growth-steps'), 'growth-step declaration root');
  if (!fs.existsSync(declarationDir)) return { root, declarationDir, files: [], records: [] };
  const rootStat = fs.lstatSync(declarationDir);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('growth-step declaration root must be a real directory');
  const entries = fs.readdirSync(declarationDir, { withFileTypes: true }).filter(entry => entry.name.endsWith('.growth-step.json')).sort((a, b) => a.name.localeCompare(b.name));
  if (entries.length > MAX_DECLARATIONS) throw new Error('growth-step declaration inventory exceeds its bound');
  const files = [];
  const records = [];
  for (const entry of entries) {
    const file = path.join(declarationDir, entry.name);
    const stat = fs.lstatSync(file);
    const filePath = relative(root, file);
    let fileState = 'READABLE_REAL_FILE';
    if (stat.isSymbolicLink()) fileState = 'REFUSED_SYMBOLIC_LINK';
    else if (!stat.isFile()) fileState = 'REFUSED_SPECIAL_FILE';
    else if (stat.size > MAX_FILE_BYTES) fileState = 'REFUSED_OVERSIZED_FILE';
    const bytes = fileState === 'READABLE_REAL_FILE' ? fs.readFileSync(file) : Buffer.alloc(0);
    const fileSha256 = Cell.sha256(bytes);
    files.push({ path: filePath, bytes: stat.size, sha256: fileSha256, fileState });
    if (fileState !== 'READABLE_REAL_FILE') {
      records.push({ path: filePath, fileSha256, declaration: null, issue: fileState });
      continue;
    }
    try {
      const declaration = JSON.parse(bytes.toString('utf8'));
      records.push({ path: filePath, fileSha256, declaration: Cell.verify(declaration, { root }), issue: null });
    } catch (error) {
      records.push({ path: filePath, fileSha256, declaration: null, issue: String(error && error.message || error).slice(0, 500) });
    }
  }
  return { root, declarationDir, files, records };
}

function buildAudit(inventory) {
  const results = inventory.records.map(record => record.declaration ? {
    path: record.path,
    fileSha256: record.fileSha256,
    declarationId: record.declaration.declarationId,
    declarationDigest: record.declaration.declarationDigest,
    stepId: record.declaration.step.id,
    organId: record.declaration.step.organId,
    state: 'VERIFIED_PROPOSAL_PLANNING_DECLARATION',
    issue: null,
    proposalPlanningEligible: true,
    executionEligible: false,
    sourceExecuted: false,
    routeSelected: false,
    authorityGranted: false
  } : {
    path: record.path,
    fileSha256: record.fileSha256,
    declarationId: null,
    declarationDigest: null,
    stepId: null,
    organId: null,
    state: 'REFUSED_GROWTH_STEP_DECLARATION',
    issue: record.issue,
    proposalPlanningEligible: false,
    executionEligible: false,
    sourceExecuted: false,
    routeSelected: false,
    authorityGranted: false
  });
  const verified = results.filter(item => item.state === 'VERIFIED_PROPOSAL_PLANNING_DECLARATION').length;
  const refused = results.length - verified;
  const audit = {
    schema: AUDIT_SCHEMA,
    auditId: null,
    auditDigest: null,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, sourceExecution: false, automaticExecution: false },
    source: { declarationRoot: relative(inventory.root, inventory.declarationDir), files: clone(inventory.files) },
    results,
    summary: {
      declarationFiles: results.length,
      verifiedDeclarations: verified,
      refusedDeclarations: refused,
      proposalPlanningCandidates: verified,
      executionEligibleSteps: 0,
      sourceExecutions: 0,
      routesSelected: 0,
      permissionsGranted: 0,
      runtimeAdmissions: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    state: refused ? 'HOLD_REFUSED_GROWTH_STEP_DECLARATIONS' : verified ? 'VERIFIED_GROWTH_STEP_DECLARATIONS_FOR_PROPOSAL_PLANNING_ONLY' : 'NO_GROWTH_STEP_DECLARATIONS',
    authority: authority(),
    boundary: 'This TEST organ reads content- and source-hash-bound growth-step declarations as inert public data and verifies only their fitness as inputs to proposal planning. It never imports or executes the declared source, selects a route, executes a step, writes public source or Workshop, grants permission, admits or promotes runtime, changes CANON or identity, or acts in the world.'
  };
  const basis = Object.assign({}, audit, { auditId: null, auditDigest: null });
  audit.auditDigest = Cell.sha256(basis);
  audit.auditId = `growth-step-declaration-audit-${audit.auditDigest.slice(0, 24)}`;
  return Cell.stable(audit);
}

function verifyAudit(audit, inventory, runDir = null) {
  exact(audit, ['schema', 'auditId', 'auditDigest', 'organ', 'source', 'results', 'summary', 'state', 'authority', 'boundary'], 'growth-step declaration audit');
  if (audit.schema !== AUDIT_SCHEMA || !audit.organ || audit.organ.id !== ORGAN_ID || audit.organ.status !== 'TEST' || audit.organ.learnedWeights !== false || audit.organ.sourceExecution !== false || audit.organ.automaticExecution !== false) throw new Error('growth-step declaration audit identity changed');
  if (!same(audit.authority, authority())) throw new Error('growth-step declaration audit authority changed');
  const zeroKeys = ['executionEligibleSteps', 'sourceExecutions', 'routesSelected', 'permissionsGranted', 'runtimeAdmissions', 'runtimePromotions', 'canonChanges', 'worldActions'];
  if (zeroKeys.some(key => audit.summary[key] !== 0)) throw new Error('growth-step declaration audit gained execution or authority');
  if (audit.results.some(item => item.executionEligible !== false || item.sourceExecuted !== false || item.routeSelected !== false || item.authorityGranted !== false)) throw new Error('growth-step audit result gained execution or authority');
  const basis = Object.assign({}, clone(audit), { auditId: null, auditDigest: null });
  const expectedDigest = Cell.sha256(basis);
  if (audit.auditDigest !== expectedDigest || audit.auditId !== `growth-step-declaration-audit-${expectedDigest.slice(0, 24)}`) throw new Error('growth-step declaration audit digest changed');
  if (inventory && !same(audit, buildAudit(inventory))) throw new Error('growth-step declaration audit does not replay from its inventory');
  if (runDir) {
    const stored = JSON.parse(fs.readFileSync(path.join(runDir, 'audit.json'), 'utf8'));
    if (!same(stored, audit)) throw new Error('stored growth-step declaration audit changed');
  }
  return true;
}

function run(options = {}) {
  const inventory = collect(options);
  const audit = buildAudit(inventory);
  verifyAudit(audit, inventory);
  const stateDir = boundedDirectory(inventory.root, options.stateDir || path.join(inventory.root, 'state', 'growth-step-declaration-audits'), 'growth-step audit state root');
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, audit.auditId);
  if (fs.existsSync(runDir)) {
    verifyAudit(audit, inventory, runDir);
    return { audit, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${audit.auditId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error('growth-step audit staging directory already exists');
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'audit.json'), JSON.stringify(Cell.stable(audit), null, 2) + '\n', { flag: 'wx' });
  verifyAudit(audit, inventory, stageDir);
  const commit = ImmutableStore.commitDirectory(stageDir, runDir);
  return { audit, runDir, reused: commit.reused };
}

module.exports = { ROOT, ORGAN_ID, AUDIT_SCHEMA, DEFAULT_DECLARATION_DIR, DEFAULT_STATE_DIR, MAX_DECLARATIONS, MAX_FILE_BYTES, authority, collect, buildAudit, verifyAudit, run };
