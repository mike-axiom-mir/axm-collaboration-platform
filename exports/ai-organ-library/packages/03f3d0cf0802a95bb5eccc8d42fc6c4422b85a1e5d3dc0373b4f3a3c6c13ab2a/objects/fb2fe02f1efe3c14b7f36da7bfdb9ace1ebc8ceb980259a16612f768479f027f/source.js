'use strict';

const fs = require('fs');
const path = require('path');
const Cell = require('../kernel/growth-step-declaration-cell');
const DeclarationAudit = require('./growth-step-declaration-audit-organ');
const BoundedReasoning = require('./bounded-search-reasoning-organ');
const Search = require('../kernel/bounded-state-search-cell');
const ImmutableStore = require('../kernel/immutable-batch-store');

const ROOT = path.resolve(__dirname, '..');
const ORGAN_ID = 'axm.mirror.organ/growth-route-planner-v1';
const REQUEST_SCHEMA = 'axm.mirror.growth-route-planner-request/v1';
const PROPOSAL_SCHEMA = 'axm.mirror.growth-route-proposal/v1';
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'growth-route-proposals');
const SOURCE_MODES = new Set(['CURRENT_VERIFIED_MIRROR_STATE', 'SYNTHETIC_DECLARATION_COMPOSITION_FIXTURE']);
const HIDDEN_KEYS = /^(chain[-_ ]?of[-_ ]?thought|private[-_ ]?reasoning|hidden[-_ ]?reasoning|scratchpad)$/i;
const MAX = Object.freeze({ steps: 32, facts: 256, schemas: 128, evidence: 512 });

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function same(left, right) { return JSON.stringify(Cell.stable(left)) === JSON.stringify(Cell.stable(right)); }
function own(value, key) { return Object.prototype.hasOwnProperty.call(value, key); }
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}
function exact(value, keys, label) {
  object(value, label);
  const unknown = Object.keys(value).filter(key => !keys.includes(key));
  if (unknown.length) throw new Error(`${label} has unknown critical fields: ${unknown.join(', ')}`);
}
function rejectHidden(value, trail = []) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (HIDDEN_KEYS.test(key)) throw new Error(`private hidden reasoning is refused at ${trail.concat(key).join('.')}`);
    rejectHidden(value[key], trail.concat(key));
  }
}
function text(value, label, maximum = 500) {
  const result = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!result || result.length > maximum) throw new Error(`${label} must contain 1-${maximum} visible characters`);
  return result;
}
function primitive(value, label) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new Error(`${label} must be a finite JSON primitive`);
}
function list(value, maximum, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  if (value.length > maximum) throw new Error(`${label} exceeds ${maximum} items`);
  return value;
}
function uniqueStrings(value, maximum, label, pattern = null) {
  const rows = list(value, maximum, label).map((item, index) => text(item, `${label}[${index}]`, 400));
  if (new Set(rows).size !== rows.length) throw new Error(`${label} contains duplicates`);
  if (pattern && rows.some(item => !pattern.test(item))) throw new Error(`${label} contains an unsupported value`);
  return rows.sort();
}
function boundedChild(root, relative, label) {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, relative);
  const rel = path.relative(absoluteRoot, absolute);
  if (!rel || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error(`${label} escapes Mirror root`);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a real file`);
  return absolute;
}
function boundedDirectory(root, candidate, label) {
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(candidate);
  const rel = path.relative(absoluteRoot, absolute);
  if (!rel || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) throw new Error(`${label} must stay below Mirror root`);
  return absolute;
}

function normalizeFact(item, index) {
  const label = `initialState.facts[${index}]`;
  exact(item, ['id', 'status', 'value', 'evidenceRefs'], label);
  const status = item.status;
  if (!['KNOWN', 'UNKNOWN'].includes(status)) throw new Error(`${label}.status is unsupported`);
  if (status === 'KNOWN' && !own(item, 'value')) throw new Error(`${label} requires a known value`);
  if (status === 'UNKNOWN' && own(item, 'value')) throw new Error(`${label} cannot give UNKNOWN a value`);
  const evidenceRefs = uniqueStrings(item.evidenceRefs || [], 128, `${label}.evidenceRefs`);
  if (status === 'KNOWN' && !evidenceRefs.length) throw new Error(`${label} requires attributed evidence for a known fact`);
  return {
    id: text(item.id, `${label}.id`, 120),
    status,
    ...(status === 'KNOWN' ? { value: primitive(item.value, `${label}.value`) } : {}),
    evidenceRefs
  };
}

function normalizePredicate(item, index) {
  const label = `goal.predicates[${index}]`;
  exact(item, ['factId', 'operator', 'value'], label);
  if (!Cell.OPERATORS.includes(item.operator)) throw new Error(`${label}.operator is unsupported`);
  return { factId: text(item.factId, `${label}.factId`, 120), operator: item.operator, value: primitive(item.value, `${label}.value`) };
}

function normalizeEvidence(item, index) {
  const label = `evidence[${index}]`;
  exact(item, ['id', 'kind', 'status', 'statement', 'source'], label);
  const source = object(item.source, `${label}.source`);
  exact(source, ['kind', 'id', 'uri'], `${label}.source`);
  const normalized = {
    id: text(item.id, `${label}.id`, 400),
    kind: text(item.kind, `${label}.kind`, 120),
    status: text(item.status, `${label}.status`, 120),
    statement: text(item.statement, `${label}.statement`, 1000),
    source: {
      kind: text(source.kind, `${label}.source.kind`, 120),
      id: text(source.id, `${label}.source.id`, 400),
      ...(source.uri == null ? {} : { uri: text(source.uri, `${label}.source.uri`, 500) })
    }
  };
  if (normalized.status !== 'tested') throw new Error(`${label}.status must be tested`);
  return normalized;
}

function normalizeRequest(input) {
  rejectHidden(input);
  exact(input, ['schema', 'sourceMode', 'declarationAudit', 'stepIds', 'initialState', 'goal', 'availableSchemas', 'evidence', 'search', 'reasoningAt'], 'growth route planner request');
  if (input.schema !== REQUEST_SCHEMA) throw new Error(`growth route planner request requires ${REQUEST_SCHEMA}`);
  if (!SOURCE_MODES.has(input.sourceMode)) throw new Error('growth route planner sourceMode is unsupported');
  DeclarationAudit.verifyAudit(input.declarationAudit);
  if (input.declarationAudit.state !== 'VERIFIED_GROWTH_STEP_DECLARATIONS_FOR_PROPOSAL_PLANNING_ONLY' || input.declarationAudit.summary.refusedDeclarations !== 0) throw new Error('growth route planning requires a clean declaration audit');
  const stepIds = uniqueStrings(input.stepIds, MAX.steps, 'stepIds', /^axm\.mirror\.growth-step\//);
  if (!stepIds.length) throw new Error('stepIds requires at least one explicit caller-scoped step');
  const initial = object(input.initialState, 'initialState');
  exact(initial, ['facts'], 'initialState');
  const facts = list(initial.facts, MAX.facts, 'initialState.facts').map(normalizeFact).sort((a, b) => a.id.localeCompare(b.id));
  if (!facts.length || new Set(facts.map(item => item.id)).size !== facts.length) throw new Error('initialState facts must be nonempty and unique');
  const goal = object(input.goal, 'goal');
  exact(goal, ['predicates'], 'goal');
  const predicates = list(goal.predicates, MAX.facts, 'goal.predicates').map(normalizePredicate).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (!predicates.length) throw new Error('goal.predicates requires at least one predicate');
  const availableSchemas = uniqueStrings(input.availableSchemas, MAX.schemas, 'availableSchemas', /^axm\./);
  const evidence = list(input.evidence, MAX.evidence, 'evidence').map(normalizeEvidence).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(evidence.map(item => item.id)).size !== evidence.length) throw new Error('evidence contains duplicate ids');
  const evidenceIds = new Set(evidence.map(item => item.id));
  for (const fact of facts) for (const ref of fact.evidenceRefs) if (!evidenceIds.has(ref)) throw new Error(`known fact evidence is absent: ${ref}`);
  const reasoningAt = text(input.reasoningAt, 'reasoningAt', 80);
  if (new Date(reasoningAt).toISOString() !== reasoningAt) throw new Error('reasoningAt must be an exact ISO timestamp');
  const search = clone(object(input.search, 'search'));
  return Cell.stable({
    schema: REQUEST_SCHEMA,
    sourceMode: input.sourceMode,
    declarationAudit: clone(input.declarationAudit),
    stepIds,
    initialState: { facts },
    goal: { predicates },
    availableSchemas,
    evidence,
    search,
    reasoningAt
  });
}

function loadDeclarations(request, options = {}) {
  const root = path.resolve(options.root || ROOT);
  const resultByStep = new Map(request.declarationAudit.results.map(item => [item.stepId, item]));
  const fileByPath = new Map(request.declarationAudit.source.files.map(item => [item.path, item]));
  const declarations = [];
  for (const stepId of request.stepIds) {
    const result = resultByStep.get(stepId);
    if (!result || result.state !== 'VERIFIED_PROPOSAL_PLANNING_DECLARATION') throw new Error(`requested growth step is absent from the exact audit: ${stepId}`);
    const sourceRecord = fileByPath.get(result.path);
    if (!sourceRecord || sourceRecord.fileState !== 'READABLE_REAL_FILE' || sourceRecord.sha256 !== result.fileSha256) throw new Error(`growth step audit file binding changed: ${result.path}`);
    const file = boundedChild(root, result.path, 'growth-step declaration file');
    const bytes = fs.readFileSync(file);
    if (Cell.sha256(bytes) !== result.fileSha256) throw new Error(`growth-step declaration bytes changed after audit: ${result.path}`);
    const declaration = Cell.verify(JSON.parse(bytes.toString('utf8')), { root });
    if (declaration.step.id !== stepId || declaration.declarationId !== result.declarationId || declaration.declarationDigest !== result.declarationDigest) throw new Error(`growth-step declaration identity changed after audit: ${stepId}`);
    const declarationRef = `declaration://${stepId}`;
    const evidenceRefs = new Set(declaration.transition.preconditions.flatMap(item => item.evidenceRefs));
    if (evidenceRefs.size !== 1 || !evidenceRefs.has(declarationRef)) throw new Error(`growth-step precondition evidence must bind its exact declaration: ${stepId}`);
    declarations.push(declaration);
  }
  return declarations.sort((a, b) => a.step.id.localeCompare(b.step.id));
}

