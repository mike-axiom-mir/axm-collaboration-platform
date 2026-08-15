'use strict';

const fs = require('fs');
const path = require('path');
const Outcome = require('../kernel/outcome-learning-cell');
const ImmutableStore = require('../kernel/immutable-batch-store');
const OutcomeLearning = require('./outcome-learning-organ');
const OutcomePlanner = require('./outcome-curriculum-planner-organ');
const VerificationSpine = require('../modules/ai-organ-archive/core/verification-spine-evidence');
const OrganArchive = require('../modules/ai-organ-archive/core/organ-archive');

const ROOT = path.resolve(__dirname, '..');
const ORGAN_ID = 'axm.mirror.workshop-verification-outcome-bridge-organ/v1';
const PRECOMMIT_SCHEMA = 'axm.mirror.workshop-verification-outcome-precommit/v1';
const CYCLE_SCHEMA = 'axm.mirror.workshop-verification-outcome-bridge-cycle/v1';
const SOURCE_SCHEMA = 'axm.mirror.workshop-verification-outcome-bridge-source/v1';
const CLAIM_CEILING = 'TEST_REAL_LOCAL_SEPARATE_VERIFIER_PERSISTENCE_BASELINE_PRECOMMIT_TO_LATER_DISTINCT_REPORT_OUTCOME';
const DEFAULT_ARCHIVE_ROOT = OrganArchive.DEFAULT_ARCHIVE_ROOT;
const DEFAULT_PRECOMMIT_STATE_DIR = path.join(ROOT, 'state', 'workshop-verification-outcome-precommits');
const DEFAULT_OUTCOME_STATE_DIR = OutcomeLearning.DEFAULT_STATE_DIR;
const DEFAULT_CYCLE_STATE_DIR = path.join(ROOT, 'state', 'workshop-verification-outcome-bridge-cycles');
const MAX_DISTINCT_REPORTS = 256;
const MAX_PRECOMMITS = 256;
const MAX_BRIDGE_OUTCOMES = 256;
const MAX_CYCLE_SOURCE_BYTES = 2 * 1024 * 1024;
const MACHINE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const BASELINE_METHOD = {
  kind: 'PERSIST_LAST_VERIFIED_VALUE',
  scope: 'next-distinct-content-verified-report-in-the-same-profile',
  probability: null,
  missingCategory: 'observe-category-present-false-and-preserve-other-fields-as-missing'
};
const METHOD = {
  methodId: 'workshop-verification-persistence-baseline-v1',
  methodDigest: Outcome.digest(BASELINE_METHOD)
};
const REPORT_FIELD_SCHEMA = {
  id: 'axm.mirror.workshop-verification-report-outcome-fields/v1',
  fields: ['reportVerdict', 'receiptCount', 'claimCount', 'failureCount', 'holdCount', 'warningCount', 'contradictionCount', 'humanReviewCount', 'invalidReceiptCount']
};
const CATEGORY_FIELD_SCHEMA = {
  id: 'axm.mirror.workshop-verification-category-outcome-fields/v1',
  fields: ['categoryPresent', 'receiptCount', 'claimCount', 'passCount', 'failCount', 'warningCount', 'unknownCount', 'missingValidatorCount', 'humanReviewCount', 'notApplicableCount']
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function stable(value) { return Outcome.stable(value); }
function digest(value) { return Outcome.digest(value); }
function same(left, right) { return Outcome.same(left, right); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function rejectHidden(value, trail = []) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (/chain.?of.?thought|hidden.?reasoning|private.?reasoning|reasoning.?content/i.test(key)) throw new Error(`private hidden reasoning field refused at ${trail.concat(key).join('.')}`);
    rejectHidden(value[key], trail.concat(key));
  }
}
function iso(value, field) {
  const text = String(value == null ? '' : value).trim();
  if (!text || text.length > 80 || !Number.isFinite(Date.parse(text))) throw new Error(`${field} requires a bounded parseable time`);
  return text;
}
function machineId(value, field) {
  const text = String(value == null ? '' : value).trim();
  if (!MACHINE_ID.test(text)) throw new Error(`${field} is not a bounded machine id`);
  return text;
}
function sha(value, field) {
  const text = String(value == null ? '' : value).trim();
  if (!SHA256.test(text)) throw new Error(`${field} is not sha256`);
  return text;
}
function count(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} requires a nonnegative safe integer`);
  return value;
}
function authority() {
  return {
    verifiedIntakeRead: true,
    persistenceBaselineProjection: true,
    privatePrecommitWrite: true,
    privateOutcomeWrite: true,
    arbitraryPredictionGeneration: false,
    probabilityGeneration: false,
    externalTimeCertification: false,
    independentAuthorshipCertification: false,
    truthWrite: false,
    evidenceAdmission: false,
    trainingAdmission: false,
    methodSelection: false,
    repairApply: false,
    permissionGrant: false,
    toolUse: false,
    runtimeAdmission: false,
    runtimePromotion: false,
    canonChange: false,
    worldAction: false
  };
}
function precommitAuthority() {
  return {
    privatePrecommitWrite: true,
    arbitraryPredictionGeneration: false,
    probabilityGeneration: false,
    truthWrite: false,
    evidenceAdmission: false,
    trainingAdmission: false,
    permissionGrant: false,
    toolUse: false,
    runtimeAdmission: false,
    runtimePromotion: false,
    canonChange: false,
    worldAction: false
  };
}
function reportProjection(report) {
  return {
    verdict: report.verdict,
    categories: report.categories,
    missing_categories: report.missing_categories,
    conflicts: report.conflicts,
    failures: report.failures,
    holds: report.holds,
    human_reviews: report.human_reviews,
    warnings: report.warnings,
    invalid_receipts: report.invalid_receipts,
    receipt_count: report.receipt_count,
    claim_count: report.claim_count
  };
}
function validateIntakePair(pair) {
  if (!pair || !pair.receipt || !pair.report) throw new Error('Workshop verification bridge requires an intake receipt and report pair');
  VerificationSpine.verifyIntakeReceipt(pair.receipt);
  const receipt = pair.receipt;
  const report = pair.report;
  if (receipt.result.state !== 'ACCEPTED_EXTERNAL_CATEGORY_REPORT') return null;
  if (report.schema !== VerificationSpine.EXTERNAL_REPORT_SCHEMA || report.version !== '2.0.0') throw new Error('accepted Workshop verification report schema changed');
  const summary = receipt.result.report;
  if (!summary || summary.reportSchema !== report.schema || summary.reportVersion !== report.version || summary.profileId !== report.profile.id || summary.reportVerdict !== report.verdict || summary.generatedAt !== report.generated_at) throw new Error('Workshop verification intake summary differs from its report');
  const expectedProjectionDigest = digest(reportProjection(report));
  if (summary.projectionSha256 !== expectedProjectionDigest) throw new Error('Workshop verification intake projection no longer reproduces from its report');
  const expectedCounts = {
    receiptCount: count(report.receipt_count, 'report.receipt_count'),
    claimCount: count(report.claim_count, 'report.claim_count'),
    contradictionCount: report.conflicts.length,
    failureCount: report.failures.length,
    holdCount: report.holds.length,
    humanReviewCount: report.human_reviews.length,
    warningCount: report.warnings.length,
    invalidReceiptCount: report.invalid_receipts.length
  };
  for (const [key, value] of Object.entries(expectedCounts)) if (summary[key] !== value) throw new Error(`Workshop verification intake ${key} differs from its report`);
  if (!same(summary.categories, report.categories)) throw new Error('Workshop verification intake categories differ from its report');
  return { receipt, report, summary };
}
function intakeRef(receipt) {
  return { receiptId: receipt.receiptId, receiptDigest: receipt.receiptDigest, recordedAt: iso(receipt.recordedAt, 'intake recordedAt') };
}
function eventRef(event) {
  return { reportId: event.reportId, reportDigest: event.reportDigest, projectionDigest: event.projectionDigest, profileId: event.profileId, firstRecordedAt: event.firstRecordedAt };
}
function normalizeCategory(category) {
  exactKeys(category, ['id', 'receipts', 'claims', 'statuses'], 'Workshop verification category projection');
  const statuses = {};
  for (const key of Object.keys(category.statuses || {}).sort()) statuses[machineId(key, 'category status')] = count(category.statuses[key], `category status ${key}`);
  return {
    id: machineId(category.id, 'category id'),
    receipts: count(category.receipts, 'category receipts'),
    claims: count(category.claims, 'category claims'),
    statuses
  };
}
function loadReportEvents(options = {}) {
  const intakes = VerificationSpine.listIntakes(path.resolve(options.archiveRoot || DEFAULT_ARCHIVE_ROOT));
  const groups = new Map();
  let heldIntakes = 0;
  for (const pair of intakes) {
    const accepted = validateIntakePair(pair);
    if (!accepted) { heldIntakes += 1; continue; }
    const reportDigest = sha(accepted.receipt.source.sha256, 'report source digest');
    const projection = stable({
      reportSchema: accepted.summary.reportSchema,
      reportVersion: accepted.summary.reportVersion,
      profileId: machineId(accepted.summary.profileId, 'report profile id'),
      reportVerdict: machineId(accepted.summary.reportVerdict, 'report verdict'),
      generatedAt: iso(accepted.summary.generatedAt, 'report generatedAt'),
      receiptCount: accepted.summary.receiptCount,
      claimCount: accepted.summary.claimCount,
      contradictionCount: accepted.summary.contradictionCount,
      failureCount: accepted.summary.failureCount,
      holdCount: accepted.summary.holdCount,
      humanReviewCount: accepted.summary.humanReviewCount,
      warningCount: accepted.summary.warningCount,
      invalidReceiptCount: accepted.summary.invalidReceiptCount,
      categories: accepted.summary.categories.map(normalizeCategory).sort((left, right) => left.id.localeCompare(right.id))
    });
    const projectionDigest = digest(reportProjection(accepted.report));
    if (projectionDigest !== accepted.summary.projectionSha256) throw new Error('Workshop verification report projection changed after intake validation');
    if (!groups.has(reportDigest)) groups.set(reportDigest, { projection, projectionDigest, intakeRefs: [] });
    const group = groups.get(reportDigest);
    if (group.projectionDigest !== projectionDigest || !same(group.projection, projection)) throw new Error('identical Workshop verification report bytes produced competing projections');
    group.intakeRefs.push(intakeRef(accepted.receipt));
  }
  if (groups.size > MAX_DISTINCT_REPORTS) throw new Error(`Workshop verification bridge exceeds ${MAX_DISTINCT_REPORTS} distinct reports`);
  const events = Array.from(groups.entries()).map(([reportDigest, group]) => {
    const refs = group.intakeRefs.sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.receiptId.localeCompare(right.receiptId));
    return stable({
      reportId: `workshop-verification-report-${reportDigest.slice(0, 24)}`,
      reportDigest,
      projectionDigest: group.projectionDigest,
      profileId: group.projection.profileId,
      firstRecordedAt: refs[0].recordedAt,
      intakeRefs: refs,
      projection: group.projection
    });
  }).sort((left, right) => left.firstRecordedAt.localeCompare(right.firstRecordedAt) || left.reportId.localeCompare(right.reportId));
  const chronologyHolds = [];
  for (let index = 1; index < events.length; index += 1) {
    if (events[index - 1].profileId === events[index].profileId && events[index - 1].firstRecordedAt === events[index].firstRecordedAt) chronologyHolds.push(`AMBIGUOUS_LOCAL_REPORT_ORDER:${events[index - 1].reportId}:${events[index].reportId}`);
  }
  return {
    events,
    acceptedIntakes: intakes.length - heldIntakes,
    heldIntakes,
    duplicateIntakes: (intakes.length - heldIntakes) - events.length,
    chronologyHolds
  };
}
function profileEvents(events, profileId) {
  return events.filter(event => event.profileId === profileId).sort((left, right) => left.firstRecordedAt.localeCompare(right.firstRecordedAt) || left.reportId.localeCompare(right.reportId));
}
function latestEvents(events) {
  const profiles = Array.from(new Set(events.map(event => event.profileId))).sort();
  return profiles.map(profileId => profileEvents(events, profileId).slice(-1)[0]);
}
function statusCount(category, status) { return count(category.statuses[status] || 0, `${category.id}.${status}`); }
function targetDefinitions(event) {
  const evidenceRef = { id: event.reportId, digest: event.reportDigest };
  const reportValues = {
    reportVerdict: event.projection.reportVerdict,
    receiptCount: event.projection.receiptCount,
    claimCount: event.projection.claimCount,
    failureCount: event.projection.failureCount,
    holdCount: event.projection.holdCount,
    warningCount: event.projection.warningCount,
    contradictionCount: event.projection.contradictionCount,
    humanReviewCount: event.projection.humanReviewCount,
    invalidReceiptCount: event.projection.invalidReceiptCount
  };
  const rows = [{
    key: 'report',
    group: 'report',
    subjectId: `workshop-verification-report/${event.profileId}`,
    fieldSchema: REPORT_FIELD_SCHEMA,
    values: reportValues,
    evidenceRef
  }];
  for (const category of event.projection.categories) {
    rows.push({
      key: `category/${category.id}`,
      group: `category/${category.id}`,
      subjectId: `workshop-verification-category/${event.profileId}/${category.id}`,
      fieldSchema: CATEGORY_FIELD_SCHEMA,
      values: {
        categoryPresent: true,
        receiptCount: category.receipts,
        claimCount: category.claims,
        passCount: statusCount(category, 'PASS'),
        failCount: statusCount(category, 'FAIL'),
        warningCount: statusCount(category, 'WARNING'),
        unknownCount: statusCount(category, 'UNKNOWN'),
        missingValidatorCount: statusCount(category, 'MISSING_VALIDATOR'),
        humanReviewCount: statusCount(category, 'HUMAN_REVIEW'),
        notApplicableCount: statusCount(category, 'NOT_APPLICABLE')
      },
      evidenceRef
    });
  }
  return rows.sort((left, right) => left.key.localeCompare(right.key));
}
function valueType(value) {
  if (value === null) return 'NULL';
  if (typeof value === 'boolean') return 'BOOLEAN';
  if (typeof value === 'number') return 'NUMBER';
  return 'STRING';
}
function sourceSystemId(target) { return `mirror-workshop-verification-baseline/${target.key}`; }
function previousPredictionFor(target, previousPredictions) {
  const id = sourceSystemId(target);
  const rows = previousPredictions.filter(prediction => prediction.source.sourceSystemId === id).sort((left, right) => left.source.sequence - right.source.sequence);
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index].source.sequence !== index) throw new Error(`Workshop verification prediction lineage is discontinuous for ${id}`);
    if (index === 0 && rows[index].source.priorPredictionDigest !== null) throw new Error(`Workshop verification first prediction has a predecessor for ${id}`);
    if (index > 0 && rows[index].source.priorPredictionDigest !== rows[index - 1].predictionDigest) throw new Error(`Workshop verification prediction predecessor changed for ${id}`);
  }
  return rows.length ? rows[rows.length - 1] : null;
}
function precommitBasis(precommit) {
  const basis = clone(precommit);
  basis.precommitId = null;
  basis.precommitDigest = null;
  return basis;
}
function buildPrecommit(event, eventsBeforeSeal, previousPredictions, observationsBeforeSeal, createdAt) {
  const at = iso(createdAt, 'precommit createdAt');
  const sameProfile = eventsBeforeSeal.filter(item => item.profileId === event.profileId);
  if (!sameProfile.length || sameProfile[sameProfile.length - 1].reportId !== event.reportId) throw new Error('Workshop verification precommit source is not the latest same-profile report before seal');
  // The first exact intake is the immutable permission/evidence witness. Later
  // duplicate imports stay counted in the inventory but cannot rewrite a seal.
  const permissionRefs = event.intakeRefs.slice(0, 1).map(ref => ({ id: ref.receiptId, digest: ref.receiptDigest }));
  const predictions = targetDefinitions(event).map(target => {
    const predecessor = previousPredictionFor(target, previousPredictions);
    const fieldSchemaDigest = digest(target.fieldSchema);
    const draft = {
      schema: 'axm.mirror.outcome-prediction-draft/v1',
      source: {
        sourceSystemId: sourceSystemId(target),
        sourceGroupId: `workshop-verification/${event.profileId}/${target.group}`,
        sourceRecordId: event.reportId,
        sourceRecordDigest: event.reportDigest,
        sequence: predecessor ? predecessor.source.sequence + 1 : 0,
        priorPredictionDigest: predecessor ? predecessor.predictionDigest : null,
        collectionMethod: 'DIRECT_MACHINE_SEAL'
      },
      scope: {
        scopeId: 'workshop-verification-next-distinct-report',
        subjectId: target.subjectId,
        subjectDigest: digest({ target: target.key, values: target.values, sourceReportId: event.reportId }),
        startingStateDigest: event.reportDigest,
        actionDigest: digest({ operation: 'observe-next-distinct-verified-report', profileId: event.profileId, sourceReportId: event.reportId }),
        fieldSchemaId: target.fieldSchema.id,
        fieldSchemaDigest
      },
      method: METHOD,
      fields: Object.keys(target.values).sort().map(fieldId => ({
        fieldId,
        valueType: valueType(target.values[fieldId]),
        expectation: 'VALUE',
        value: target.values[fieldId],
        probabilityBasisPoints: null,
        evidenceRefs: [target.evidenceRef]
      })),
      questions: [],
      permission: { status: 'ALLOWED', basisEvidenceRefs: permissionRefs }
    };
    return Outcome.sealPrediction(draft, { observationsBeforeSeal, predecessor });
  });
  const precommit = stable({
    schema: PRECOMMIT_SCHEMA,
    precommitId: null,
    precommitDigest: null,
    createdAt: at,
    sourceReport: eventRef(event),
    reportInventoryBeforeSeal: sameProfile.map(eventRef),
    predictions: predictions.sort((left, right) => left.predictionId.localeCompare(right.predictionId)),
    summary: {
      persistenceBaselinePredictions: predictions.length,
      probabilityValuesGenerated: 0,
      externalReportBytesCopied: 0,
      rawReceiptClaimsCopied: 0,
      independentAuthorshipCertified: 0,
      externalTimeCertified: 0,
      evidenceAdmissions: 0,
      trainingAdmissions: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    authority: precommitAuthority(),
    boundary: 'This TEST precommit copies only typed counts and verdicts from the latest distinct content-verified Workshop report into a fixed persistence baseline for the next distinct report in the same profile. It seals no probability, copies no raw report or claim, certifies neither external time nor independent authorship, and grants no truth, evidence, training, permission, tool, runtime, promotion, CANON, or world authority.'
  });
  precommit.precommitDigest = digest(precommitBasis(precommit));
  precommit.precommitId = `workshop-verification-precommit-${precommit.precommitDigest.slice(0, 24)}`;
  return stable(precommit);
}
function verifyPrecommitEnvelope(precommit) {
  rejectHidden(precommit);
  exactKeys(precommit, ['schema', 'precommitId', 'precommitDigest', 'createdAt', 'sourceReport', 'reportInventoryBeforeSeal', 'predictions', 'summary', 'authority', 'boundary'], 'Workshop verification precommit');
  if (precommit.schema !== PRECOMMIT_SCHEMA || !/^workshop-verification-precommit-[a-f0-9]{24}$/.test(precommit.precommitId || '') || !SHA256.test(precommit.precommitDigest || '')) throw new Error('Workshop verification precommit identity is invalid');
  iso(precommit.createdAt, 'precommit createdAt');
  precommit.predictions.forEach(Outcome.verifyPredictionEnvelope);
  if (!precommit.predictions.length || precommit.predictions.length > 64 || precommit.predictions.some(prediction => !prediction.source.sourceSystemId.startsWith('mirror-workshop-verification-baseline/'))) throw new Error('Workshop verification precommit prediction family changed');
  if (!same(precommit.authority, precommitAuthority()) || precommit.summary.probabilityValuesGenerated !== 0 || precommit.summary.externalReportBytesCopied !== 0 || precommit.summary.rawReceiptClaimsCopied !== 0 || precommit.summary.evidenceAdmissions !== 0 || precommit.summary.trainingAdmissions !== 0 || precommit.summary.runtimePromotions !== 0 || precommit.summary.canonChanges !== 0 || precommit.summary.worldActions !== 0) throw new Error('Workshop verification precommit gained authority or retained raw report data');
  const expectedDigest = digest(precommitBasis(precommit));
  if (precommit.precommitDigest !== expectedDigest || precommit.precommitId !== `workshop-verification-precommit-${expectedDigest.slice(0, 24)}`) throw new Error('Workshop verification precommit digest changed');
  return true;
}
function verifyPrecommit(precommit, events, priorPrecommits, observations) {
  verifyPrecommitEnvelope(precommit);
  const atMs = Date.parse(precommit.createdAt);
  const event = events.find(item => item.reportId === precommit.sourceReport.reportId && item.reportDigest === precommit.sourceReport.reportDigest);
  if (!event || !same(precommit.sourceReport, eventRef(event))) throw new Error('Workshop verification precommit source report changed');
  const before = profileEvents(events, event.profileId).filter(item => Date.parse(item.firstRecordedAt) < atMs);
  if (!before.length || before[before.length - 1].reportId !== event.reportId || !same(precommit.reportInventoryBeforeSeal, before.map(eventRef))) throw new Error('Workshop verification precommit report inventory or local chronology changed');
  const previousPredictions = priorPrecommits.filter(item => Date.parse(item.createdAt) < atMs).flatMap(item => item.predictions);
  const snapshotIds = precommit.predictions[0].localOrderEvidence.observationIdsBeforeSeal;
  if (precommit.predictions.some(prediction => !same(prediction.localOrderEvidence.observationIdsBeforeSeal, snapshotIds))) throw new Error('Workshop verification precommit predictions used different observation inventories');
  const byObservationId = new Map(observations.map(item => [item.observationId, item]));
  const snapshot = snapshotIds.map(id => {
    const observation = byObservationId.get(id);
    if (!observation) throw new Error('Workshop verification precommit observation inventory is incomplete');
    return observation;
  });
  const reconstructed = buildPrecommit(event, before, previousPredictions, snapshot, precommit.createdAt);
  if (!same(reconstructed, precommit)) throw new Error('Workshop verification precommit does not reconstruct from its verified source report');
  return true;
}
function inspectPrecommitRoot(stateDir) {
  const root = path.resolve(stateDir || DEFAULT_PRECOMMIT_STATE_DIR);
  fs.mkdirSync(root, { recursive: true });
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Workshop verification precommit root must be a real directory');
  const entries = fs.readdirSync(root, { withFileTypes: true });
  let ignoredStagingEntries = 0;
  const visible = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.stage-')) { ignoredStagingEntries += 1; continue; }
    if (!entry.isDirectory() || entry.isSymbolicLink() || !/^workshop-verification-report-[a-f0-9]{24}$/.test(entry.name)) throw new Error(`unexpected Workshop verification precommit entry: ${entry.name}`);
    visible.push({ name: entry.name, directory: path.join(root, entry.name) });
  }
  if (visible.length > MAX_PRECOMMITS) throw new Error(`Workshop verification precommits exceed ${MAX_PRECOMMITS}`);
  return { root, visible: visible.sort((left, right) => left.name.localeCompare(right.name)), ignoredStagingEntries };
}
function loadPrecommitEnvelopes(stateDir) {
  const inspected = inspectPrecommitRoot(stateDir);
  const rows = inspected.visible.map(entry => {
    const precommit = JSON.parse(fs.readFileSync(path.join(entry.directory, 'precommit.json'), 'utf8'));
    verifyPrecommitEnvelope(precommit);
    if (entry.name !== precommit.sourceReport.reportId) throw new Error('Workshop verification precommit directory source identity changed');
    return precommit;
  }).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.precommitId.localeCompare(right.precommitId));
  return { rows, ignoredStagingEntries: inspected.ignoredStagingEntries };
}
function recordPrecommit(precommit, options = {}) {
  verifyPrecommitEnvelope(precommit);
  if (options.write === false) return { precommit, written: false, reused: false, runDir: null };
  const inspected = inspectPrecommitRoot(options.stateDir);
  const finalDir = path.join(inspected.root, precommit.sourceReport.reportId);
  if (fs.existsSync(finalDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(finalDir, 'precommit.json'), 'utf8'));
    verifyPrecommitEnvelope(existing);
    if (existing.sourceReport.reportId !== precommit.sourceReport.reportId) throw new Error('Workshop verification precommit immutable source collision');
    return { precommit: existing, written: false, reused: true, runDir: finalDir };
  }
  const stageDir = path.join(inspected.root, `.stage-${precommit.sourceReport.reportId}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(stageDir);
  fs.writeFileSync(path.join(stageDir, 'precommit.json'), `${JSON.stringify(precommit, null, 2)}\n`, { flag: 'wx' });
  verifyPrecommitEnvelope(JSON.parse(fs.readFileSync(path.join(stageDir, 'precommit.json'), 'utf8')));
  const commit = ImmutableStore.commitDirectory(stageDir, finalDir);
  const stored = JSON.parse(fs.readFileSync(path.join(commit.runDir, 'precommit.json'), 'utf8'));
  verifyPrecommitEnvelope(stored);
  return { precommit: stored, written: !commit.reused, reused: commit.reused, runDir: commit.runDir };
}
function bridgeOutcomeBatches(options = {}) {
  const batches = OutcomePlanner.loadOutcomeBatches({ outcomeStateDir: options.outcomeStateDir || DEFAULT_OUTCOME_STATE_DIR });
  const rows = [];
  for (const batch of batches) {
    const family = batch.predictions.map(prediction => prediction.source.sourceSystemId.startsWith('mirror-workshop-verification-baseline/'));
    if (!family.some(Boolean)) continue;
    if (!family.every(Boolean)) throw new Error('Outcome batch mixes Workshop verification bridge and unrelated predictions');
    OutcomeLearning.verify(batch);
    rows.push(batch);
  }
  if (rows.length > MAX_BRIDGE_OUTCOMES) throw new Error(`Workshop verification bridge outcomes exceed ${MAX_BRIDGE_OUTCOMES}`);
  return rows.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.batchId.localeCompare(right.batchId));
}
function allBridgeObservations(batches) {
  const byId = new Map();
  for (const batch of batches) for (const observation of batch.observations) {
    Outcome.verifyObservation(observation);
    if (byId.has(observation.observationId) && !same(byId.get(observation.observationId), observation)) throw new Error('Workshop verification bridge observation identity collision');
    byId.set(observation.observationId, observation);
  }
  return Array.from(byId.values()).sort((left, right) => left.observationId.localeCompare(right.observationId));
}
function targetKeyFromPrediction(prediction) {
  const prefix = 'mirror-workshop-verification-baseline/';
  return prediction.source.sourceSystemId.slice(prefix.length);
}
function nextValues(event, targetKey) {
  if (targetKey === 'report') return targetDefinitions(event).find(item => item.key === 'report').values;
  const target = targetDefinitions(event).find(item => item.key === targetKey);
  return target ? target.values : null;
}
function buildObservation(prediction, nextEvent) {
  const targetKey = targetKeyFromPrediction(prediction);
  const values = nextValues(nextEvent, targetKey);
  const evidenceRefs = [{ id: nextEvent.reportId, digest: nextEvent.reportDigest }];
  const fields = prediction.fields.map(field => {
    if (values && Object.prototype.hasOwnProperty.call(values, field.fieldId)) {
      return { fieldId: field.fieldId, state: 'OBSERVED', valueType: valueType(values[field.fieldId]), value: values[field.fieldId], alternatives: [], evidenceRefs, missingReason: null };
    }
    if (field.fieldId === 'categoryPresent') return { fieldId: field.fieldId, state: 'OBSERVED', valueType: 'BOOLEAN', value: false, alternatives: [], evidenceRefs, missingReason: null };
    return { fieldId: field.fieldId, state: 'MISSING', valueType: field.valueType, value: null, alternatives: [], evidenceRefs, missingReason: 'The predicted category is absent from the next distinct verified report.' };
  });
  return Outcome.sealObservation({
    schema: 'axm.mirror.outcome-observation-draft/v1',
    source: {
      sourceSystemId: 'workshop-verification-spine-intake-observer',
      sourceGroupId: `workshop-verification-observer/${nextEvent.profileId}/${targetKey}`,
      sourceRecordId: nextEvent.reportId,
      sourceRecordDigest: nextEvent.reportDigest,
      collectionMethod: 'DIRECT_MACHINE_SEAL'
    },
    scope: prediction.scope,
    fields,
    permission: { status: 'ALLOWED', basisEvidenceRefs: nextEvent.intakeRefs.slice(0, 1).map(ref => ({ id: ref.receiptId, digest: ref.receiptDigest })) }
  });
}
function directNextEvent(precommit, events) {
  const rows = profileEvents(events, precommit.sourceReport.profileId);
  const index = rows.findIndex(event => event.reportId === precommit.sourceReport.reportId);
  if (index < 0) throw new Error('Workshop verification precommit source report is absent');
  return rows[index + 1] || null;
}
function exactOutcomeMatches(precommit, nextEvent, batches) {
  const predictionIds = precommit.predictions.map(item => item.predictionId).sort();
  return batches.filter(batch => same(batch.predictions.map(item => item.predictionId).sort(), predictionIds) && batch.observations.length === predictionIds.length && batch.observations.every(observation => observation.source.sourceRecordDigest === nextEvent.reportDigest));
}
function verifyBridgeOutcome(batch, precommit, nextEvent) {
  OutcomeLearning.verify(batch);
  if (Date.parse(precommit.createdAt) >= Date.parse(nextEvent.firstRecordedAt)) throw new Error('Workshop verification outcome would grant retrospective credit');
  if (exactOutcomeMatches(precommit, nextEvent, [batch]).length !== 1) throw new Error('Workshop verification Outcome batch does not bind the exact precommit and next report');
  const expectedObservations = precommit.predictions.map(prediction => buildObservation(prediction, nextEvent)).sort((left, right) => left.observationId.localeCompare(right.observationId));
  if (!same(batch.observations, expectedObservations)) throw new Error('Workshop verification Outcome observations changed');
  return true;
}
function loadContext(options = {}) {
  const reports = loadReportEvents(options);
  const loadedPrecommits = loadPrecommitEnvelopes(options.precommitStateDir || DEFAULT_PRECOMMIT_STATE_DIR);
  const outcomes = bridgeOutcomeBatches(options);
  const observations = allBridgeObservations(outcomes);
  const verifiedPrecommits = [];
  for (const precommit of loadedPrecommits.rows) {
    verifyPrecommit(precommit, reports.events, verifiedPrecommits, observations);
    verifiedPrecommits.push(precommit);
  }
  for (const batch of outcomes) {
    const matches = verifiedPrecommits.filter(precommit => precommit.predictions.some(prediction => batch.predictions.some(item => item.predictionId === prediction.predictionId)));
    if (matches.length !== 1) throw new Error('Workshop verification Outcome batch does not bind exactly one precommit');
    const nextEvent = directNextEvent(matches[0], reports.events);
    if (!nextEvent) throw new Error('Workshop verification Outcome batch exists before a distinct next report');
    verifyBridgeOutcome(batch, matches[0], nextEvent);
  }
  return { reports, precommits: verifiedPrecommits, outcomes, observations, ignoredStagingEntries: loadedPrecommits.ignoredStagingEntries };
}
function precommitRef(precommit) {
  return { precommitId: precommit.precommitId, precommitDigest: precommit.precommitDigest, createdAt: precommit.createdAt, sourceReportId: precommit.sourceReport.reportId, sourceReportDigest: precommit.sourceReport.reportDigest, predictionIds: precommit.predictions.map(item => item.predictionId).sort() };
}
function outcomeProjection(batch, precommit, nextEvent) {
  return stable({
    batchId: batch.batchId,
    batchDigest: batch.batchDigest,
    createdAt: batch.createdAt,
    precommitId: precommit.precommitId,
    sourceReportId: precommit.sourceReport.reportId,
    nextReportId: nextEvent.reportId,
    nextReportFirstRecordedAt: nextEvent.firstRecordedAt,
    predictions: batch.summary.predictions,
    evaluated: batch.summary.evaluated,
    matched: batch.summary.matched,
    partialMatches: batch.summary.partialMatches,
    mismatched: batch.summary.mismatched,
    unresolved: batch.summary.unresolved,
    correctionProposals: batch.summary.correctionProposals
  });
}
function projectSource(context, trigger) {
  const reportRefs = context.reports.events.map(eventRef);
  const precommitRefs = context.precommits.map(precommitRef);
  const outcomeRows = context.outcomes.map(batch => {
    const precommit = context.precommits.find(item => item.predictions.some(prediction => batch.predictions.some(row => row.predictionId === prediction.predictionId)));
    const nextEvent = directNextEvent(precommit, context.reports.events);
    return outcomeProjection(batch, precommit, nextEvent);
  }).sort((left, right) => left.batchId.localeCompare(right.batchId));
  const latest = latestEvents(context.reports.events);
  const currentPrecommits = latest.map(event => context.precommits.filter(item => item.sourceReport.reportId === event.reportId)).flat();
  const outstanding = context.precommits.filter(precommit => {
    const next = directNextEvent(precommit, context.reports.events);
    return !next || exactOutcomeMatches(precommit, next, context.outcomes).length === 0;
  });
  const missed = [];
  for (const profileId of Array.from(new Set(context.reports.events.map(event => event.profileId))).sort()) {
    const rows = profileEvents(context.reports.events, profileId);
    for (let index = 0; index < rows.length - 1; index += 1) {
      if (!context.precommits.some(precommit => precommit.sourceReport.reportId === rows[index].reportId)) missed.push({ sourceReportId: rows[index].reportId, nextReportId: rows[index + 1].reportId });
    }
  }
  const chronology = outcomeRows.map(row => ({ precommitId: row.precommitId, precommittedAt: context.precommits.find(item => item.precommitId === row.precommitId).createdAt, nextReportId: row.nextReportId, nextReportFirstRecordedAt: row.nextReportFirstRecordedAt }));
  const source = stable({
    schema: SOURCE_SCHEMA,
    trigger,
    inventories: {
      reports: { distinct: reportRefs.length, acceptedIntakes: context.reports.acceptedIntakes, duplicateIntakes: context.reports.duplicateIntakes, heldIntakes: context.reports.heldIntakes, digest: digest(reportRefs) },
      precommits: { count: precommitRefs.length, digest: digest(precommitRefs) },
      outcomes: { count: outcomeRows.length, digest: digest(outcomeRows) }
    },
    latestReports: latest.map(eventRef),
    currentPrecommits: currentPrecommits.map(precommitRef).sort((left, right) => left.sourceReportId.localeCompare(right.sourceReportId)),
    latestOutcome: outcomeRows.length ? outcomeRows.slice().sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.batchId.localeCompare(right.batchId)).slice(-1)[0] : null,
    outstandingPrecommitIds: outstanding.map(item => item.precommitId).sort(),
    missedTransitions: { count: missed.length, digest: digest(missed) },
    chronology: { observedTransitions: chronology.length, sameCycleCredits: chronology.filter(row => Date.parse(row.precommittedAt) >= Date.parse(row.nextReportFirstRecordedAt)).length, digest: digest(chronology) },
    holds: context.reports.chronologyHolds.slice().sort(),
    discovery: { ignoredStagingEntries: context.ignoredStagingEntries },
    retention: { externalReportBytesCopied: 0, rawReceiptClaimsCopied: 0, durablePrecommitAndOutcomeProjectionsOnly: true },
    sourceDigest: null
  });
  source.sourceDigest = digest(Object.assign({}, source, { sourceDigest: null }));
  if (Buffer.byteLength(JSON.stringify(source), 'utf8') > MAX_CYCLE_SOURCE_BYTES) throw new Error('Workshop verification Outcome bridge cycle source exceeds its byte bound');
  return stable(source);
}
function normalizeTrigger(trigger) {
  exactKeys(trigger, ['id', 'digest', 'at', 'kind'], 'Workshop verification Outcome bridge trigger');
  return { id: machineId(trigger.id, 'trigger id'), digest: sha(trigger.digest, 'trigger digest'), at: iso(trigger.at, 'trigger at'), kind: machineId(trigger.kind, 'trigger kind') };
}
function normalizeSource(source) {
  rejectHidden(source);
  exactKeys(source, ['schema', 'trigger', 'inventories', 'latestReports', 'currentPrecommits', 'latestOutcome', 'outstandingPrecommitIds', 'missedTransitions', 'chronology', 'holds', 'discovery', 'retention', 'sourceDigest'], 'Workshop verification Outcome bridge source');
  if (source.schema !== SOURCE_SCHEMA || !SHA256.test(source.sourceDigest || '')) throw new Error('Workshop verification Outcome bridge source identity changed');
  const expectedDigest = digest(Object.assign({}, source, { sourceDigest: null }));
  if (source.sourceDigest !== expectedDigest) throw new Error('Workshop verification Outcome bridge source digest changed');
  const normalized = stable(clone(source));
  normalized.trigger = normalizeTrigger(normalized.trigger);
  if (normalized.chronology.sameCycleCredits !== 0) throw new Error('Workshop verification Outcome bridge source contains retrospective credit');
  if (normalized.retention.externalReportBytesCopied !== 0 || normalized.retention.rawReceiptClaimsCopied !== 0 || normalized.retention.durablePrecommitAndOutcomeProjectionsOnly !== true) throw new Error('Workshop verification Outcome bridge retained raw report material');
  return normalized;
}
function cycleBasis(cycle) {
  const basis = clone(cycle);
  basis.cycleId = null;
  basis.cycleDigest = null;
  return basis;
}
function run(sourceInput, options = {}) {
  const source = normalizeSource(sourceInput);
  const createdAt = iso(options.at || source.trigger.at, 'cycle createdAt');
  const holds = source.holds.slice();
  for (const report of source.latestReports) {
    const matches = source.currentPrecommits.filter(precommit => precommit.sourceReportId === report.reportId);
    if (matches.length === 0 && Date.parse(createdAt) <= Date.parse(report.firstRecordedAt)) holds.push(`TRIGGER_NOT_AFTER_LATEST_REPORT:${report.reportId}`);
    if (matches.length > 1) holds.push(`MULTIPLE_CURRENT_PRECOMMITS:${report.reportId}`);
  }
  let state = 'NO_VERIFIED_REPORTS';
  if (holds.length) state = 'HOLD_BRIDGE_CONTRADICTION';
  else if (source.inventories.reports.distinct === 0) state = 'NO_VERIFIED_REPORTS';
  else if (source.inventories.outcomes.count > 0) state = 'OUTCOMES_AVAILABLE_WAITING_FOR_LATER_DISTINCT_REPORT';
  else if (source.currentPrecommits.length === source.latestReports.length) state = 'WAITING_FOR_LATER_DISTINCT_REPORT';
  else state = 'HOLD_CURRENT_REPORT_NOT_PRECOMMITTED';
  const summary = {
    distinctReports: source.inventories.reports.distinct,
    acceptedIntakes: source.inventories.reports.acceptedIntakes,
    duplicateIntakes: source.inventories.reports.duplicateIntakes,
    heldIntakes: source.inventories.reports.heldIntakes,
    precommits: source.inventories.precommits.count,
    outcomeBatches: source.inventories.outcomes.count,
    outstandingPrecommits: source.outstandingPrecommitIds.length,
    missedUnpredictedTransitions: source.missedTransitions.count,
    observedTransitions: source.chronology.observedTransitions,
    sameCycleOutcomeCredits: source.chronology.sameCycleCredits,
    persistenceBaselinePredictionsInCurrentPrecommits: source.currentPrecommits.reduce((sum, row) => sum + row.predictionIds.length, 0),
    probabilityValuesGenerated: 0,
    externalReportBytesCopied: 0,
    rawReceiptClaimsCopied: 0,
    independentAuthorshipCertifications: 0,
    externalTimeCertifications: 0,
    evidenceAdmissions: 0,
    trainingAdmissions: 0,
    methodSelections: 0,
    repairsApplied: 0,
    permissionGrants: 0,
    toolCalls: 0,
    runtimeAdmissions: 0,
    runtimePromotions: 0,
    canonChanges: 0,
    worldActions: 0
  };
  const cycle = stable({
    schema: CYCLE_SCHEMA,
    cycleId: null,
    cycleDigest: null,
    createdAt,
    organ: { id: ORGAN_ID, status: 'TEST', learnedWeights: false, claimCeiling: CLAIM_CEILING },
    trigger: source.trigger,
    state,
    source,
    routes: { latestReports: source.latestReports, currentPrecommits: source.currentPrecommits, latestOutcome: source.latestOutcome, outstandingPrecommitIds: source.outstandingPrecommitIds },
    holds: Array.from(new Set(holds)).sort(),
    summary,
    authority: authority(),
    boundary: 'This TEST bridge deduplicates exact report bytes, seals a fixed persistence baseline only from the latest already verified report, observes it only against the next distinct same-profile report whose first local intake is later than the precommit, and records a standard private Outcome batch before sealing the next precommit. It retains projections and digests rather than raw reports or claims. This is real local separate-verifier evidence, not certified independent authorship or external chronology, and it cannot invent arbitrary predictions or probabilities, admit evidence or training, select a method or repair, grant permission, use tools, enter or promote runtime, change CANON, or act.'
  });
  cycle.cycleId = `workshop-verification-outcome-bridge-${digest(Object.assign({}, cycle, { cycleId: null, cycleDigest: null })).slice(0, 24)}`;
  cycle.cycleDigest = digest(Object.assign({}, cycle, { cycleDigest: null }));
  return stable(cycle);
}
function verify(cycle, sourceInput, runDir) {
  exactKeys(cycle, ['schema', 'cycleId', 'cycleDigest', 'createdAt', 'organ', 'trigger', 'state', 'source', 'routes', 'holds', 'summary', 'authority', 'boundary'], 'Workshop verification Outcome bridge cycle');
  const source = normalizeSource(sourceInput);
  if (cycle.schema !== CYCLE_SCHEMA || cycle.organ.id !== ORGAN_ID || cycle.organ.claimCeiling !== CLAIM_CEILING || !same(cycle.authority, authority())) throw new Error('Workshop verification Outcome bridge cycle boundary changed');
  if (!same(cycle.source, source) || !same(cycle.trigger, source.trigger)) throw new Error('Workshop verification Outcome bridge cycle source changed');
  if (cycle.summary.sameCycleOutcomeCredits !== 0 || cycle.summary.probabilityValuesGenerated !== 0 || cycle.summary.externalReportBytesCopied !== 0 || cycle.summary.rawReceiptClaimsCopied !== 0 || cycle.summary.independentAuthorshipCertifications !== 0 || cycle.summary.externalTimeCertifications !== 0 || cycle.summary.evidenceAdmissions !== 0 || cycle.summary.trainingAdmissions !== 0 || cycle.summary.methodSelections !== 0 || cycle.summary.repairsApplied !== 0 || cycle.summary.permissionGrants !== 0 || cycle.summary.toolCalls !== 0 || cycle.summary.runtimeAdmissions !== 0 || cycle.summary.runtimePromotions !== 0 || cycle.summary.canonChanges !== 0 || cycle.summary.worldActions !== 0) throw new Error('Workshop verification Outcome bridge cycle gained authority or retrospective credit');
  const reconstructed = run(source, { at: cycle.createdAt });
  if (!same(reconstructed, cycle)) throw new Error('Workshop verification Outcome bridge cycle does not replay');
  if (runDir) {
    const storedCycle = JSON.parse(fs.readFileSync(path.join(runDir, 'cycle.json'), 'utf8'));
    const storedSource = JSON.parse(fs.readFileSync(path.join(runDir, 'source.json'), 'utf8'));
    if (!same(storedCycle, cycle) || !same(storedSource, source)) throw new Error('stored Workshop verification Outcome bridge cycle changed');
  }
  return true;
}
function recordCycle(cycle, source, options = {}) {
  verify(cycle, source);
  if (options.write === false) return { cycle, source, written: false, reused: false, runDir: null };
  const root = path.resolve(options.stateDir || DEFAULT_CYCLE_STATE_DIR);
  fs.mkdirSync(root, { recursive: true });
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Workshop verification Outcome bridge cycle root must be a real directory');
  const finalDir = path.join(root, cycle.cycleId);
  if (fs.existsSync(finalDir)) {
    verify(cycle, source, finalDir);
    return { cycle, source, written: false, reused: true, runDir: finalDir };
  }
  const stageDir = path.join(root, `.stage-${cycle.cycleId}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(stageDir);
  fs.writeFileSync(path.join(stageDir, 'cycle.json'), `${JSON.stringify(cycle, null, 2)}\n`, { flag: 'wx' });
  fs.writeFileSync(path.join(stageDir, 'source.json'), `${JSON.stringify(source, null, 2)}\n`, { flag: 'wx' });
  verify(cycle, source, stageDir);
  const commit = ImmutableStore.commitDirectory(stageDir, finalDir);
  verify(cycle, source, commit.runDir);
  return { cycle, source, written: !commit.reused, reused: commit.reused, runDir: commit.runDir };
}
function runCurrent(options = {}) {
  const trigger = normalizeTrigger(options.trigger);
  const write = options.write !== false;
  let context = loadContext(options);
  const effects = [];
  const holds = [];

  for (const precommit of context.precommits.slice().sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.precommitId.localeCompare(right.precommitId))) {
    const nextEvent = directNextEvent(precommit, context.reports.events);
    if (!nextEvent) continue;
    const matches = exactOutcomeMatches(precommit, nextEvent, context.outcomes);
    if (matches.length > 1) { holds.push(`MULTIPLE_OUTCOMES_FOR_PRECOMMIT:${precommit.precommitId}`); continue; }
    if (matches.length === 1) continue;
    if (Date.parse(precommit.createdAt) >= Date.parse(nextEvent.firstRecordedAt)) { holds.push(`RETROSPECTIVE_OUTCOME_REFUSED:${precommit.precommitId}:${nextEvent.reportId}`); continue; }
    const observations = precommit.predictions.map(prediction => buildObservation(prediction, nextEvent));
    const result = write
      ? OutcomeLearning.record({ predictions: precommit.predictions, observations, previousCorrections: [] }, { at: trigger.at, write: true, stateDir: options.outcomeStateDir || DEFAULT_OUTCOME_STATE_DIR })
      : { batch: OutcomeLearning.run({ predictions: precommit.predictions, observations, previousCorrections: [] }, { at: trigger.at }), written: false, reused: false, runDir: null };
    verifyBridgeOutcome(result.batch, precommit, nextEvent);
    effects.push({ phase: 'OBSERVE_PRIOR_PRECOMMIT', precommitId: precommit.precommitId, nextReportId: nextEvent.reportId, outcomeBatchId: result.batch.batchId, written: result.written, reused: result.reused });
    context.outcomes.push(result.batch);
    context.observations = allBridgeObservations(context.outcomes);
  }

  const latest = latestEvents(context.reports.events);
  for (const event of latest) {
    const matches = context.precommits.filter(precommit => precommit.sourceReport.reportId === event.reportId);
    if (matches.length > 1) { holds.push(`MULTIPLE_CURRENT_PRECOMMITS:${event.reportId}`); continue; }
    if (matches.length === 1) continue;
    if (Date.parse(trigger.at) <= Date.parse(event.firstRecordedAt)) { holds.push(`TRIGGER_NOT_AFTER_LATEST_REPORT:${event.reportId}`); continue; }
    const sameProfileBefore = profileEvents(context.reports.events, event.profileId).filter(item => Date.parse(item.firstRecordedAt) < Date.parse(trigger.at));
    const previousPredictions = context.precommits.flatMap(item => item.predictions);
    const precommit = buildPrecommit(event, sameProfileBefore, previousPredictions, context.observations, trigger.at);
    const result = recordPrecommit(precommit, { write, stateDir: options.precommitStateDir || DEFAULT_PRECOMMIT_STATE_DIR });
    effects.push({ phase: 'PRECOMMIT_LATEST_REPORT', sourceReportId: event.reportId, precommitId: result.precommit.precommitId, predictions: result.precommit.predictions.length, written: result.written, reused: result.reused });
    context.precommits.push(result.precommit);
  }

  if (write) context = loadContext(options);
  context.reports.chronologyHolds = context.reports.chronologyHolds.concat(holds);
  const source = projectSource(context, trigger);
  const cycle = run(source, { at: trigger.at });
  verify(cycle, source);
  const stored = recordCycle(cycle, source, { write, stateDir: options.stateDir || DEFAULT_CYCLE_STATE_DIR });
  return { cycle: stored.cycle, source: stored.source, effects, written: stored.written, reused: stored.reused, runDir: stored.runDir };
}

module.exports = {
  ROOT,
  ORGAN_ID,
  PRECOMMIT_SCHEMA,
  CYCLE_SCHEMA,
  SOURCE_SCHEMA,
  CLAIM_CEILING,
  DEFAULT_ARCHIVE_ROOT,
  DEFAULT_PRECOMMIT_STATE_DIR,
  DEFAULT_OUTCOME_STATE_DIR,
  DEFAULT_CYCLE_STATE_DIR,
  BASELINE_METHOD,
  METHOD,
  REPORT_FIELD_SCHEMA,
  CATEGORY_FIELD_SCHEMA,
  digest,
  same,
  authority,
  reportProjection,
  validateIntakePair,
  loadReportEvents,
  targetDefinitions,
  buildPrecommit,
  verifyPrecommitEnvelope,
  verifyPrecommit,
  buildObservation,
  verifyBridgeOutcome,
  normalizeSource,
  run,
  verify,
  runCurrent
};
