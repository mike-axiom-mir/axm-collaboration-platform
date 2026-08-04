#!/usr/bin/env node
'use strict';
const fs = require('fs');
const Core = require('./discovery-core.js');
const Packs = require('./review-packs.js');
let fails = 0, serial = 0;
function ok(name, pass) { console.log((pass ? 'PASS  ' : 'FAIL  ') + name); if (!pass) fails++; }
function meta(prefix, extra) { serial++; return Object.assign({ now: new Date(Date.parse('2026-07-11T00:00:00.000Z') + serial * 1000).toISOString(), actorId: 'test-user', actorKind: 'HUMAN', recordId: prefix + '-' + serial }, extra || {}); }
function apply(r) { if (!r.ok) { const e = r.errors[0] || {}; throw new Error((e.code || 'transition failed') + (e.message ? ': ' + e.message : '')); } return r.state; }
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');

ok('manifest uses the current product schema', manifest.schema === 'axm.tool-manifest/v1' && manifest.kind === 'product');
ok('manifest and contract permissions agree', JSON.stringify(manifest.permissions) === JSON.stringify(contract.permissions));
ok('contract declares browser-owned resumable lifecycle', JSON.stringify(contract.lifecycle) === JSON.stringify({ state_owner: 'browser', reload: 'resume', disconnect: 'graceful-degrade', cleanup: 'explicit' }));

const seedMeta = { id: 'session-1', now: '2026-07-11T00:00:00.000Z', actorId: 'test-user', actorKind: 'HUMAN' };
const seed = { id: 'session-1', title: 'Any subject', subject: 'local freedom', question: 'What seam is overlooked?', evidenceProfile: 'MIXED', discoveryMode: 'MANUAL' };
const a = Core.createSession(seed, seedMeta), b = Core.createSession(seed, seedMeta);
ok('deterministic session creation', Core.stable(a) === Core.stable(b));
ok('session validates with framed subject', Core.validate(a).ok && Core.validate(a).warnings.length === 0);

const before = Core.stable(a);
let r = Core.recordDiscovery(a, 'knownSpace', { text: 'Existing option requires a full closure day.', claimLabel: 'OBSERVED', source: 'field note' }, meta('known'));
let s = apply(r);
ok('pure transition does not mutate input', Core.stable(a) === before);
ok('human discovery record preserved', s.discovery.knownSpace.length === 1 && s.discovery.knownSpace[0].claimLabel === 'OBSERVED');
ok('append-only event hash advances', s.history.events.length === 2 && !!s.history.lastEventHash);

r = Core.recordDiscovery(s, 'seams', { text: 'AI says a source proves it', claimLabel: 'SOURCE_SUPPORTED' }, meta('ai-note', { actorKind: 'AI', delegated: true, provider: 'bridge' }));
s = apply(r);
ok('unsourced AI claim cannot become source-supported', s.discovery.seams[0].claimLabel === 'HYPOTHESIS');
r = Core.recordDiscovery(s, 'knownSpace', { text: 'AI claims it directly observed a fact.', claimLabel: 'OBSERVED', source: 'model prose' }, meta('ai-observed', { actorKind: 'AI', delegated: true, provider: 'bridge' }));
s = apply(r);
ok('AI prose cannot become observed evidence even with a source lead', s.discovery.knownSpace[s.discovery.knownSpace.length - 1].claimLabel === 'HYPOTHESIS');

r = Core.receiveProposal(s, { task: 'FIND_SEAMS', target: 'seams', text: 'A temporary trust seat between owner and substitute.', provider: 'local' }, meta('proposal', { actorKind: 'AI', provider: 'local' }));
s = apply(r); const proposalId = s.records.proposals[0].id, seamCount = s.discovery.seams.length;
r = Core.decideProposal(s, proposalId, 'REJECT', { reason: 'Too close to an existing staffing agency.' }, meta('reject'));
s = apply(r);
ok('rejected proposal remains preserved', s.records.proposals[0].status === 'REJECTED' && s.records.decisions[0].reason.includes('staffing'));
ok('rejection does not alter discovery records', s.discovery.seams.length === seamCount);

