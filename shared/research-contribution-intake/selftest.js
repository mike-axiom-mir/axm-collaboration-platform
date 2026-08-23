#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Intake = require('./research-contribution-intake');
const contract = require('./module.contract.json');

let checks = 0;
function check(condition, message) {
  checks += 1;
  assert.ok(condition, message);
}

function rejects(mutator, pattern, message) {
  const input = validInput();
  mutator(input);
  checks += 1;
  assert.throws(() => Intake.buildAssessment(input), pattern, message);
}

check(contract.version === 'v0.2' && contract.status === 'TEST' && contract.consumes.includes('strict-deterministic-canonical-json') && contract.boundaries.refuses.includes('undefined-or-non-json-representable-state'), 'v0.2 contract declares strict representation closure');
check(Intake.stableStringify({ z: 1, a: [true, null] }) === '{"a":[true,null],"z":1}', 'safe canonical bytes remain exact');
assert.throws(() => Intake.stableStringify({ lost: undefined }), /unsupported undefined/i);
checks += 1;

function ref(id, schema, bytes) {
  return { id, schema, sha256: Intake.sha256(Buffer.from(bytes, 'utf8')) };
}

function truth() {
  return {
    artifactBytesEmbedded: false,
    packageCodeExecuted: false,
    modelInvoked: false,
    crossModelAgreementIsProof: false,
    automaticAcceptance: false,
    automaticBuild: false,
    automaticPromotion: false,
    automaticCanon: false
  };
}

function validInput() {
  const provenance = ref('provenance:user-report', 'axm.research-seat-provenance/v1', 'seat provenance');
  return {
    assessmentId: 'assessment:fixture-research-contribution',
    generatedAt: '2026-08-19T17:05:00.000Z',
    bundle: {
      schema: Intake.BUNDLE_SCHEMA,
      version: Intake.VERSION,
      bundleId: 'bundle:fixture-research-contribution',
      baselineRef: ref('baseline:fixture', 'axm.portable-baseline-capsule/v1', 'baseline'),
      sourceHandling: 'DATA_ONLY_NO_PACKAGE_CODE_EXECUTION',
      artifacts: [
        {
          id: 'research:artifact-b', label: 'Artifact B', mediaType: 'application/zip',
          bytes: 22, sha256: Intake.sha256(Buffer.from('artifact-b')), reportedSeatIds: []
        },
        {
          id: 'research:artifact-a', label: 'Artifact A', mediaType: 'text/plain',
          bytes: 10, sha256: Intake.sha256(Buffer.from('artifact-a')), reportedSeatIds: ['seat:model-a']
        }
      ],
      seats: [
        {
          id: 'seat:model-b', kind: 'MODEL', role: 'reported contributor', providerFamily: 'Provider B',
          modelId: null, identityDisclosure: 'PARTIAL', priorOutputExposure: 'UNKNOWN',
          provenanceRef: provenance, proofAuthority: 'NONE'
        },
        {
          id: 'seat:curator', kind: 'TOOL', role: 'bounded signal curator', providerFamily: 'Local tool',
          modelId: null, identityDisclosure: 'EXACT', priorOutputExposure: 'FULL',
          provenanceRef: ref('tool:curator', 'text/javascript', 'curator'), proofAuthority: 'NONE'
        },
        {
          id: 'seat:model-a', kind: 'MODEL', role: 'reported contributor', providerFamily: 'Provider A',
          modelId: 'model-a-v1', identityDisclosure: 'EXACT', priorOutputExposure: 'NONE',
          provenanceRef: provenance, proofAuthority: 'NONE'
        }
      ],
      evidenceSources: [
        {
          id: 'evidence:current-capability-check',
          ref: ref('audit:current-capability-check', 'axm.evidence-receipt/v2', 'evidence receipt'),
          surface: 'focused-execution',
          claimKinds: ['deterministic behavior', 'existence']
        }
      ],
      signals: [
        {
          id: 'signal:simulated-option', statement: 'A simulated option may merit a bounded test.',
          evidenceStage: 'SIMULATED', artifactIds: ['research:artifact-b'], evidenceSourceIds: [],
          seatIds: ['seat:model-b'], cheapestTest: 'Run a held-out positive and negative case.',
          uncertainty: 'The option has not been executed.', solutionAlternatives: ['Keep the current capability.'],
          contradictions: ['A current provider may already close the gap.'], wildcard: false
        },
        {
          id: 'signal:observed-reuse', statement: 'The current capability already closes the exact structural gap.',
          evidenceStage: 'OBSERVED', artifactIds: ['research:artifact-a'],
          evidenceSourceIds: ['evidence:current-capability-check'], seatIds: ['seat:curator'],
          cheapestTest: 'Rebuild the existing receipt and reject a changed input.',
          uncertainty: 'Runtime scope outside the receipt remains unknown.',
          solutionAlternatives: ['Build a versioned adapter only if the existing contract is incompatible.'],
          contradictions: [], wildcard: false
        }
      ],
      proposals: [
        {
          id: 'proposal:automatic-builder', statement: 'Let the research feed build automatically.',
          disposition: 'REJECTED', reason: 'Research inputs grant no execution or promotion authority.',
          artifactIds: ['research:artifact-b'], evidenceSourceIds: [], seatIds: ['seat:curator']
        },
        {
          id: 'proposal:bounded-adapter', statement: 'Plan a bounded adapter if exact incompatibility is proven.',
          disposition: 'DEFERRED', reason: 'No exact contract incompatibility has been proven.',
          artifactIds: ['research:artifact-a'], evidenceSourceIds: ['evidence:current-capability-check'],
          seatIds: ['seat:curator']
        }
      ],
      truth: truth()
    }
  };
}