function initialEvidenceRefs(request) {
  return Array.from(new Set(request.initialState.facts.flatMap(item => item.evidenceRefs))).sort();
}

function declarationEvidence(declarations, audit) {
  return declarations.map(declaration => ({
    id: `declaration://${declaration.step.id}`,
    kind: 'test',
    status: 'tested',
    statement: 'The exact source- and test-hash-bound growth-step declaration is present in the verified audit. This proves declared proposal semantics only, not execution fitness.',
    source: { kind: 'growth-step-declaration-audit', id: audit.auditId, uri: `sha256:${audit.auditDigest}` }
  }));
}

function buildProblem(request, declarations) {
  const initialRefs = initialEvidenceRefs(request);
  const actions = declarations.map(declaration => {
    const declarationRef = `declaration://${declaration.step.id}`;
    return {
      id: declaration.step.id,
      label: `Simulate declared growth step ${declaration.step.id}`,
      kind: 'growth-step-proposal',
      preconditions: declaration.transition.preconditions.map(item => ({ factId: item.factId, operator: item.operator, value: item.value })),
      effects: declaration.transition.effects.map(item => ({ factId: item.factId, status: item.status, value: item.value, operation: item.operation })),
      cost: declaration.transition.cost,
      requiredPermissions: [],
      supportingEvidence: [declarationRef].concat(initialRefs),
      preconditionEvidence: [declarationRef].concat(initialRefs),
      expectedEffects: declaration.transition.effects.map(item => `${item.factId} becomes ${item.status}:${JSON.stringify(item.value)}`),
      possibleSideEffects: [],
      reversible: declaration.transition.reversible,
      recovery: declaration.transition.recovery,
      risk: declaration.transition.risk,
      repairsActionIds: []
    };
  });
  const basis = {
    auditDigest: request.declarationAudit.auditDigest,
    stepIds: request.stepIds,
    initialState: request.initialState,
    goal: request.goal,
    availableSchemas: request.availableSchemas
  };
  const problem = {
    schema: Search.PROBLEM_SCHEMA,
    problemId: `growth-route-${Cell.sha256(basis).slice(0, 24)}`,
    initialState: { facts: request.initialState.facts.map(item => ({ id: item.id, status: item.status, ...(item.status === 'KNOWN' ? { value: item.value } : {}) })) },
    goal: clone(request.goal),
    actions,
    permissions: [],
    previousFailure: null,
    search: clone(request.search)
  };
  const normalized = Search.normalizeProblem(problem);
  const closedProblem = Object.assign({}, normalized);
  delete closedProblem.problemDigest;
  return closedProblem;
}

