'use strict';

const assert = require('assert');
const path = require('path');
const Fabric = require('./identity-shell-fabric');
const Independent = require('./independent-verifier');

const FIXTURES = path.join(__dirname, 'fixtures');
const blueprint = require(path.join(FIXTURES, 'blueprints', 'sample-portable-shell.blueprint.json'));
const adapter = require(path.join(FIXTURES, 'adapters', 'neutral-neural-alpha.adapter.json'));
const body = require(path.join(FIXTURES, 'bodies', 'software-workspace.body.json'));
let assertions = 0;

function copy(value) { return Fabric.clone(value); }
function ref(id, schema, seed) { return { id, schema, sha256: Fabric.sha256(seed) }; }
function parentRef(manifest) { return { id: manifest.shellId, schema: manifest.schema, sha256: manifest.manifestDigest }; }
function ok(condition, label) { assert.ok(condition, label); assertions += 1; }
function equal(actual, expected, label) { assert.strictEqual(actual, expected, label); assertions += 1; }
function expectCode(code, operation, label) {
  let observed = null;
  try { operation(); } catch (error) { observed = error.code || error.name; }
  equal(observed, code, label);
}

function compile(selectedBlueprint, extra = {}) {
  return Fabric.compileShell({
    blueprint: selectedBlueprint,
    descriptors: [copy(adapter), copy(body)],
    parentManifests: extra.parentManifests || [],
    continuityReceipts: extra.continuityReceipts || [],
    humanDecisionReceipts: extra.humanDecisionReceipts || []
  });
}

function resign(value, digestKey) {
  const payload = copy(value);
  delete payload[digestKey];
  value[digestKey] = Fabric.sha256(payload);
  return value;
}

function primaryReject(verifier, value, label) {
  let rejected = false;
  try { verifier(value); } catch (error) { rejected = true; }
  ok(rejected, label + ' primary rejection');
}

function rejectBoth(kind, value, label) {
  if (kind === 'build') {
    primaryReject(Fabric.verifyBuildGapReceipt, value, label);
    equal(Independent.verifyBuildGapReceipt(value).verdict, 'FAIL', label + ' independent rejection');
  } else {
    primaryReject(Fabric.verifyLineageReceipt, value, label);
    equal(Independent.verifyLineageReceipt(value).verdict, 'FAIL', label + ' independent rejection');
  }
}

const origin = compile(copy(blueprint));
equal(origin.status, 'COMPILED', 'origin compiles for receipt tests');
equal(Fabric.verifyBuildGapReceipt(origin.buildGapReceipt).receiptDigest, origin.buildGapReceipt.receiptDigest, 'primary build verifier accepts compiled receipt');
equal(Independent.verifyBuildGapReceipt(origin.buildGapReceipt).verdict, 'PASS', 'independent build verifier accepts compiled receipt');
equal(Fabric.verifyLineageReceipt(origin.lineageReceipt).receiptDigest, origin.lineageReceipt.receiptDigest, 'primary lineage verifier accepts origin receipt');
equal(Independent.verifyLineageReceipt(origin.lineageReceipt).verdict, 'PASS', 'independent lineage verifier accepts origin receipt');

[null, [], {}, '', 0, true, { schema: 'wrong' }].forEach((value, index) => {
  let buildResult = null;
  let lineageResult = null;
  assert.doesNotThrow(() => { buildResult = Independent.verifyBuildGapReceipt(value); }, 'malformed build receipt ' + index + ' returns a verdict');
  assertions += 1;
  assert.doesNotThrow(() => { lineageResult = Independent.verifyLineageReceipt(value); }, 'malformed lineage receipt ' + index + ' returns a verdict');
  assertions += 1;
  equal(buildResult.verdict, 'FAIL', 'malformed build receipt ' + index + ' fails');
  equal(lineageResult.verdict, 'FAIL', 'malformed lineage receipt ' + index + ' fails');
});

const unknownResource = copy(blueprint);
unknownResource.blueprintId = 'receipt-boundary-hold';
unknownResource.resourceEnvelope.compute = { state: 'UNKNOWN', unit: 'abstract-compute-unit', requested: null, permitted: null };
const held = compile(unknownResource);
equal(held.status, 'HOLD', 'unknown ceiling produces a HOLD receipt');
equal(Fabric.verifyBuildGapReceipt(held.buildGapReceipt).status, 'HOLD', 'primary build verifier accepts coherent HOLD receipt');
equal(Independent.verifyBuildGapReceipt(held.buildGapReceipt).verdict, 'PASS', 'independent build verifier accepts coherent HOLD receipt');