r = Core.receiveProposal(s, { task: 'FIND_SEAMS', target: 'seams', text: 'Owner-freedom coverage built around verified professional trust.', provider: 'bridge' }, meta('proposal2', { actorKind: 'AI', provider: 'bridge' }));
s = apply(r); const p2 = s.records.proposals.find(x => x.status === 'PENDING');
r = Core.decideProposal(s, p2.id, 'ACCEPT', { target: 'seams', claimLabel: 'HYPOTHESIS' }, meta('accept'));
s = apply(r);
ok('accepted proposal keeps provenance and human decision', s.discovery.seams.some(x => x.status === 'HUMAN_APPROVED') && s.records.proposals.find(x => x.id === p2.id).status === 'HUMAN_APPROVED');
let staleState = apply(Core.receiveProposal(s, { task: 'FIND_SEAMS', target: 'seams', text: 'Stale material', provider: 'local' }, meta('stale-proposal', { actorKind: 'AI', provider: 'local' })));
const staleId = staleState.records.proposals.find(x => x.status === 'PENDING').id;
staleState = apply(Core.recordDiscovery(staleState, 'seams', { text: 'State changed after proposal.', claimLabel: 'HYPOTHESIS' }, meta('state-change')));
ok('stale proposal cannot silently enter changed discovery state', Core.decideProposal(staleState, staleId, 'ACCEPT', { target: 'seams' }, meta('stale-accept')).errors[0].code === 'STALE_PROPOSAL');
staleState = apply(Core.decideProposal(staleState, staleId, 'REJECT', { reason: 'No longer relevant after the state change.' }, meta('stale-reject')));
ok('stale proposal can still be rejected and preserved', staleState.records.proposals.find(x => x.id === staleId).status === 'REJECTED');

ok('incomplete candidate is refused', Core.createCandidate(s, { term: 'Only a name' }, meta('bad-candidate')).ok === false);
const candidate = {
  term: 'Trust Relay', summary: 'A bounded substitute relationship.', mechanism: 'A verified practitioner temporarily carries one declared operating role.',
  noveltyStatus: 'UNCHECKED', soulGate: { genuineNeed: 'PASS', nonCommercialWorth: 'PASS', reducesPain: 'PASS', sameGateAccess: 'PASS', avoidsLockIn: 'PASS' },
  minimalForm: 'One owner, one substitute, one shift.', cheapestDisconfirmingCheck: 'Observe whether an owner actually gains a day without hidden management work.', disconfirmingOutcome: 'Owner workload or risk is not reduced.'
};
r = Core.createCandidate(s, candidate, meta('candidate')); s = apply(r); const c1 = s.discovery.activeCandidateId;
r = Core.createCandidate(s, Object.assign({}, candidate, { term: 'Trust Relay v2', supersedes: c1 }), meta('candidate2')); s = apply(r); const c2 = s.discovery.activeCandidateId;
ok('candidate revision creates a new immutable snapshot', s.discovery.candidates.length === 2 && c1 !== c2 && s.discovery.candidates[0].term === 'Trust Relay');
ok('supersedes lineage is explicit', s.discovery.candidates[1].supersedes === c1);
ok('complete Soul gate permits internal review readiness only', s.discovery.candidates[0].status === 'READY_FOR_INTERNAL_REVIEW');

const general = Packs.getPack('general-lab', s.subject.statement, s.subject.evidenceProfile);
const physics = Packs.getPack('physics-stance-forge', 'physics simulation', 'COMPUTATIONAL');
ok('general role pack validates', Packs.validatePack(general).ok && general.roles.length === 11);
ok('physics pack retains all fourteen specialists', Packs.validatePack(physics).ok && physics.roles.length === 14);
ok('physics pack retains six analytic canaries', Array.isArray(physics.permanentControls) && physics.permanentControls.length === 6);
ok('non-physics pack does not inherit physics canaries', !general.permanentControls);
const malformedPack = Core.clone(general); delete malformedPack.roles[0].handoffTo;
ok('core refuses an unvalidated role-pack contract', Core.planAutomation(s, { includeLab: true }, malformedPack, meta('malformed-pack')).errors[0].code === 'ROLE_PACK_INVALID');
let expired = apply(Core.planAutomation(s, { includeLab: false, executors: 'local', expiresAt: '2000-01-01T00:00:00.000Z' }, general, meta('expired-plan')));
const expiredId = expired.lab.automationRuns[expired.lab.automationRuns.length - 1].id;
ok('expiring lease requires a host clock', Core.nextAutomationRequest(expired, expiredId, {}).error.code === 'CLOCK_REQUIRED');
ok('expired lease refuses dispatch', Core.dispatchAutomationRequest(expired, expiredId, meta('expired-dispatch')).errors[0].code === 'LEASE_EXPIRED');

