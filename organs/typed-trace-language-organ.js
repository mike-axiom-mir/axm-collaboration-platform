'use strict';

const crypto = require('crypto');
const LanguageModel = require('../learning/typed-trace-language-model');

const ORGAN_ID = 'axm.mirror.typed-trace-language-organ/shadow-v1';
const RESPONSE_SCHEMA = 'axm.mirror.typed-trace-language-response/v1';
const MIN_CONFIDENCE = 0.45;
const MIN_MARGIN = 0.25;

const PLAN_ORDER = Object.freeze({
  SUPPORTED_BOUNDED_CLEAR: ['decision', 'goal', 'selected', 'evidence', 'boundary'],
  SUPPORTED_BOUNDED_UNCERTAIN: ['decision', 'goal', 'selected', 'uncertainty', 'evidence', 'boundary'],
  HOLD_CONTRADICTION: ['decision', 'goal', 'contradictions', 'uncertainty', 'selected', 'boundary'],
  HOLD_MISSING_EVIDENCE: ['decision', 'goal', 'uncertainty', 'evidence', 'selected', 'boundary'],
  HOLD_OPEN_UNCERTAINTY: ['decision', 'goal', 'uncertainty', 'selected', 'boundary'],
  HOLD_REPAIRABILITY: ['decision', 'goal', 'selected', 'uncertainty', 'boundary'],
  REFUSE_BOUNDARY: ['decision', 'goal', 'selected', 'boundary']
});

function stable(value) { return LanguageModel.stable(value); }
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }

function clean(value, max = 1000) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function quote(value) { return JSON.stringify(clean(value, 1200)); }
function list(value, max = 256) { return Array.isArray(value) ? value.slice(0, max) : []; }

function selectedCandidate(trace) {
  const selectedId = trace && trace.decision && trace.decision.selectedActionId;
  return list(trace && trace.candidates).find(item => item && item.action && item.action.id === selectedId) || null;
}

function inspectTrace(trace) {
  if (!trace || trace.schema !== 'axm.mirror.trace/v1') throw new Error('typed trace language organ requires axm.mirror.trace/v1');
  if (!trace.traceId || !trace.decision || ![-1, 0, 1].includes(trace.decision.value)) throw new Error('typed trace language organ requires a bounded trace decision');
  const epistemic = trace.epistemic && typeof trace.epistemic === 'object' ? trace.epistemic : {};
  const evidence = list(epistemic.evidence);
  const unknowns = list(epistemic.unknowns);
  const contradictions = list(epistemic.contradictions);
  const selected = selectedCandidate(trace);
  const checks = selected ? list(selected.checks) : list(trace.candidates).flatMap(item => list(item && item.checks));
  const boundaryViolation = checks.some(item => item && item.result === -1);
  const missingEvidence = checks.some(item => item && item.result === 0 && ['truth-before-story', 'source-integrity'].includes(item.root));
  const repairabilityGap = checks.some(item => item && item.result === 0 && item.root === 'repairability');
  const decision = trace.decision.value === 1 ? 'SUPPORTED' : trace.decision.value === 0 ? 'HOLD' : 'REFUSED';
  return {
    traceId: clean(trace.traceId, 160),
    traceDigest: digest(trace),
    decisionValue: trace.decision.value,
    selectedActionId: selected ? clean(selected.action.id, 160) : null,
    selectedActionLabel: selected ? clean(selected.action.label, 600) : null,
    goal: clean(trace.goal && (trace.goal.statement || trace.goal), 1200),
    evidenceCount: evidence.length,
    evidenceIds: evidence.map(item => clean(item && item.id, 160)).filter(Boolean),
    unknownCount: unknowns.length,
    unknownIds: unknowns.map(item => clean(item && item.id, 160)).filter(Boolean),
    contradictionCount: contradictions.length,
    contradictionPairs: contradictions.map(pair => list(pair, 16).map(item => clean(item, 160)).filter(Boolean)),
    features: {
      decision,
      unknowns: unknowns.length ? 'PRESENT' : 'NONE',
      contradictions: contradictions.length ? 'PRESENT' : 'NONE',
      boundaryViolation: boundaryViolation ? 'PRESENT' : 'NONE',
      missingEvidence: missingEvidence ? 'PRESENT' : 'NONE',
      repairabilityGap: repairabilityGap ? 'PRESENT' : 'NONE'
    },
    sourceHumanRenderingRead: false,
    factsPromotedByLanguageBefore: Number(epistemic.factsPromotedByLanguage || 0)
  };
}

function expectedPlan(features) {
  if (features.decision === 'REFUSED') return 'REFUSE_BOUNDARY';
  if (features.decision === 'SUPPORTED') return features.unknowns === 'PRESENT' || features.contradictions === 'PRESENT'
    ? 'SUPPORTED_BOUNDED_UNCERTAIN' : 'SUPPORTED_BOUNDED_CLEAR';
  if (features.contradictions === 'PRESENT') return 'HOLD_CONTRADICTION';
  if (features.missingEvidence === 'PRESENT') return 'HOLD_MISSING_EVIDENCE';
  if (features.repairabilityGap === 'PRESENT') return 'HOLD_REPAIRABILITY';
  return 'HOLD_OPEN_UNCERTAINTY';
}