const buildAttacks = [];
let attack = copy(origin.buildGapReceipt); attack.status = 'HOLD'; buildAttacks.push(['compiled-labelled-hold', resign(attack, 'receiptDigest')]);
attack = copy(held.buildGapReceipt); attack.status = 'COMPILED'; buildAttacks.push(['hold-labelled-compiled', resign(attack, 'receiptDigest')]);
attack = copy(origin.buildGapReceipt); attack.outputs.manifestRef = null; buildAttacks.push(['compiled-missing-manifest-output', resign(attack, 'receiptDigest')]);
attack = copy(held.buildGapReceipt); attack.outputs.manifestRef = parentRef(origin.manifest); buildAttacks.push(['hold-with-compiled-output', resign(attack, 'receiptDigest')]);
attack = copy(origin.buildGapReceipt); attack.blueprintRef.schema = 'axm.identity-shell.wrong-blueprint/v1'; buildAttacks.push(['blueprint-schema-substitution', resign(attack, 'receiptDigest')]);
attack = copy(origin.buildGapReceipt); attack.outputs.lineageReceiptRef.schema = 'axm.identity-shell.wrong-lineage/v1'; buildAttacks.push(['lineage-output-schema-substitution', resign(attack, 'receiptDigest')]);
attack = copy(origin.buildGapReceipt); attack.truth.runtimeClaimFollows = true; buildAttacks.push(['runtime-claim-expansion', resign(attack, 'receiptDigest')]);
attack = copy(held.buildGapReceipt); attack.gaps.push(copy(attack.gaps[0])); buildAttacks.push(['duplicate-gap', resign(attack, 'receiptDigest')]);
attack = copy(held.buildGapReceipt); const laterGap = copy(attack.gaps[0]); laterGap.capabilityId = 'zz-receipt-boundary-gap'; laterGap.reason = 'Synthetic later gap used to test canonical ordering.'; attack.gaps.unshift(laterGap); buildAttacks.push(['non-canonical-gap-order', resign(attack, 'receiptDigest')]);
attack = copy(held.buildGapReceipt); attack.gaps[0].state = 'READY'; buildAttacks.push(['gap-state-promotion', resign(attack, 'receiptDigest')]);
attack = copy(held.buildGapReceipt); attack.gaps[0].gapType = 'RUNTIME'; buildAttacks.push(['unknown-gap-type', resign(attack, 'receiptDigest')]);
attack = copy(origin.buildGapReceipt); attack.extra = true; buildAttacks.push(['unknown-build-field', resign(attack, 'receiptDigest')]);
attack = copy(origin.buildGapReceipt); attack.receiptDigest = Fabric.sha256('wrong-build-digest'); buildAttacks.push(['build-digest-substitution', attack]);
buildAttacks.forEach(([label, value]) => rejectBoth('build', value, label));

const forkBlueprint = copy(blueprint);
forkBlueprint.blueprintId = 'receipt-boundary-fork';
forkBlueprint.identityRoot.shellId = 'receipt-boundary-child';
forkBlueprint.lineage = {
  eventKind: 'FORK',
  parentManifestRefs: [parentRef(origin.manifest)],
  continuityEvidenceRefs: [],
  humanDecisionReceiptRef: null,
  disclosures: [{ kind: 'FORK', statement: 'Synthetic fork receipt boundary test.', beforeRef: parentRef(origin.manifest), afterRef: null }]
};
const forked = compile(forkBlueprint, { parentManifests: [origin.manifest] });
equal(Fabric.verifyLineageReceipt(forked.lineageReceipt).eventKind, 'FORK', 'primary lineage verifier accepts fork receipt');
equal(Independent.verifyLineageReceipt(forked.lineageReceipt).verdict, 'PASS', 'independent lineage verifier accepts fork receipt');