let planned = Core.planAutomation(s, { protocol: 'COMPRESSED_ROLE_REVIEW', executors: 'bridge:claude, bridge:chatgpt, local', cycles: 3, includeLab: true, maxCalls: 56, expiresAt: '2026-07-11T01:00:00.000Z' }, physics, meta('plan'));
let autoState = apply(planned), run = autoState.lab.automationRuns[0];
ok('compressed three-cycle physics review is labelled and planned', run.protocol === 'COMPRESSED_ROLE_REVIEW' && run.steps.length === 56 && run.lease.maxCalls === 56);
ok('provider/model pool rotates without Bridge changes', run.steps[0].executor.aiProvider === 'claude' && run.steps[1].executor.aiProvider === 'chatgpt' && run.steps[2].executor.provider === 'local');
ok('planning performs zero model calls', run.callsUsed === 0 && run.steps.every(x => ['PENDING', 'CONDITIONAL'].includes(x.status)));
const firstReq = Core.nextAutomationRequest(autoState, run.id, { now: '2026-07-11T00:01:00.000Z' });
ok('scheduler preview is not a network action', firstReq.ok && firstReq.preview === true && firstReq.request.callNumber === 1);
let dispatched = Core.dispatchAutomationRequest(autoState, run.id, meta('dispatch'));
autoState = apply(dispatched); run = autoState.lab.automationRuns[0];
ok('call is durably reserved before provider work', run.callsUsed === 1 && run.steps[0].status === 'DISPATCHED' && !!dispatched.request.dispatchToken);
ok('concurrent duplicate dispatch is refused', Core.dispatchAutomationRequest(autoState, run.id, meta('duplicate')).ok === false);
ok('wrong response token is refused', Core.recordAutomationResponse(autoState, run.id, run.steps[0].id, { text: '{}' }, meta('wrong-token', { dispatchToken: 'wrong' })).ok === false);
ok('response cannot be attached to a later undispatched step', Core.recordAutomationResponse(autoState, run.id, run.steps[1].id, { text: '{}' }, meta('out-of-order', { dispatchToken: dispatched.request.dispatchToken })).errors[0].code === 'STEP_NOT_DISPATCHED');
autoState = apply(Core.pauseAutomation(autoState, run.id, 'test pause', meta('pause')));
ok('paused run emits no next request', Core.nextAutomationRequest(autoState, run.id, meta('paused-preview')).error.code === 'RUN_PAUSED');
autoState = apply(Core.resumeAutomation(autoState, run.id, meta('resume')));
ok('interrupted reservation becomes retryable but remains counted', autoState.lab.automationRuns[0].steps[0].status === 'PENDING' && autoState.lab.automationRuns[0].callsUsed === 1);
ok('interrupted reservation remains in append-only attempt history', autoState.lab.automationRuns[0].steps[0].attemptHistory.length === 1 && autoState.lab.automationRuns[0].steps[0].attemptHistory[0].status === 'INTERRUPTED_BEFORE_RESPONSE');