function sectionText(section, planId, ground) {
  if (section === 'decision') {
    if (planId.startsWith('SUPPORTED_')) return 'The current typed trace supports one supplied action inside its declared bounds; this is not a general guarantee.';
    if (planId.startsWith('HOLD_')) return 'Mirror is holding: the current typed trace does not support a world action.';
    return 'Mirror refuses the supplied action because the typed trace records a hard boundary violation.';
  }
  if (section === 'goal') return `Declared goal: ${quote(ground.goal || 'goal-not-supplied')}.`;
  if (section === 'selected') return ground.selectedActionId
    ? `Supplied action label ${quote(ground.selectedActionLabel || ground.selectedActionId)} has trace id ${quote(ground.selectedActionId)}; naming it does not execute it.`
    : 'No selected supplied action is present in the typed trace.';
  if (section === 'evidence') return `The trace contains ${ground.evidenceCount} attributed evidence record(s); this renderer does not upgrade their status.`;
  if (section === 'uncertainty') {
    if (!ground.unknownCount) return 'No explicit unknown is listed, but absence of a listed unknown is not proof of completeness.';
    return `The trace preserves ${ground.unknownCount} explicit unknown(s): ${ground.unknownIds.map(quote).join(', ')}.`;
  }
  if (section === 'contradictions') {
    if (!ground.contradictionCount) return 'No explicit contradiction pair is listed in this trace.';
    const pairs = ground.contradictionPairs.map(pair => quote(pair.join(' <> '))).join(', ');
    return `The trace preserves ${ground.contradictionCount} unresolved contradiction pair(s): ${pairs}.`;
  }
  if (section === 'boundary') return 'Shadow-language boundary: learned weights changed no fact, decision, permission, tool state, memory, training set, runtime pointer, or world state.';
  throw new Error(`unknown language section ${section}`);
}

function renderPlan(planId, ground) {
  const order = PLAN_ORDER[planId];
  if (!order) throw new Error(`unknown typed trace language plan ${planId}`);
  return {
    planId,
    sectionOrder: order,
    sections: order.map(section => ({ id: section, text: sectionText(section, planId, ground) })),
    text: order.map(section => sectionText(section, planId, ground)).join(' ')
  };
}

function finalize(response) {
  const basis = stable(response);
  delete basis.responseDigest;
  return Object.assign({}, basis, { responseDigest: digest(basis) });
}

function render(trace, model, options = {}) {
  LanguageModel.assertModel(model);
  const ground = inspectTrace(trace);
  const prediction = LanguageModel.predict(model, ground.features);
  const verifierPlanId = expectedPlan(ground.features);
  const compatible = prediction.planId === verifierPlanId;
  const confidenceAccepted = prediction.confidence >= (options.minConfidence == null ? MIN_CONFIDENCE : options.minConfidence) &&
    prediction.margin >= (options.minMargin == null ? MIN_MARGIN : options.minMargin);
  const accepted = compatible && confidenceAccepted;
  const proposal = accepted ? renderPlan(prediction.planId, ground) : null;
  const state = !compatible ? 'HOLD_LEARNED_PLAN_CONTRADICTS_TRACE'
    : !confidenceAccepted ? 'HOLD_LEARNED_PLAN_UNCERTAIN'
      : 'PROPOSED_SHADOW_TRACE_FAITHFUL_RENDERING';
  const response = {
    schema: RESPONSE_SCHEMA,
    responseDigest: null,
    organId: ORGAN_ID,
    state,
    traceId: ground.traceId,
    traceDigest: ground.traceDigest,
    model: {
      schema: model.schema,
      modelDigest: model.modelDigest,
      architecture: model.architecture,
      learnedWeights: true,
      runtimeAuthority: false
    },
    machineGround: ground,
    prediction,
    verifier: {
      expectedPlanId: verifierPlanId,
      planCompatibleWithDecision: compatible,
      confidenceAccepted,
      learnedScoreIsTruthProbability: false,
      sourceHumanRenderingIgnored: true
    },
    proposal,
    fallback: accepted ? null : {
      text: 'Mirror cannot safely render this trace with the current learned surface-plan model. Preserve the typed trace and use the deterministic renderer.',
      reason: !compatible ? 'Learned plan contradicted the hard trace-to-plan verifier.' : 'Learned plan selection was insufficiently discriminated.'
    },
    fidelity: {
      decisionPreserved: true,
      selectedActionPreserved: true,
      unknownCountPreserved: true,
      contradictionCountPreserved: true,
      evidenceCountPreserved: true,
      freeGeneratedFactSlots: 0,
      factsPromotedByLanguage: 0,
      droppedMachineFields: [],
      sourceHumanRenderingRead: false
    },
    authority: {
      activeHumanRendering: false,
      factPromotion: false,
      decisionChange: false,
      permissionGrant: false,
      toolUse: false,
      memoryWrite: false,
      trainingAdmission: false,
      runtimePromotion: false,
      worldAction: false
    },
    boundary: 'A real learned surface-plan classifier proposes ordering for hard-rendered trace facts in shadow mode. It is not a general language model, neutral oracle, decision maker, or runtime renderer.'
  };
  return finalize(response);
}

module.exports = { ORGAN_ID, RESPONSE_SCHEMA, MIN_CONFIDENCE, MIN_MARGIN, PLAN_ORDER, inspectTrace, expectedPlan, renderPlan, render };
