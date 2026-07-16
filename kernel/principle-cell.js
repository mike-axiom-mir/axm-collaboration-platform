'use strict';

const fs = require('fs');
const path = require('path');
const State = require('./state-language');

const ROOT_DIR = path.resolve(__dirname, '..');
const ROOT_FILE = path.join(ROOT_DIR, 'roots', 'AXM_ROOTS_v1.json');
const ROOTS = JSON.parse(fs.readFileSync(ROOT_FILE, 'utf8'));
const ROOT_HASH = State.digest(ROOTS, 64);

function evidenceConflicts(evidence) {
  const present = new Set(evidence.map(item => item.id));
  const pairs = [];
  for (const item of evidence) {
    for (const target of item.contradicts) if (present.has(target)) pairs.push([item.id, target].sort().join('::'));
  }
  return Array.from(new Set(pairs)).map(pair => pair.split('::'));
}

function evaluate(action, request, evidenceById, conflictedIds) {
  const checks = [];
  let value = 1;
  function reject(root, detail) { value = -1; checks.push({ root, result: -1, detail }); }
  function hold(root, detail) { if (value > 0) value = 0; checks.push({ root, result: 0, detail }); }
  function pass(root, detail) { checks.push({ root, result: 1, detail }); }

  const missingPermissions = action.requiredPermissions.filter(permission => !request.permissions.includes(permission));
  if (missingPermissions.length) reject('agency-non-domination', `Missing permissions: ${missingPermissions.join(', ')}`);
  else pass('agency-non-domination', action.requiredPermissions.length ? 'Every requested permission is explicitly present.' : 'Action requests no permission.');

  const prohibited = request.constraints.filter(constraint => constraint.type === 'prohibit-action' && constraint.actionIds.includes(action.id));
  if (prohibited.length) reject('agency-non-domination', `Action prohibited by: ${prohibited.map(item => item.id).join(', ')}`);

  const permissionConstraints = request.constraints.filter(constraint => constraint.type === 'require-permission' && constraint.permission);
  const constraintPermissionMissing = permissionConstraints.filter(constraint => !request.permissions.includes(constraint.permission));
  if (constraintPermissionMissing.length) reject('agency-non-domination', `Constraint permissions missing: ${constraintPermissionMissing.map(item => item.permission).join(', ')}`);

  const requiredEvidence = Array.from(new Set(action.preconditionEvidence.concat(
    request.constraints.filter(constraint => constraint.type === 'require-evidence' && (!constraint.actionIds.length || constraint.actionIds.includes(action.id))).flatMap(constraint => constraint.evidenceIds)
  )));
  const missingEvidence = requiredEvidence.filter(item => !evidenceById.has(item));
  if (missingEvidence.length) hold('truth-before-story', `Required evidence missing: ${missingEvidence.join(', ')}`);

  const support = action.supportingEvidence.filter(item => evidenceById.has(item));
  const unsupportedRefs = action.supportingEvidence.filter(item => !evidenceById.has(item));
  if (unsupportedRefs.length) hold('source-integrity', `Supporting references not found: ${unsupportedRefs.join(', ')}`);
  if (!support.length && !['ask', 'observe', 'hold'].includes(action.kind)) hold('source-integrity', 'No sourced evidence supports this action yet.');
  else pass('source-integrity', support.length ? `Sourced support: ${support.join(', ')}` : 'Epistemic hold action requires no factual promotion.');

  const conflictedSupport = support.filter(item => conflictedIds.has(item));
  if (conflictedSupport.length) hold('no-silent-rewrite', `Supporting evidence remains contradicted: ${conflictedSupport.join(', ')}`);
  else pass('no-silent-rewrite', 'No supporting contradiction was erased.');

  const riskLimits = request.constraints.filter(constraint => constraint.type === 'max-risk' && constraint.maxRisk);
  const exceeded = riskLimits.filter(constraint => State.RISK[action.risk] > State.RISK[constraint.maxRisk]);
  if (exceeded.length) reject('restraint', `Risk ${action.risk} exceeds accepted limit ${exceeded.map(item => item.maxRisk).join(', ')}`);
  else if (action.risk === 'severe') hold('restraint', 'Severe-risk proposal requires a separate explicit authorization contract.');
  else pass('restraint', `Declared risk ${action.risk} remains within supplied constraints.`);

  if (action.reversible && action.recovery) pass('repairability', 'Action declares reversibility and a recovery path.');
  else if (['ask', 'observe', 'hold'].includes(action.kind)) pass('repairability', 'Epistemic action does not mutate the world.');
  else hold('repairability', 'No verified recovery path was supplied.');

  return { action, value, checks };
}

