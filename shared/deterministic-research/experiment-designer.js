'use strict';

const Core = require('./core');
const EvidenceRouter = require('../ai-native-hands/evidence-router-hand');

const KIND = { HAND: 'behavior', SKILL: 'quality', AUTHORITY: 'authorization', SUBSTRATE: 'performance', EVIDENCE: 'behavior', CONTRACT: 'transport', UNKNOWN: 'existence' };
function passCondition(gap) {
  if (gap.gapType === 'AUTHORITY') return 'A named steward records an explicit scoped decision; machinery cannot self-authorize.';
  if (gap.gapType === 'CONTRACT') return 'A versioned sender fixture and receiver fixture exchange the exact payload with matching digest and reject an incompatible version.';
  if (gap.gapType === 'SUBSTRATE') return 'The declared workload stays inside the named resource budget and the boundary case fails visibly.';
  if (gap.gapType === 'EVIDENCE') return 'The native verifier reaches a reproducible PASS or FAIL on a known positive and known negative fixture.';
  if (gap.gapType === 'SKILL') return 'The procedure passes held-out positive and negative cases without access to expected answers.';
  return 'A bounded implementation provides ' + gap.capabilityId + ' through its declared contract, passes a positive fixture, and rejects a negative fixture.';
}
function design(gaps, questions, hypotheses) {
  const questionByGap = new Map(questions.map(item => [item.gapId, item]));
  const hypothesisByGap = new Map(hypotheses.map(item => [item.gapId, item]));
  return gaps.map(gap => {
    const condition = passCondition(gap);
    const route = EvidenceRouter.route({
      id: Core.id('claim', gap.id),
      claim: gap.capabilityId + ' closes gap ' + gap.id + ' for its declared scope.',
      kind: KIND[gap.gapType] || 'behavior',
      risk: gap.required ? 'high' : 'medium',
      passCondition: condition
    });
    return {
      schema: 'axm.research-experiment-plan/v1',
      id: Core.id('experiment', { gap: gap.id, route: route.primarySurface }),
      gapId: gap.id,
      questionId: questionByGap.get(gap.id).id,
      hypothesisId: hypothesisByGap.get(gap.id).id,
      claim: route,
      procedure: [
        'Freeze the exact input, capability contract, version, and expected boundary.',
        'Run the primary proof surface: ' + route.primarySurface + '.',
        'Run one counterexample intended to produce: ' + route.counterevidence + '.',
        gap.required ? 'Run the independent surface: ' + route.secondarySurface + '.' : 'Escalate to the secondary surface only if evidence conflicts.'
      ],
      expectedArtifacts: ['typed-observation-receipt', 'input-digest', 'output-or-failure-digest'],
      executionMode: gap.gapType === 'AUTHORITY' ? 'STEWARD_DECISION' : 'BUILDER_EXECUTABLE',
      verdict: 'UNTESTED',
      automaticExecution: false
    };
  });
}

module.exports = { design };