function exactPortCoverage(plan, declarations, availableSchemas) {
  const byStep = new Map(declarations.map(item => [item.step.id, item]));
  const available = new Set(availableSchemas);
  const rows = [];
  for (const stepId of plan ? plan.actionIds : []) {
    const declaration = byStep.get(stepId);
    if (!declaration) throw new Error(`bounded plan referenced undeclared growth step: ${stepId}`);
    const before = Array.from(available).sort();
    const required = declaration.ports.consumes.filter(item => item.required).map(item => item.schema).sort();
    const missing = required.filter(schema => !available.has(schema));
    const produced = declaration.ports.produces.map(item => item.schema).sort();
    if (!missing.length) for (const schema of produced) available.add(schema);
    rows.push({
      stepId,
      declarationId: declaration.declarationId,
      requiredInputSchemas: required,
      availableSchemasBefore: before,
      missingInputSchemas: missing,
      producedSchemas: produced,
      availableSchemasAfter: Array.from(available).sort(),
      state: missing.length ? 'HOLD_EXACT_SCHEMA_INPUT_UNAVAILABLE' : 'PASS_EXACT_SCHEMA_ID_PORT_COVERAGE'
    });
  }
  return {
    mode: 'EXACT_SCHEMA_ID_COVERAGE_NOT_SEMANTIC_COMPATIBILITY_PROOF',
    initialSchemas: availableSchemas.slice().sort(),
    steps: rows,
    complete: rows.every(item => item.missingInputSchemas.length === 0)
  };
}