const input = validInput();
const assessment = Intake.buildAssessment(input);

check(assessment.schema === Intake.ASSESSMENT_SCHEMA && assessment.version === Intake.VERSION, 'assessment uses the declared schema and version');
check(assessment.state === 'READY_FOR_BASELINE_SIMULATION_PLANNING', 'valid contribution is ready only for lab planning');
check(Intake.verifyAssessment(assessment).pass, 'assessment exact-rebuild verification passes');
check(assessment.counts.artifacts === 2 && assessment.counts.modelSeats === 2, 'assessment counts artifacts and model seats');
check(assessment.counts.retainedSignals === 2 && assessment.counts.proposals === 2, 'assessment counts retained signals and proposals');
check(assessment.attributionAssessment.artifactToSeatMappingEstablished === false, 'partial artifact mapping remains unestablished');
check(assessment.attributionAssessment.crossModelIndependenceEstablished === false, 'partial identity and exposure do not establish independence');
check(assessment.attributionAssessment.modelAgreementIsProof === false, 'model agreement never becomes proof');
check(assessment.warnings.some(item => item.code === 'ARTIFACT_TO_SEAT_MAPPING_NOT_ESTABLISHED'), 'unassigned artifacts produce a visible warning');
check(assessment.warnings.some(item => item.code === 'MODEL_IDENTITY_DISCLOSURE_GAP'), 'partial model identity produces a visible warning');
check(assessment.warnings.some(item => item.code === 'PRIOR_OUTPUT_EXPOSURE_NOT_EXCLUDED'), 'unknown output exposure produces a visible warning');
check(assessment.warnings.some(item => item.code === 'CROSS_MODEL_INDEPENDENCE_NOT_ESTABLISHED'), 'common-mode independence warning is explicit');
check(assessment.projection.schema === Intake.PROJECTION_SCHEMA, 'assessment emits the declared simulation planning projection');
check(assessment.projection.newInformationRefs.length === 2 && assessment.projection.evidenceSourceRefs.length === 1, 'projection separates new information from evidence sources');
check(assessment.projection.signals.every(item => item.truthWeight === 'NONE'), 'projected signals carry no truth weight');
check(assessment.projection.truth.baselineRunBuilt === false && assessment.projection.truth.evidenceReceiptBuilt === false, 'projection does not pretend a lab or evidence receipt exists');
check(assessment.projection.truth.readyToExecute === false && assessment.projection.truth.automaticAction === false, 'projection grants no execution or automation');
check(assessment.bundle.signals.find(item => item.id === 'signal:simulated-option').contradictions.length === 1, 'signal contradiction is preserved');
check(assessment.bundle.proposals.find(item => item.id === 'proposal:automatic-builder').disposition === 'REJECTED', 'rejected proposal disposition is preserved');
check(assessment.truth.learningImprovementProven === false && assessment.truth.humanBenefitProven === false, 'intake proves neither learning nor human benefit');
check(assessment.truth.automaticBuild === false && assessment.truth.automaticPromotion === false && assessment.truth.automaticCanon === false, 'intake grants no build promotion or CANON authority');

const reordered = validInput();
reordered.bundle.artifacts.reverse();
reordered.bundle.seats.reverse();
reordered.bundle.signals.reverse();
reordered.bundle.proposals.reverse();
const reorderedAssessment = Intake.buildAssessment(reordered);
check(reorderedAssessment.receiptDigest === assessment.receiptDigest, 'input ordering does not change the semantic assessment');