const smallPlan = Core.planAutomation(s, { protocol: 'COMPRESSED_ROLE_REVIEW', executors: 'bridge:claude', cycles: 1, includeLab: true, maxCalls: 26, expiresAt: '2026-07-11T01:00:00.000Z' }, physics, meta('small-plan'));
let t = apply(smallPlan), smallRunId = t.lab.automationRuns[t.lab.automationRuns.length - 1].id;
const discoveryOutput = JSON.stringify({ summary: 'working map', items: [{ text: 'candidate seam', claimLabel: 'HYPOTHESIS', sourceLead: '', rationale: 'test' }], uncertainties: [], nextQuestion: '' });
const candidateOutput = JSON.stringify({ term: 'Boundary Loom', summary: 'A provisional mechanism.', mechanism: 'Makes unowned joins inspectable.', whyNotYet: 'Possibly hidden by ownership boundaries.', viableNowBecause: 'Portable local tools exist.', dependencies: [], noveltyStatus: 'UNCHECKED', soulGate: { genuineNeed: 'PASS', nonCommercialWorth: 'PASS', reducesPain: 'PASS', sameGateAccess: 'PASS', avoidsLockIn: 'PASS', notes: [] }, minimalForm: 'One mapped seam.', cheapestDisconfirmingCheck: 'Find a case where the seam adds no explanatory or practical value.', disconfirmingOutcome: 'No useful difference from existing mapping.', limitations: ['No precedent search performed.'] });
const roleOutput = JSON.stringify({ relevance: 'YES', relevanceReason: 'The jurisdiction applies.', boundary: '', reactivationCondition: '', artifact: 'Specialist artifact with a bounded criticism.', claims: [{ text: 'The candidate remains a hypothesis.', status: 'HYPOTHESIS', evidenceRefs: [] }], contradictions: [], failures: [], veto: { active: false, reason: '' }, nextTest: 'Cheapest disconfirming check.' });
const synthesisOutput = JSON.stringify({ productive: true, survived: ['mechanism'], narrowed: ['scope'], disproven: [], contradictions: [], activeVetoes: [], stanceIntegrity: 'PARTIAL', proposedRevision: 'Narrow the mechanism.', nextHighInformationTest: 'Test one real seam.', limitations: ['Internal review.'] });
const commentaryOutput = JSON.stringify({ whatCaughtMyAttention: 'The join is the unit.', whatIDistrust: 'Novelty is unchecked.', genuineDisagreement: 'Scope remains open.', whatSurvivedPressure: 'The disconfirming test.', whatRealityCouldStillDisprove: 'No useful effect.', nextTestIWouldChoose: 'One bounded field case.' });
let sentinelStep = null, sentinelChecked = false;
while (true) {
  const preview = Core.nextAutomationRequest(t, smallRunId, meta('preview'));
  if (!preview.ok) break;
  const sent = Core.dispatchAutomationRequest(t, smallRunId, meta('dispatch-step')); t = apply(sent);
  const runNow = t.lab.automationRuns.find(x => x.id === smallRunId), step = runNow.steps.find(x => x.id === sent.request.stepId);
  let output = discoveryOutput;
  if (step.kind === 'CANDIDATE_SYNTHESIS') output = candidateOutput;
  if (step.kind === 'ROLE_PASS') output = roleOutput;
  if (step.kind === 'CYCLE_SYNTHESIS') output = synthesisOutput;
  if (step.kind === 'CURATOR_COMMENTARY') output = commentaryOutput;
  if (step.kind === 'ROLE_PASS' && !sentinelStep) { output = roleOutput.replace('Specialist artifact', 'SECRET_ROLE_ONE_SENTINEL'); sentinelStep = step.id; }
  t = apply(Core.recordAutomationResponse(t, smallRunId, step.id, { text: output, provider: 'bridge', model: 'claude' }, meta('response', { actorKind: 'AI', provider: 'bridge', model: 'claude', dispatchToken: sent.request.dispatchToken })));
  if (sentinelStep && !sentinelChecked) {
    const next = Core.nextAutomationRequest(t, smallRunId, meta('handoff-preview'));
    if (next.ok && t.lab.automationRuns.find(x => x.id === smallRunId).steps.find(x => x.id === next.request.stepId).kind === 'ROLE_PASS') {
      ok('shared-context handoff is visible and labelled non-independent', next.request.prompt.includes('SECRET_ROLE_ONE_SENTINEL') && next.request.prompt.includes('shared-context run, not independent'));
      sentinelChecked = true;
    }
  }
}
run = t.lab.automationRuns.find(x => x.id === smallRunId);
ok('compressed run reaches materialization checkpoint honestly', run.status === 'READY_TO_MATERIALIZE' && run.callsUsed === 25 && run.steps.find(x => x.kind === 'SATURATION_DIAGNOSTIC').status === 'SKIPPED_NOT_REQUIRED');
ok('ready checkpoint cannot be stranded by pause', Core.pauseAutomation(t, smallRunId, 'too late to pause', meta('pause-ready')).errors[0].code === 'RUN_AWAITING_MATERIALIZATION');
r = Core.materializeAutomation(t, smallRunId, physics, meta('materialize', { actorKind: 'SYSTEM_DERIVED' })); t = apply(r);
run = t.lab.automationRuns.find(x => x.id === smallRunId);
const draft = t.discovery.candidates.find(x => x.id === run.materializedCandidateId), review = t.lab.reviewRuns.find(x => x.id === run.materializedReviewId);
ok('automation creates an AI draft, never accepted truth', draft.status === 'AI_DRAFT_REQUIRES_REVIEW' && draft.noveltyStatus === 'UNCHECKED');
ok('all fourteen role artifacts materialize with provenance', review.seats.length === 14 && review.seats.every(x => x.artifacts.length === 1));
ok('automated discovery stages enter canonical stage records', Core.STAGES.every(st => t.discovery[st.id].some(x => x.automationRunId === smallRunId)));
ok('candidate and review ids are distinct', draft.id !== review.id);
ok('unrun controls prevent a clean internal-review claim', review.status === 'INTERNAL_REVIEW_WITH_UNRUN_OR_FAILED_CONTROLS' && review.controls.some(x => x.status === 'NOT_RUN'));
ok('single model multi-role is never labelled independent', review.independenceLabel.includes('SINGLE-MODEL') && review.independenceLabel.includes('NOT INDEPENDENT'));
ok('personality commentary cannot support claims', t.records.commentary.length === 1 && t.records.commentary[0].maySupportClaims === false);
ok('automation cannot materialize twice', Core.materializeAutomation(t, smallRunId, physics, meta('again')).ok === false);
ok('materialized session passes nested import validation', Core.validate(t).ok);