function authority() {
  return {
    readGrowthDeclarations: true,
    privateProposalTraceWrite: true,
    declaredSourceExecution: false,
    routeSelection: false,
    stepExecution: false,
    sourceWrite: false,
    workshopRead: false,
    workshopWrite: false,
    permissionGrant: false,
    evidenceAdmission: false,
    trainingAdmission: false,
    runtimeAdmission: false,
    runtimePromotion: false,
    canonChange: false,
    identityChange: false,
    worldAction: false
  };
}

function buildProposal(input, options = {}) {
  const request = normalizeRequest(input);
  const declarations = loadDeclarations(request, options);
  const internalEvidence = declarationEvidence(declarations, request.declarationAudit);
  const callerEvidenceIds = new Set(request.evidence.map(item => item.id));
  const collision = internalEvidence.find(item => callerEvidenceIds.has(item.id));
  if (collision) throw new Error(`caller evidence collides with declaration evidence: ${collision.id}`);
  const problem = buildProblem(request, declarations);
  const boundedReasoning = BoundedReasoning.run({
    problem,
    reasoning: {
      schema: 'axm.mirror.reasoning-session/v1',
      goal: 'Propose a bounded route through exact declared transitions without executing any step.',
      evidence: request.evidence.concat(internalEvidence),
      unknowns: [],
      constraints: [],
      permissions: [],
      actions: [],
      pathProfiles: []
    }
  }, { at: request.reasoningAt });
  BoundedReasoning.verify(boundedReasoning);
  const portCoverage = exactPortCoverage(boundedReasoning.search.plan, declarations, request.availableSchemas);
  const searchPlan = boundedReasoning.search.plan;
  const planComparison = searchPlan
    ? boundedReasoning.reasoningSession.pathSet.comparisons.find(item => item.actionId === boundedReasoning.binding.exactSearchPlanCandidateId)
    : null;
  const planPassesReasoningGates = Boolean(planComparison && planComparison.eligible === true);
  const advisorySupportsPlan = Boolean(searchPlan && boundedReasoning.binding.selectedActionId === boundedReasoning.binding.exactSearchPlanCandidateId);
  const proposalEligible = Boolean(searchPlan && searchPlan.stepCount > 0 && planPassesReasoningGates && advisorySupportsPlan && portCoverage.complete);
  const routeState = !searchPlan
    ? 'HOLD_NO_BOUNDED_GROWTH_ROUTE'
    : searchPlan.stepCount === 0
      ? 'ZERO_STEP_GOAL_ALREADY_SATISFIED_NO_GROWTH_ACTION'
      : !planPassesReasoningGates
        ? 'HOLD_REASONING_EVIDENCE_OR_PERMISSION_GATE'
        : !advisorySupportsPlan
          ? 'HOLD_REASONING_ADVISORY_PREFERRED_ALTERNATIVE'
        : !portCoverage.complete
          ? 'HOLD_EXACT_SCHEMA_PORT_INPUT_UNAVAILABLE'
          : 'GROWTH_ROUTE_PROPOSED_NOT_SELECTED_OR_EXECUTED';
  const declarationByStep = new Map(declarations.map(item => [item.step.id, item]));
  const routeStepIds = proposalEligible ? searchPlan.actionIds.slice() : [];
  const proposal = {
    schema: PROPOSAL_SCHEMA,
    proposalId: null,
    proposalDigest: null,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, declaredSourceExecution: false },
    source: {
      mode: request.sourceMode,
      declarationAuditId: request.declarationAudit.auditId,
      declarationAuditDigest: request.declarationAudit.auditDigest,
      declarationsAvailableInAudit: request.declarationAudit.summary.verifiedDeclarations,
      requestedStepIds: request.stepIds,
      requestedDeclarationIds: declarations.map(item => item.declarationId),
      requestedDeclarationDigests: declarations.map(item => item.declarationDigest),
      initialStateDigest: Cell.sha256(request.initialState),
      goalDigest: Cell.sha256(request.goal),
      callerEvidenceIds: request.evidence.map(item => item.id),
      reasoningAt: request.reasoningAt
    },
    adaptedProblem: problem,
    boundedReasoning,
    portCoverage,
    route: {
      state: routeState,
      proposalEligible,
      searchedPlanId: searchPlan ? searchPlan.planId : null,
      reasoningAdvisoryCandidateId: boundedReasoning.binding.selectedActionId,
      stepIds: routeStepIds,
      declarationIds: routeStepIds.map(stepId => declarationByStep.get(stepId).declarationId),
      stepCount: routeStepIds.length,
      totalDeclaredCost: proposalEligible ? searchPlan.totalCost : null,
      routeSelections: 0,
      stepExecutions: 0,
      declaredSourceExecutions: 0,
      permissionsGranted: 0,
      runtimeAdmissions: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      identityChanges: 0,
      worldActions: 0
    },
    authority: authority(),
    boundary: 'This TEST organ adapts an explicit caller-scoped set of clean, source- and test-hash-bound growth-step declarations into a bounded-search and Reasoning Foundation proposal. Exact schema-ID port coverage is a structural gate, not semantic compatibility or operational fit. The planner reads declarations but never imports or executes their sources, selects or executes a route, writes public source or Workshop, grants permission, admits or promotes runtime, changes CANON or identity, trains, or acts in the world.'
  };
  const basis = Object.assign({}, proposal, { proposalId: null, proposalDigest: null });
  proposal.proposalDigest = Cell.sha256(basis);
  proposal.proposalId = `growth-route-proposal-${proposal.proposalDigest.slice(0, 24)}`;
  return Cell.stable(proposal);
}