const lineageAttacks = [];
attack = copy(origin.lineageReceipt); attack.state = 'FORK_RECORDED'; lineageAttacks.push(['origin-state-mismatch', resign(attack, 'receiptDigest')]);
attack = copy(origin.lineageReceipt); attack.parentManifestRefs = [parentRef(origin.manifest)]; lineageAttacks.push(['origin-with-parent', resign(attack, 'receiptDigest')]);
attack = copy(origin.lineageReceipt); attack.humanDecisionReceiptRef = ref('false-decision', Fabric.SCHEMAS.humanDecisionReceipt, 'false-decision'); lineageAttacks.push(['origin-with-human-decision', resign(attack, 'receiptDigest')]);
attack = copy(origin.lineageReceipt); attack.truth.automaticPromotion = true; lineageAttacks.push(['lineage-self-promotion', resign(attack, 'receiptDigest')]);
attack = copy(forked.lineageReceipt); attack.disclosureKinds = []; lineageAttacks.push(['fork-without-disclosure', resign(attack, 'receiptDigest')]);
attack = copy(forked.lineageReceipt); attack.shellId = origin.manifest.shellId; lineageAttacks.push(['fork-reuses-parent-id', resign(attack, 'receiptDigest')]);
attack = copy(forked.lineageReceipt); attack.parentManifestRefs[0].schema = 'axm.identity-shell.wrong-parent/v1'; lineageAttacks.push(['lineage-parent-schema-substitution', resign(attack, 'receiptDigest')]);
attack = copy(forked.lineageReceipt); attack.eventKind = 'MIGRATION'; attack.state = 'MIGRATION_RECORDED'; attack.shellId = origin.manifest.shellId; attack.disclosureKinds = ['MIGRATION']; lineageAttacks.push(['migration-without-continuity', resign(attack, 'receiptDigest')]);
attack = copy(forked.lineageReceipt); attack.eventKind = 'MIGRATION'; attack.state = 'MIGRATION_RECORDED'; attack.shellId = origin.manifest.shellId; attack.disclosureKinds = ['MIGRATION']; attack.continuityEvidenceRefs = [ref('wrong-schema-continuity', 'axm.identity-shell.wrong-continuity/v1', 'wrong-schema-continuity')]; lineageAttacks.push(['lineage-continuity-schema-substitution', resign(attack, 'receiptDigest')]);
attack = copy(forked.lineageReceipt); attack.eventKind = 'MIGRATION'; attack.state = 'MIGRATION_RECORDED'; attack.shellId = origin.manifest.shellId; attack.disclosureKinds = ['MIGRATION']; const duplicateContinuityRef = ref('duplicate-continuity', Fabric.SCHEMAS.continuityEvent, 'duplicate-continuity'); attack.continuityEvidenceRefs = [duplicateContinuityRef, copy(duplicateContinuityRef)]; lineageAttacks.push(['lineage-duplicate-continuity', resign(attack, 'receiptDigest')]);
attack = copy(forked.lineageReceipt); attack.eventKind = 'SUCCESSION_PROPOSAL'; attack.state = 'PROPOSED_FOR_EXTERNAL_GATE'; attack.disclosureKinds = ['SUCCESSION']; lineageAttacks.push(['succession-without-human-decision', resign(attack, 'receiptDigest')]);
attack = copy(forked.lineageReceipt); attack.eventKind = 'SUCCESSION_PROPOSAL'; attack.state = 'PROPOSED_FOR_EXTERNAL_GATE'; attack.disclosureKinds = ['SUCCESSION']; attack.continuityEvidenceRefs = [ref('succession-continuity', Fabric.SCHEMAS.continuityEvent, 'succession-continuity')]; attack.humanDecisionReceiptRef = ref('wrong-schema-decision', 'axm.identity-shell.wrong-decision/v1', 'wrong-schema-decision'); lineageAttacks.push(['lineage-human-decision-schema-substitution', resign(attack, 'receiptDigest')]);
attack = copy(forked.lineageReceipt); attack.receiptDigest = Fabric.sha256('wrong-lineage-digest'); lineageAttacks.push(['lineage-digest-substitution', attack]);
lineageAttacks.forEach(([label, value]) => rejectBoth('lineage', value, label));

const validAcceptance = Fabric.createContinuityReceipt({
  receiptId: 'receipt-boundary-accepted-origin', policyId: blueprint.continuityPolicy.policyId, sequence: 0, previousReceiptDigest: null,
  eventType: 'ORIGIN', status: 'ACCEPTED', payloadRef: ref('accepted-origin-payload', 'axm.identity-shell.origin-payload/v1', 'accepted-origin-payload'),
  candidateReceiptDigest: null, acceptanceReceiptRef: ref('human-acceptance', Fabric.HUMAN_ACCEPTANCE_SCHEMA, 'human-acceptance'), rollbackTargetDigest: null,
  modelSwapDisclosure: null, occurredAt: '2026-08-22T02:45:00.000Z'
});
equal(Fabric.verifyContinuityReceipt(validAcceptance).receiptDigest, validAcceptance.receiptDigest, 'human-acceptance schema produces a valid continuity receipt');
expectCode('ACCEPTANCE_REQUIRED', () => Fabric.createContinuityReceipt({
  receiptId: 'receipt-boundary-fake-acceptance', policyId: blueprint.continuityPolicy.policyId, sequence: 0, previousReceiptDigest: null,
  eventType: 'ORIGIN', status: 'ACCEPTED', payloadRef: ref('fake-origin-payload', 'axm.identity-shell.origin-payload/v1', 'fake-origin-payload'),
  candidateReceiptDigest: null, acceptanceReceiptRef: ref('fake-acceptance', 'axm.fake-acceptance/v1', 'fake-acceptance'), rollbackTargetDigest: null,
  modelSwapDisclosure: null, occurredAt: '2026-08-22T02:45:01.000Z'
}), 'arbitrary acceptance schemas are rejected');
attack = copy(validAcceptance); attack.acceptanceReceiptRef.schema = 'axm.fake-acceptance/v1'; resign(attack, 'receiptDigest');
expectCode('ACCEPTANCE_REQUIRED', () => Fabric.verifyContinuityReceipt(attack), 're-signed arbitrary acceptance schema is rejected');