let badState = apply(Core.planAutomation(s, { protocol: 'COMPRESSED_ROLE_REVIEW', executors: 'local', cycles: 1, includeLab: false, maxCalls: 9, expiresAt: '2026-07-11T01:00:00.000Z' }, general, meta('bad-plan')));
const badRun = badState.lab.automationRuns[badState.lab.automationRuns.length - 1], badDispatch = Core.dispatchAutomationRequest(badState, badRun.id, meta('bad-dispatch')); badState = apply(badDispatch);
badState = apply(Core.recordAutomationResponse(badState, badRun.id, badDispatch.request.stepId, { text: 'not json', provider: 'local' }, meta('bad-response', { actorKind: 'AI', provider: 'local', dispatchToken: badDispatch.request.dispatchToken })));
ok('malformed model output pauses without laundering an artifact', badState.lab.automationRuns.find(x => x.id === badRun.id).status === 'PAUSED' && Core.materializeAutomation(badState, badRun.id, general, meta('bad-materialize')).ok === false);
badState = apply(Core.resumeAutomation(badState, badRun.id, meta('bad-retry-resume')));
const badRetry = Core.dispatchAutomationRequest(badState, badRun.id, meta('bad-retry-dispatch')); badState = apply(badRetry);
badState = apply(Core.recordAutomationResponse(badState, badRun.id, badRetry.request.stepId, { text: discoveryOutput, provider: 'local' }, meta('bad-retry-response', { actorKind: 'AI', provider: 'local', dispatchToken: badRetry.request.dispatchToken })));
const retriedStep = badState.lab.automationRuns.find(x => x.id === badRun.id).steps[0];
ok('failed and successful retry attempts are both preserved', retriedStep.status === 'COMPLETE' && retriedStep.attemptHistory.length === 2 && retriedStep.attemptHistory[0].status === 'FAILED_SCHEMA_OR_CALL' && retriedStep.attemptHistory[0].output === 'not json' && retriedStep.attemptHistory[1].status === 'COMPLETE');

let emptyStage = apply(Core.planAutomation(s, { protocol: 'COMPRESSED_ROLE_REVIEW', executors: 'local', cycles: 1, includeLab: false, maxCalls: 9, expiresAt: '2026-07-11T01:00:00.000Z' }, general, meta('empty-stage-plan')));
const emptyRun = emptyStage.lab.automationRuns[emptyStage.lab.automationRuns.length - 1], emptyDispatch = Core.dispatchAutomationRequest(emptyStage, emptyRun.id, meta('empty-stage-dispatch')); emptyStage = apply(emptyDispatch);
emptyStage = apply(Core.recordAutomationResponse(emptyStage, emptyRun.id, emptyDispatch.request.stepId, { text: JSON.stringify({ summary: 'empty', items: [], uncertainties: [], nextQuestion: '' }), provider: 'local' }, meta('empty-stage-response', { actorKind: 'AI', provider: 'local', dispatchToken: emptyDispatch.request.dispatchToken })));
ok('empty discovery stage fails schema and cannot become canonical done', emptyStage.lab.automationRuns.find(x => x.id === emptyRun.id).status === 'PAUSED' && emptyStage.lab.automationRuns.find(x => x.id === emptyRun.id).steps[0].status === 'FAILED_SCHEMA_OR_CALL');