function verifyProposal(proposal, input = null, options = {}) {
  exact(proposal, ['schema', 'proposalId', 'proposalDigest', 'organ', 'source', 'adaptedProblem', 'boundedReasoning', 'portCoverage', 'route', 'authority', 'boundary'], 'growth route proposal');
  if (proposal.schema !== PROPOSAL_SCHEMA || !proposal.organ || proposal.organ.id !== ORGAN_ID || proposal.organ.status !== 'TEST' || proposal.organ.learnedWeights !== false || proposal.organ.declaredSourceExecution !== false) throw new Error('growth route proposal identity changed');
  BoundedReasoning.verify(proposal.boundedReasoning);
  if (!same(proposal.authority, authority())) throw new Error('growth route proposal authority changed');
  const zero = ['routeSelections', 'stepExecutions', 'declaredSourceExecutions', 'permissionsGranted', 'runtimeAdmissions', 'runtimePromotions', 'canonChanges', 'identityChanges', 'worldActions'];
  if (zero.some(key => proposal.route[key] !== 0)) throw new Error('growth route proposal gained execution or authority');
  if (proposal.route.proposalEligible && (proposal.route.state !== 'GROWTH_ROUTE_PROPOSED_NOT_SELECTED_OR_EXECUTED' || !proposal.portCoverage.complete || !proposal.route.stepCount)) throw new Error('growth route proposal eligibility changed');
  if (!proposal.route.proposalEligible && proposal.route.stepIds.length) throw new Error('held growth route exposed executable-looking steps');
  const basis = Object.assign({}, clone(proposal), { proposalId: null, proposalDigest: null });
  const expectedDigest = Cell.sha256(basis);
  if (proposal.proposalDigest !== expectedDigest || proposal.proposalId !== `growth-route-proposal-${expectedDigest.slice(0, 24)}`) throw new Error('growth route proposal digest changed');
  if (input && !same(proposal, buildProposal(input, options))) throw new Error('growth route proposal does not replay from its request');
  return true;
}