function humanRender(request, evaluations, decision, conflicts) {
  const selected = evaluations.find(item => item.action.id === decision.selectedActionId);
  const unknownCount = request.unknowns.length;
  const conflictCount = conflicts.length;
  let summary;
  if (decision.value === 1) summary = `Mirror found one supplied action supported enough to proceed inside the declared bounds: ${selected.action.label}`;
  else if (decision.value === -1) summary = 'Mirror refused every supplied action because an authorization, prohibition, or accepted-risk boundary was violated.';
  else summary = 'Mirror is holding. It needs more evidence, a resolved contradiction, an explicit permission, or a recovery path before proceeding.';
  return {
    summary,
    goal: request.goal.statement,
    selected: selected ? selected.action.label : null,
    unknowns: unknownCount,
    conflicts: conflictCount,
    explanation: decision.reason,
    boundary: 'This explanation is rendered from the structured trace. Seed-0 has no learned language or planning organ.'
  };
}

function reason(input, options = {}) {
  const startedAt = new Date().toISOString();
  const request = State.normalizeRequest(input);
  const evidenceById = new Map(request.evidence.map(item => [item.id, item]));
  const conflicts = evidenceConflicts(request.evidence);
  const conflictedIds = new Set(conflicts.flat());
  let actions = request.actions;
  if (!actions.length) actions = [{
    id: 'hold-no-candidate', kind: 'hold', label: 'Hold and request candidate actions',
    requiredPermissions: [], supportingEvidence: [], preconditionEvidence: [], expectedEffects: [],
    possibleSideEffects: [], reversible: true, recovery: 'No world mutation occurred.', risk: 'low'
  }];
  const evaluations = actions.map(action => evaluate(action, request, evidenceById, conflictedIds));
  const accepted = evaluations.filter(item => item.value === 1);
  const held = evaluations.filter(item => item.value === 0);
  const decision = accepted.length ? {
    value: 1,
    selectedActionId: accepted[0].action.id,
    reason: accepted.length > 1 ? `Selected the first of ${accepted.length} supported supplied candidates; Seed-0 does not yet rank equivalent candidates.` : 'The supplied candidate passed every deterministic Seed-0 gate.'
  } : held.length ? {
    value: 0,
    selectedActionId: held[0].action.id,
    reason: 'At least one candidate remains potentially valid but lacks sufficient evidence, permission clarity, conflict resolution, or repairability.'
  } : {
    value: -1,
    selectedActionId: evaluations[0] && evaluations[0].action.id || null,
    reason: 'Every supplied candidate crossed a hard authorization, prohibition, or accepted-risk boundary.'
  };
  const traceBasis = { request, evaluations, decision, rootHash: ROOT_HASH };
  const traceId = `trace-${State.digest(traceBasis)}`;
  const trace = {
    schema: 'axm.mirror.trace/v1',
    traceId,
    requestId: request.requestId,
    sessionId: request.sessionId,
    identity: 'axm.machine.mirror/seed-0',
    providerId: 'mirror-kernel',
    createdAt: startedAt,
    rootBundle: { version: ROOTS.version, sha256: ROOT_HASH, gradientMutable: false },
    epistemic: {
      evidence: request.evidence,
      unknowns: request.unknowns,
      contradictions: conflicts,
      factsPromotedByLanguage: 0
    },
    goal: request.goal,
    constraints: request.constraints,
    permissions: request.permissions,
    candidates: evaluations,
    decision,
    human: null,
    limitations: [
      'Deterministic supplied-candidate evaluation only.',
      'No learned weights, world model, candidate generator, tool use, or open-ended language organ.',
      'A passing Seed-0 trace is bounded evidence, not a general safety proof.'
    ]
  };
  trace.human = humanRender(request, evaluations, decision, conflicts);
  if (typeof options.onTrace === 'function') options.onTrace(trace);
  return trace;
}

module.exports = { reason, rootHash: ROOT_HASH, roots: ROOTS };