let fullState = apply(Core.planAutomation(s, { protocol: 'FULL_EVIDENCE_LOOP', executors: 'bridge:claude', cycles: 1, includeLab: true, maxCalls: 54, expiresAt: '2026-07-11T01:00:00.000Z' }, physics, meta('full-plan')));
const fullRunId = fullState.lab.automationRuns[fullState.lab.automationRuns.length - 1].id;
run = fullState.lab.automationRuns.find(x => x.id === fullRunId);
ok('full evidence protocol includes the 21-step disciplines and a real evidence gate', run.protocol === 'FULL_EVIDENCE_LOOP' && run.steps.length === 55 && run.lease.maxCalls === 54 && run.steps.some(x => x.kind === 'MANUAL_EVIDENCE_GATE'));
function outputFor(step) {
  if (step.kind === 'DISCOVERY_PASS') return discoveryOutput;
  if (step.kind === 'CANDIDATE_SYNTHESIS') return candidateOutput;
  if (['ROLE_PASS', 'PRECHECK_ROLE_PASS', 'RESULT_ROLE_PASS'].includes(step.kind)) return roleOutput;
  if (step.kind === 'CYCLE_SYNTHESIS') return synthesisOutput;
  if (step.kind === 'CURATOR_COMMENTARY') return commentaryOutput;
  if (step.kind === 'FRONTIER_FRAME') return JSON.stringify({ artifact: 'Scoped frontier record.', frontier: 'Test one bounded seam.', requirements: ['preserve failures'], exclusions: ['no readiness claim'], exactClaimBoundary: 'Internal experimental result only.', unknowns: ['field transfer'] });
  if (step.kind === 'CONTRADICTION_MAP') return JSON.stringify({ artifact: 'Contradiction map.', contradictions: [{ a: 'seam matters', b: 'seam is incidental', discriminatingObservation: 'field effect' }], sharedUnsupportedBeliefs: [], openQuestions: ['Does the effect repeat?'] });
  if (step.kind === 'EXPERIMENT_SELECTION') return JSON.stringify({ artifact: 'High-information experiment choice.', question: 'Does the seam change the outcome?', competingExplanations: ['causal seam', 'incidental correlation'], selectedExperiment: 'One bounded comparison.', informationGainReason: 'Separates the explanations.', costRisk: 'Low-cost local observation.', rejectedExperiments: [] });
  if (step.kind === 'PREDECLARATION') return JSON.stringify({ artifact: 'Locked predeclaration.', question: 'Does the seam change the outcome?', hypotheses: ['The seam causes a measurable difference.'], control: 'Matched case without the seam.', metrics: ['observable difference'], thresholds: ['difference must be preserved in raw output'], expectedFailures: ['no discriminating observation'], disconfirmingOutcome: 'No difference under the declared comparison.', amendments: [] });
  if (step.kind === 'TARGETED_RESEARCH') return JSON.stringify({ artifact: 'Targeted research boundary.', missingKnowledge: ['one relevant precedent'], sourceLeads: [], remainingUnknowns: ['external transfer'] });
  if (step.kind === 'IMPLEMENTATION_PLAN') return JSON.stringify({ artifact: 'Bounded implementation plan.', boundedImplementation: 'One disposable local comparison.', inputs: ['declared case'], outputs: ['raw observation'], commandsOrProcedure: ['run the declared comparison'], dependencies: [], notExecuted: true });
  if (step.kind === 'PROVENANCE_PLAN') return JSON.stringify({ artifact: 'Provenance contract.', requiredProvenance: ['input', 'procedure', 'time', 'raw output'], rawVsProcessedBoundary: 'Raw observation remains unchanged.', resumePoint: 'evidence gate', lineageRisks: ['manual transcription'] });
  if (step.kind === 'CONTROL_PLAN') return JSON.stringify({ artifact: 'Exact frozen control plan.', controls: step.controlCatalog.map(c => ({ id: c.id, procedure: 'Execute ' + c.requirement, expected: 'Preserved result for ' + c.id, status: 'PLANNED_NOT_RUN' })), blockingUnknowns: [] });
  if (step.kind === 'FAILURE_ATTACK') return JSON.stringify({ artifact: 'Adversarial failure pass.', attacks: ['challenge strongest success'], preservedFailures: [], alternativeExplanations: ['measurement artifact'], thresholdDriftFound: false, nextAdversarialCheck: 'Repeat the edge case.' });
  if (step.kind === 'CLAIM_REVIEW') return JSON.stringify({ artifact: 'Internal claim review.', claims: [{ claim: 'One observation exists.', status: 'OBSERVED', evidenceRefs: ['manual-test-output-001'], limits: ['single case'] }], unsupportedClaims: [], sourceConflicts: [] });
  if (step.kind === 'STANCE_REVIEW') return JSON.stringify({ artifact: 'Stance-integrity review.', stanceIntegrity: 'PARTIAL', uniqueContributions: ['bounded method differences'], duplicates: [], boundaryViolations: [], orderEffects: [], externalReviewNeeded: true });
  if (step.kind === 'PRODUCTIVITY_CLASSIFICATION') return JSON.stringify({ artifact: 'Productivity classified from recorded work.', productive: true, productiveBecause: ['uncertainty narrowed'], unproductiveBecause: [], survivingFragment: 'bounded mechanism', nextFrontier: 'field test', exactResumePoint: 'cycle complete' });
  if (step.kind === 'SATURATION_DIAGNOSTIC') return JSON.stringify({ artifact: 'Saturation diagnostic.', diagnosis: 'SATURATED', reasons: ['no productive frontier'], reactivationCondition: 'new evidence arrives', honestStop: true });
  throw new Error('No test output contract for ' + step.kind);
}
let evidenceBlocked = false, mandatorySchemaChecked = false, exactCatalogChecked = false;
while (true) {
  const preview = Core.nextAutomationRequest(fullState, fullRunId, meta('full-preview'));
  if (!preview.ok) { evidenceBlocked = preview.error.code === 'EVIDENCE_REQUIRED'; break; }
  const sent = Core.dispatchAutomationRequest(fullState, fullRunId, meta('full-dispatch')); fullState = apply(sent);
  const step = fullState.lab.automationRuns.find(x => x.id === fullRunId).steps.find(x => x.id === sent.request.stepId);
  if (step.kind === 'PREDECLARATION' && !mandatorySchemaChecked) {
    const shell = Core.recordAutomationResponse(fullState, fullRunId, step.id, { text: JSON.stringify({ artifact: 'empty shell' }), provider: 'bridge', model: 'claude' }, meta('shell-response', { actorKind: 'AI', provider: 'bridge', model: 'claude', dispatchToken: sent.request.dispatchToken }));
    mandatorySchemaChecked = shell.ok && shell.state.lab.automationRuns.find(x => x.id === fullRunId).steps.find(x => x.id === step.id).status === 'FAILED_SCHEMA_OR_CALL';
  }
  if (step.kind === 'CONTROL_PLAN') exactCatalogChecked = step.controlCatalog.every(c => sent.request.prompt.includes(c.id) && sent.request.prompt.includes(c.requirement));
  fullState = apply(Core.recordAutomationResponse(fullState, fullRunId, step.id, { text: outputFor(step), provider: 'bridge', model: 'claude' }, meta('full-response', { actorKind: 'AI', provider: 'bridge', model: 'claude', dispatchToken: sent.request.dispatchToken })));
}
ok('full loop stops instead of faking executed evidence', evidenceBlocked === true);
ok('mandatory full-step schema rejects artifact-only shells', mandatorySchemaChecked);
ok('control planner receives the exact frozen control and canary catalog', exactCatalogChecked);
ok('observed evidence without a source is refused', Core.recordAutomationEvidence(fullState, fullRunId, { text: 'it happened', claimLabel: 'OBSERVED' }, meta('weak-evidence')).ok === false);
let cancelledAtGate = apply(Core.cancelAutomation(fullState, fullRunId, 'cancel before evidence', meta('cancel-at-gate')));
ok('cancelled run refuses later evidence mutation', Core.recordAutomationEvidence(cancelledAtGate, fullRunId, { text: 'late evidence', claimLabel: 'BLOCKED' }, meta('late-evidence')).errors[0].code === 'RUN_CLOSED');
fullState = apply(Core.recordAutomationEvidence(fullState, fullRunId, { text: 'Bounded manual test produced one preserved observation.', claimLabel: 'OBSERVED', source: 'manual-test-output-001', limitations: ['single case'] }, meta('evidence')));
fullState = apply(Core.resumeAutomation(fullState, fullRunId, meta('full-resume')));
while (true) {
  const preview = Core.nextAutomationRequest(fullState, fullRunId, meta('full-preview-2'));
  if (!preview.ok) break;
  const sent = Core.dispatchAutomationRequest(fullState, fullRunId, meta('full-dispatch-2')); fullState = apply(sent);
  const step = fullState.lab.automationRuns.find(x => x.id === fullRunId).steps.find(x => x.id === sent.request.stepId);
  fullState = apply(Core.recordAutomationResponse(fullState, fullRunId, step.id, { text: outputFor(step), provider: 'bridge', model: 'claude' }, meta('full-response-2', { actorKind: 'AI', provider: 'bridge', model: 'claude', dispatchToken: sent.request.dispatchToken })));
}
run = fullState.lab.automationRuns.find(x => x.id === fullRunId);
ok('full evidence loop reaches an honest draft checkpoint', run.status === 'READY_TO_MATERIALIZE' && run.evidence.length === 1 && run.callsUsed === 53);
fullState = apply(Core.materializeAutomation(fullState, fullRunId, physics, meta('full-materialize', { actorKind: 'SYSTEM_DERIVED' })));
const fullReview = fullState.lab.reviewRuns.find(x => x.id === fullState.lab.automationRuns.find(x => x.id === fullRunId).materializedReviewId);
ok('full loop preserves precheck/result cycle lineage', fullReview.seats.some(x => x.artifacts.some(a => a.automationRunId === fullRunId && a.cycle === 1)) && fullReview.cycleSyntheses.length >= 3);
ok('executed evidence remains separate from model claims', fullState.records.evidence.some(x => x.runId === fullRunId && x.source === 'manual-test-output-001'));