function run(input, options = {}) {
  const root = path.resolve(options.root || ROOT);
  const proposal = buildProposal(input, Object.assign({}, options, { root }));
  verifyProposal(proposal, input, Object.assign({}, options, { root }));
  const stateDir = boundedDirectory(root, options.stateDir || path.join(root, 'state', 'growth-route-proposals'), 'growth route state root');
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, proposal.proposalId);
  if (fs.existsSync(runDir)) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'proposal.json'), 'utf8'));
    if (!same(disk, proposal)) throw new Error('stored growth route proposal changed');
    return { proposal, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${proposal.proposalId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error('growth route proposal staging directory already exists');
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'proposal.json'), JSON.stringify(Cell.stable(proposal), null, 2) + '\n', { flag: 'wx' });
  const disk = JSON.parse(fs.readFileSync(path.join(stageDir, 'proposal.json'), 'utf8'));
  if (!same(disk, proposal)) throw new Error('staged growth route proposal changed');
  const commit = ImmutableStore.commitDirectory(stageDir, runDir);
  return { proposal, runDir, reused: commit.reused };
}

module.exports = {
  ROOT, ORGAN_ID, REQUEST_SCHEMA, PROPOSAL_SCHEMA, DEFAULT_STATE_DIR, SOURCE_MODES, MAX,
  authority, normalizeRequest, loadDeclarations, buildProblem, exactPortCoverage,
  buildProposal, verifyProposal, run
};