const parentDigest = Fabric.sha256('decision-parent');
const continuityDigest = Fabric.sha256('decision-continuity');
const decisionInput = {
  decisionId: 'receipt-boundary-decision', decisionAt: '2026-08-22T02:46:00.000Z',
  actor: { kind: 'HUMAN', id: 'synthetic-reviewer', authorshipVerificationRef: ref('synthetic-authorship', 'axm.external-human-authorship-check/v1', 'synthetic-authorship') },
  subject: { eventKind: 'SUCCESSION_PROPOSAL', parentShellId: 'decision-parent-shell', parentManifestDigest: parentDigest, proposedShellId: 'decision-child-shell', proposalDigest: Fabric.sha256('decision-proposal') },
  decision: 'AUTHORIZE_SUCCESSION_PROPOSAL', consent: { explicit: true, scope: 'SINGLE_LINEAGE_PROPOSAL', automatic: false },
  lineageEvidenceRefs: [{ id: 'decision-parent-shell', schema: Fabric.SCHEMAS.manifest, sha256: parentDigest }],
  continuityEvidenceRefs: [{ id: 'decision-continuity', schema: Fabric.SCHEMAS.continuityEvent, sha256: continuityDigest }],
  confirmation: 'AUTHORIZE SUCCESSION PROPOSAL'
};
const validDecision = Fabric.createHumanDecisionReceipt(decisionInput);
equal(Fabric.verifyHumanDecisionReceipt(validDecision).receiptDigest, validDecision.receiptDigest, 'coherent human decision receipt verifies');
const mismatch = copy(decisionInput); mismatch.subject.eventKind = 'RETIREMENT_PROPOSAL';
expectCode('HUMAN_DECISION_MISMATCH', () => Fabric.createHumanDecisionReceipt(mismatch), 'decision must match subject event');
const noLineage = copy(decisionInput); noLineage.lineageEvidenceRefs = [];
expectCode('HUMAN_DECISION_MISMATCH', () => Fabric.createHumanDecisionReceipt(noLineage), 'authorization requires exact parent evidence');
const wrongParentId = copy(decisionInput); wrongParentId.lineageEvidenceRefs[0].id = 'wrong-parent-shell';
expectCode('HUMAN_DECISION_MISMATCH', () => Fabric.createHumanDecisionReceipt(wrongParentId), 'authorization parent evidence id must match the subject');
const wrongParentDigest = copy(decisionInput); wrongParentDigest.lineageEvidenceRefs[0].sha256 = Fabric.sha256('wrong-parent-digest');
expectCode('HUMAN_DECISION_MISMATCH', () => Fabric.createHumanDecisionReceipt(wrongParentDigest), 'authorization parent evidence digest must match the subject');
const noContinuity = copy(decisionInput); noContinuity.continuityEvidenceRefs = [];
expectCode('CONTINUITY_UNKNOWN', () => Fabric.createHumanDecisionReceipt(noContinuity), 'authorization requires continuity evidence');
const wrongContinuitySchema = copy(decisionInput); wrongContinuitySchema.continuityEvidenceRefs[0].schema = 'axm.identity-shell.wrong-continuity/v1';
expectCode('SCHEMA_MISMATCH', () => Fabric.createHumanDecisionReceipt(wrongContinuitySchema), 'decision continuity evidence schema is exact');
const duplicateContinuity = copy(decisionInput); duplicateContinuity.continuityEvidenceRefs.push(copy(duplicateContinuity.continuityEvidenceRefs[0]));
expectCode('DUPLICATE_REFERENCE', () => Fabric.createHumanDecisionReceipt(duplicateContinuity), 'decision continuity evidence cannot repeat a digest');
const heldDecisionInput = copy(decisionInput); heldDecisionInput.decision = 'HOLD'; heldDecisionInput.confirmation = 'HOLD IDENTITY LINEAGE PROPOSAL'; heldDecisionInput.lineageEvidenceRefs = []; heldDecisionInput.continuityEvidenceRefs = [];
equal(Fabric.createHumanDecisionReceipt(heldDecisionInput).decision, 'HOLD', 'HOLD remains available when evidence is missing');