let contextState = apply(Core.planAutomation(s, { protocol: 'FULL_EVIDENCE_LOOP', executors: 'local', cycles: 2, includeLab: true, expiresAt: '2026-07-11T01:00:00.000Z' }, general, meta('context-plan')));
const contextId = contextState.lab.automationRuns[contextState.lab.automationRuns.length - 1].id, contextRun = contextState.lab.automationRuns.find(x => x.id === contextId);
const cycle2Frontier = contextRun.steps.find(x => x.kind === 'FRONTIER_FRAME' && x.cycle === 2), cycle1Productivity = contextRun.steps.find(x => x.kind === 'PRODUCTIVITY_CLASSIFICATION' && x.cycle === 1);
for (const step of contextRun.steps) if (contextRun.steps.indexOf(step) < contextRun.steps.indexOf(cycle2Frontier)) step.status = 'SKIPPED_NOT_REQUIRED';
cycle1Productivity.status = 'COMPLETE'; cycle1Productivity.output = JSON.stringify({ artifact: 'PRIOR_CYCLE_SENTINEL', productive: true, productiveBecause: ['new evidence'], unproductiveBecause: [], survivingFragment: 'fragment', nextFrontier: 'next', exactResumePoint: 'cycle 2' });
contextRun.status = 'RUNNING';
const contextPreview = Core.nextAutomationRequest(contextState, contextId, meta('context-preview'));
ok('cycle two frontier receives prior shared checkpoint context', contextPreview.ok && contextPreview.request.stepId === cycle2Frontier.id && contextPreview.request.prompt.includes('PRIOR_CYCLE_SENTINEL'));