const held = validInput();
held.bundle.signals.find(item => item.id === 'signal:observed-reuse').evidenceSourceIds = [];
const heldAssessment = Intake.buildAssessment(held);
check(heldAssessment.state === 'HELD_FOR_EVIDENCE_REPAIR', 'OBSERVED without separate evidence is held');
check(heldAssessment.holds.some(item => item.code === 'OBSERVED_SIGNAL_NATIVE_EVIDENCE_MISSING'), 'missing native evidence hold names the signal');
check(Intake.verifyAssessment(heldAssessment).pass, 'held assessment still exact-rebuild verifies');

const exact = validInput();
exact.bundle.artifacts.find(item => item.id === 'research:artifact-b').reportedSeatIds = ['seat:model-b'];
const modelB = exact.bundle.seats.find(item => item.id === 'seat:model-b');
modelB.modelId = 'model-b-v1';
modelB.identityDisclosure = 'EXACT';
modelB.priorOutputExposure = 'NONE';
const exactAssessment = Intake.buildAssessment(exact);
check(exactAssessment.attributionAssessment.artifactToSeatMappingEstablished === true, 'complete reported mapping is recognized');
check(exactAssessment.attributionAssessment.exactModelIdentityEstablished === true, 'exact model identity is recognized');
check(exactAssessment.attributionAssessment.priorOutputIsolationEstablished === true, 'declared no-prior-output exposure is recognized');
check(exactAssessment.attributionAssessment.crossModelIndependenceEstablished === true, 'all three declared independence conditions are required');
check(!exactAssessment.warnings.some(item => item.code === 'CROSS_MODEL_INDEPENDENCE_NOT_ESTABLISHED'), 'established fixture removes the independence warning');

const unattributed = validInput();
unattributed.bundle.signals.find(item => item.id === 'signal:simulated-option').seatIds = [];
const unattributedAssessment = Intake.buildAssessment(unattributed);
check(unattributedAssessment.warnings.some(item => item.code === 'SIGNAL_ATTRIBUTION_MISSING'), 'missing signal attribution stays visible');
check(unattributedAssessment.state === 'READY_FOR_BASELINE_SIMULATION_PLANNING', 'attribution uncertainty warns without manufacturing a blocker');

const tamperedState = JSON.parse(JSON.stringify(assessment));
tamperedState.state = 'WORKING';
check(!Intake.verifyAssessment(tamperedState).pass, 'derived-state tampering fails verification');
const tamperedDigest = JSON.parse(JSON.stringify(assessment));
tamperedDigest.receiptDigest = Intake.sha256(Buffer.from('tampered'));
check(!Intake.verifyAssessment(tamperedDigest).pass, 'receipt-digest tampering fails verification');

rejects(value => { value.bundle.sourceHandling = 'EXECUTE_PACKAGES'; }, /sourceHandling/, 'package execution policy is refused');
rejects(value => { value.bundle.truth.packageCodeExecuted = true; }, /must be false/, 'executed package claim is refused');
rejects(value => { value.bundle.truth.crossModelAgreementIsProof = true; }, /must be false/, 'agreement-as-proof claim is refused');
rejects(value => { value.bundle.seats[0].proofAuthority = 'TRUTH'; }, /proofAuthority must be NONE/, 'seat proof authority is refused');
rejects(value => { value.bundle.signals[0].evidenceStage = 'PROVEN'; }, /evidenceStage is unsupported/, 'unsupported signal promotion is refused');
rejects(value => { value.bundle.signals[0].artifactIds = ['research:missing']; }, /unknown artifact/, 'unknown artifact source is refused');
rejects(value => { value.bundle.signals[0].evidenceSourceIds = ['evidence:missing']; }, /unknown evidence source/, 'unknown evidence source is refused');
rejects(value => { value.bundle.signals[0].seatIds = ['seat:missing']; }, /unknown seat/, 'unknown signal seat is refused');
rejects(value => { value.bundle.artifacts[0].reportedSeatIds = ['seat:missing']; }, /unknown seat/, 'unknown artifact seat is refused');
rejects(value => { value.bundle.artifacts.push(JSON.parse(JSON.stringify(value.bundle.artifacts[0]))); }, /duplicate ids/, 'duplicate artifact ids are refused');
rejects(value => { value.bundle.signals[0].artifactIds = []; value.bundle.signals[0].evidenceSourceIds = []; }, /needs an artifact or evidence source/, 'source-free signal is refused');
rejects(value => { value.bundle.proposals[0].disposition = 'ACCEPTED_AS_TRUTH'; }, /disposition is unsupported/, 'proposal truth promotion is refused');
rejects(value => { value.bundle.extraAuthority = true; }, /unsupported field/, 'undeclared bundle authority field is refused');

process.stdout.write('research-contribution-intake selftest: ' + checks + ' checks passed\n');