const successionBlueprint = copy(blueprint);
successionBlueprint.blueprintId = 'receipt-boundary-succession';
successionBlueprint.identityRoot.shellId = 'receipt-boundary-successor';
const acceptedRef = ref(validAcceptance.receiptId, validAcceptance.schema, validAcceptance.receiptDigest);
acceptedRef.sha256 = validAcceptance.receiptDigest;
successionBlueprint.continuityReceiptRefs = [acceptedRef];
successionBlueprint.expectedContinuityHeadDigest = validAcceptance.receiptDigest;
successionBlueprint.lineage = {
  eventKind: 'SUCCESSION_PROPOSAL', parentManifestRefs: [parentRef(origin.manifest)], continuityEvidenceRefs: [acceptedRef], humanDecisionReceiptRef: null,
  disclosures: [{ kind: 'SUCCESSION', statement: 'Synthetic evidence-binding succession test.', beforeRef: parentRef(origin.manifest), afterRef: null }]
};
const driftedDecisionInput = {
  decisionId: 'receipt-boundary-drifted-decision', decisionAt: '2026-08-22T02:47:00.000Z',
  actor: { kind: 'HUMAN', id: 'synthetic-reviewer', authorshipVerificationRef: ref('synthetic-authorship-drift', 'axm.external-human-authorship-check/v1', 'synthetic-authorship-drift') },
  subject: { eventKind: 'SUCCESSION_PROPOSAL', parentShellId: origin.manifest.shellId, parentManifestDigest: origin.manifest.manifestDigest, proposedShellId: successionBlueprint.identityRoot.shellId, proposalDigest: Fabric.successionProposalDigest(successionBlueprint) },
  decision: 'AUTHORIZE_SUCCESSION_PROPOSAL', consent: { explicit: true, scope: 'SINGLE_LINEAGE_PROPOSAL', automatic: false },
  lineageEvidenceRefs: [parentRef(origin.manifest)], continuityEvidenceRefs: [ref('different-continuity', Fabric.SCHEMAS.continuityEvent, 'different-continuity')],
  confirmation: 'AUTHORIZE SUCCESSION PROPOSAL'
};
const driftedDecision = Fabric.createHumanDecisionReceipt(driftedDecisionInput);
successionBlueprint.lineage.humanDecisionReceiptRef = ref(driftedDecision.decisionId, driftedDecision.schema, driftedDecision.receiptDigest);
successionBlueprint.lineage.humanDecisionReceiptRef.sha256 = driftedDecision.receiptDigest;
expectCode('HUMAN_DECISION_MISMATCH', () => compile(successionBlueprint, { parentManifests: [origin.manifest], continuityReceipts: [validAcceptance], humanDecisionReceipts: [driftedDecision] }), 'compilation binds decision continuity evidence to the exact lineage evidence');

const driftedResult = copy(origin);
driftedResult.buildGapReceipt.status = 'HOLD';
resign(driftedResult.buildGapReceipt, 'receiptDigest');
equal(Fabric.verifyCompilation({ blueprint: copy(blueprint), descriptors: [copy(adapter), copy(body)], parentManifests: [], continuityReceipts: [], humanDecisionReceipts: [] }, driftedResult).pass, false, 'compilation replay rejects re-signed build receipt drift');
const lineageDriftedResult = copy(origin);
lineageDriftedResult.lineageReceipt.state = 'FORK_RECORDED';
resign(lineageDriftedResult.lineageReceipt, 'receiptDigest');
equal(Fabric.verifyCompilation({ blueprint: copy(blueprint), descriptors: [copy(adapter), copy(body)], parentManifests: [], continuityReceipts: [], humanDecisionReceipts: [] }, lineageDriftedResult).pass, false, 'compilation replay rejects re-signed standalone lineage receipt drift');

process.stdout.write('PASS identity-shell-fabric receipt boundaries: ' + assertions + ' assertions; ' + buildAttacks.length + ' build attacks and ' + lineageAttacks.length + ' lineage attacks rejected by primary and independent gates\n');