let manual = Core.startReview(s, c2, general, { executors: 'human' }, meta('manual-review'));
let ms = apply(manual), manualReview = ms.lab.reviewRuns[ms.lab.reviewRuns.length - 1], roleId = manualReview.seats[0].roleId;
ok('NO relevance requires honest abstention detail', Core.recordRoleRelevance(ms, manualReview.id, roleId, 'NO', { reason: 'outside scope' }, meta('bad-no')).ok === false);
ms = apply(Core.recordRoleRelevance(ms, manualReview.id, roleId, 'NO', { reason: 'outside scope', reactivationCondition: 'scope changes' }, meta('good-no')));
ok('abstained role cannot invent an artifact', Core.recordRoleArtifact(ms, manualReview.id, roleId, { artifact: 'should fail' }, meta('bad-artifact')).ok === false);
ok('manual review path emits no AI request', !Core.stable(ms).includes('AI_REQUEST'));
ok('executed control cannot pass without evidence', Core.recordControlResult(ms, manualReview.id, manualReview.controls[0].id, 'PASS', '', meta('empty-control')).ok === false);
const manualControlId = manualReview.controls[0].id;
ms = apply(Core.recordControlResult(ms, manualReview.id, manualControlId, 'FAIL', 'preserved failing control output', meta('control-fail')));
ms = apply(Core.recordControlResult(ms, manualReview.id, manualControlId, 'PASS', 'later passing control output', meta('control-pass-revision')));
const manualControl = ms.lab.reviewRuns.find(x => x.id === manualReview.id).controls.find(x => x.id === manualControlId);
ok('control corrections append revisions instead of erasing failure evidence', manualControl.status === 'PASS' && manualControl.history.length === 2 && manualControl.history[0].status === 'FAIL' && manualControl.history[0].evidence.includes('failing'));

let noReview = apply(Core.startReview(s, c2, general, { executors: 'human' }, meta('all-no-review'))), noId = noReview.lab.reviewRuns[noReview.lab.reviewRuns.length - 1].id;
for (const seat of noReview.lab.reviewRuns.find(x => x.id === noId).seats) noReview = apply(Core.recordRoleRelevance(noReview, noId, seat.roleId, 'NO', { reason: 'outside this candidate', reactivationCondition: 'candidate scope expands' }, meta('all-no')));
for (const control of noReview.lab.reviewRuns.find(x => x.id === noId).controls) noReview = apply(Core.recordControlResult(noReview, noId, control.id, 'PASS', 'manual control evidence', meta('control-pass')));
noReview = apply(Core.completeReview(noReview, noId, 'Everyone abstained.', meta('all-no-complete')));
ok('all-abstain team cannot become internally reviewed', noReview.lab.reviewRuns.find(x => x.id === noId).status === 'INSUFFICIENT_SUBSTANTIVE_REVIEW');

let closed = apply(Core.planAutomation(s, { protocol: 'COMPRESSED_ROLE_REVIEW', executors: 'local', cycles: 1, includeLab: false, maxCalls: 9, expiresAt: '2026-07-11T01:00:00.000Z' }, general, meta('closed-plan'))), closedId = closed.lab.automationRuns[closed.lab.automationRuns.length - 1].id;
closed = apply(Core.cancelAutomation(closed, closedId, 'test close', meta('closed-cancel')));
ok('cancelled automation cannot be reopened by core caller', Core.resumeAutomation(closed, closedId, meta('closed-resume')).errors[0].code === 'RUN_CLOSED');

const report = Core.buildReport(t, true);
ok('report carries internal-review and no-fake-done boundaries', report.includes('not canon, certification, or independent validation') && report.includes('Model output is not evidence by itself'));
ok('report exposes stored professional claims, failures and next tests for audit', report.includes('Claim [HYPOTHESIS]') && report.includes('Next test:'));
const controlHistoryReport = Core.buildReport(ms, false, { reviewId: manualReview.id });
ok('report exposes corrected control revision history', controlHistoryReport.includes('Revision 1 [FAIL]') && controlHistoryReport.includes('Revision 2 [PASS]'));
const bundle = Core.exportBundle(t);
ok('portable bundle fingerprints exact state', bundle.schema === 'axm.discovery-lab.bundle/0.1' && bundle.exportedStateFingerprint === Core.fingerprint(bundle.session));
const malformedImport = Core.clone(t); malformedImport.discovery.candidates.push({ id: 'broken-candidate' });
ok('import validation rejects malformed nested candidate state', Core.validate(malformedImport).ok === false);
const malformedArtifactImport = Core.clone(t); malformedArtifactImport.lab.reviewRuns[0].seats[0].artifacts[0].claims = 'not-an-array';
ok('import validation rejects malformed nested professional artifacts', Core.validate(malformedArtifactImport).ok === false);
const coreSource = fs.readFileSync(require.resolve('./discovery-core.js'), 'utf8');
ok('pure core contains no fetch or filesystem execution', !/\bfetch\s*\(/.test(coreSource) && !/require\s*\(\s*['"]fs['"]/.test(coreSource));

console.log('\nAXM DISCOVERY ENGINE SELFTEST — ' + fails + ' FAIL');
process.exitCode = fails ? 1 : 0;
