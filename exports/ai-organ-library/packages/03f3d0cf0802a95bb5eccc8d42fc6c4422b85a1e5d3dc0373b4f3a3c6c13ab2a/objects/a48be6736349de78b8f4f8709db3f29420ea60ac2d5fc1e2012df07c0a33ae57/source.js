'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');
const Experience = require('./reasoning-experience-organ');
const DraftCell = require('../kernel/declarative-reasoning-organ-recipe-draft-cell');

const ORGAN_ID = 'axm.mirror.organ/reasoning-recipe-example-discovery-v1';
const BATCH_SCHEMA = 'axm.mirror.reasoning-recipe-example-discovery-batch/v1';
const MATERIALIZATION_SCHEMA = 'axm.mirror.reasoning-recipe-example-materialization-receipt/v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_RECEIPTS_DIR = path.join(ROOT, 'training', 'datasets', 'reasoning-receipts');
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'reasoning-recipe-example-discovery-runs');
const MAX_RECEIPTS = 256;
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_RECEIPT_BYTES = 64 * 1024 * 1024;
const INFORMATION_VALUE_MAPPING = 'LOW:[0,0.4);MEDIUM:[0.4,0.75);HIGH:[0.75,1]';
const ACTION_KINDS = new Set(['ASK', 'OBSERVE', 'HOLD']);
const COSTS = new Set(['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']);
const IDENTIFIER = /^[a-zA-Z0-9._:/-]+$/;
const SOURCE_PATHS = Object.freeze([
  'organs/reasoning-recipe-example-discovery-organ.js',
  'organs/reasoning-experience-organ.js',
  'kernel/declarative-reasoning-organ-recipe-draft-cell.js',
  'kernel/immutable-batch-store.js',
  'contracts/reasoning-experience-receipt.schema.json',
  'contracts/declarative-reasoning-organ-recipe-authoring-example.schema.json',
  'contracts/reasoning-recipe-example-discovery-batch.schema.json',
  'contracts/reasoning-recipe-example-materialization-receipt.schema.json'
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => {
    output[key] = stable(value[key]);
    return output;
  }, {});
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function shaBytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function json(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function without(value, key) { const copy = clone(value); delete copy[key]; return copy; }
function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, maximum); }

function inside(root, target) {
  const relation = path.relative(path.resolve(root), path.resolve(target));
  return !!relation && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation);
}

function portableRelative(root, target) {
  if (!inside(root, target)) throw new Error('reasoning recipe discovery source must stay inside the Mirror root');
  return path.relative(path.resolve(root), path.resolve(target)).split(path.sep).join('/');
}

function sourceLineage(root = ROOT) {
  return SOURCE_PATHS.map(sourcePath => {
    const file = path.join(root, sourcePath);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw new Error(`reasoning recipe discovery source must be one bounded real file: ${sourcePath}`);
    const bytes = fs.readFileSync(file);
    return { path: sourcePath, bytes: bytes.length, sha256: shaBytes(bytes) };
  });
}

function readReceiptFile(root, file, expectedSha256 = null) {
  root = path.resolve(root);
  file = path.resolve(file);
  if (!inside(root, file)) throw new Error('reasoning recipe discovery receipt must stay inside the Mirror root');
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > MAX_RECEIPT_BYTES) throw new Error('reasoning recipe discovery receipt must be one bounded real file');
  const first = fs.readFileSync(file);
  const second = fs.readFileSync(file);
  if (!first.equals(second)) throw new Error('reasoning recipe discovery receipt changed while read');
  const sha256 = shaBytes(first);
  if (expectedSha256 && sha256 !== expectedSha256) throw new Error(`reasoning recipe discovery source receipt changed: ${portableRelative(root, file)}`);
  const receipt = JSON.parse(first.toString('utf8'));
  Experience.verify(receipt);
  if (path.basename(file) !== `${receipt.receiptId}.json`) throw new Error(`reasoning recipe discovery receipt filename changed: ${portableRelative(root, file)}`);
  return { file, sourceFile: portableRelative(root, file), sourceFileSha256: sha256, bytes: first.length, receipt };
}

function scanReceiptDirectory(root = ROOT, receiptsDir = DEFAULT_RECEIPTS_DIR) {
  root = path.resolve(root);
  receiptsDir = path.resolve(receiptsDir);
  if (!inside(root, receiptsDir)) throw new Error('reasoning recipe discovery directory must stay inside the Mirror root');
  if (!fs.existsSync(receiptsDir)) return [];
  const stat = fs.lstatSync(receiptsDir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('reasoning recipe discovery source must be one real directory');
  const names = fs.readdirSync(receiptsDir).filter(name => name.endsWith('.json')).sort();
  if (names.length > MAX_RECEIPTS) throw new Error(`reasoning recipe discovery accepts at most ${MAX_RECEIPTS} receipts`);
  const loaded = [];
  let totalBytes = 0;
  for (const name of names) {
    if (!/^reasoning-experience-[a-f0-9]{24}\.json$/.test(name)) throw new Error(`reasoning recipe discovery found an unexpected JSON file: ${name}`);
    const item = readReceiptFile(root, path.join(receiptsDir, name));
    totalBytes += item.bytes;
    if (totalBytes > MAX_TOTAL_RECEIPT_BYTES) throw new Error(`reasoning recipe discovery receipt bytes exceed ${MAX_TOTAL_RECEIPT_BYTES}`);
    loaded.push(item);
  }
  const receiptIds = loaded.map(item => item.receipt.receiptId);
  const sourceGroups = loaded.map(item => item.receipt.source.sourceGroup);
  if (new Set(receiptIds).size !== receiptIds.length) throw new Error('reasoning recipe discovery receipt IDs must be unique');
  if (new Set(sourceGroups).size !== sourceGroups.length) throw new Error('reasoning recipe discovery source groups must be unique');
  return loaded;
}

function informationValueLabel(value) {
  value = Number(value);
  if (!Number.isFinite(value) || value < 0 || value > 1) return null;
  if (value < 0.4) return 'LOW';
  if (value < 0.75) return 'MEDIUM';
  return 'HIGH';
}

function identifier(value, maximum = 160) {
  value = clean(value, maximum + 1);
  return value && value.length <= maximum && IDENTIFIER.test(value) ? value : null;
}

function baseRecord(loaded) {
  const receipt = loaded.receipt;
  const evaluator = receipt.source && receipt.source.evaluator || {};
  return {
    receiptId: receipt.receiptId,
    receiptDigest: receipt.receiptDigest,
    sourceFile: loaded.sourceFile,
    sourceFileSha256: loaded.sourceFileSha256,
    sourceGroupId: clean(receipt.source && receipt.source.sourceGroup, 200),
    experienceKind: receipt.source && receipt.source.experienceKind || 'REAL_LOCAL_LESSON',
    evaluator: {
      id: clean(evaluator.id, 200),
      kind: clean(evaluator.kind, 160),
      declaredIndependent: evaluator.independent === true,
      sourceRefDigest: digest(clean(evaluator.sourceRef, 1000)),
      sourceDigest: clean(evaluator.sourceDigest, 64).toLowerCase()
    },
    permissionBasisDigest: digest(clean(receipt.source && receipt.source.permissionBasis, 1000)),
    contextDigest: digest(receipt.reasoningSession),
    state: 'HELD',
    reasonCode: null,
    label: null
  };
}

function held(base, reasonCode) {
  return Object.assign({}, base, { state: 'HELD', reasonCode: clean(reasonCode, 120), label: null });
}

function arraysEqual(left, right) {
  return Array.isArray(left) && Array.isArray(right) && JSON.stringify(left) === JSON.stringify(right);
}

function buildRecord(loaded) {
  const receipt = loaded.receipt;
  Experience.verify(receipt);
  const base = baseRecord(loaded);
  const eligibility = Experience.trainingEligibility(receipt);
  if (!eligibility.eligible) return held(base, `HOLD_${clean(eligibility.state, 100).toUpperCase()}`);
  if (!identifier(base.sourceGroupId) || !identifier(base.evaluator.id) || !base.evaluator.declaredIndependent) return held(base, 'HOLD_SOURCE_IDENTIFIER_OR_INDEPENDENCE_OUT_OF_BOUNDS');

  const decision = receipt.reasoningSession && receipt.reasoningSession.principleTrace && receipt.reasoningSession.principleTrace.decision || {};
  const candidates = (receipt.reasoningSession && receipt.reasoningSession.principleTrace && Array.isArray(receipt.reasoningSession.principleTrace.candidates) ? receipt.reasoningSession.principleTrace.candidates : []).filter(item => item && item.action && item.action.id === decision.selectedActionId);
  const profiles = (receipt.reasoningSession && receipt.reasoningSession.pathSet && Array.isArray(receipt.reasoningSession.pathSet.profiles) ? receipt.reasoningSession.pathSet.profiles : []).filter(item => item && item.actionId === decision.selectedActionId);
  if (candidates.length !== 1 || profiles.length !== 1) return held(base, 'HOLD_SELECTED_ACTION_PROFILE_LINEAGE_MISSING');
  const candidate = candidates[0];
  const action = candidate.action || {};
  const profile = profiles[0];
  const actionKind = clean(action.kind, 30).toUpperCase();
  if (!ACTION_KINDS.has(actionKind)) return held(base, 'HOLD_UNSUPPORTED_EXPLICIT_ACTION_KIND');

  const evaluation = Experience.semanticEvaluation(receipt);
  if (evaluation.result !== 'WORKED' || evaluation.behaviorMatched !== true || evaluation.decisionMatched !== true || evaluation.outcomeSucceeded !== true || evaluation.outcomeVerified !== true || Number(evaluation.worldMutations) !== 0 || evaluation.runtimePointerChanged !== false || (evaluation.unexpectedSeams || []).length) {
    return held(base, 'HOLD_OUTCOME_NOT_VERIFIED_CLEAN_SUCCESS');
  }
  if ((action.requiredPermissions || []).length || (profile.requiredPermissions || []).length) return held(base, 'HOLD_ACTION_REQUIRES_PERMISSION');
  if (profile.toolRequest != null) return held(base, 'HOLD_ACTION_REQUIRES_TOOL');
  if ((action.possibleSideEffects || []).length) return held(base, 'HOLD_ACTION_DECLARES_SIDE_EFFECTS');
  if (action.reversible !== true || profile.reversible !== true || clean(action.risk, 20).toLowerCase() !== 'low') return held(base, 'HOLD_ACTION_NOT_LOW_RISK_REVERSIBLE');

  const strategyTags = Array.isArray(evaluation.strategyTags) ? evaluation.strategyTags.map(item => clean(item, 80)) : [];
  if (!strategyTags.length || strategyTags.length > 8 || new Set(strategyTags).size !== strategyTags.length || strategyTags.some(item => !identifier(item, 80))) return held(base, 'HOLD_STRATEGY_TAGS_OUT_OF_BOUNDS');
  if (!arraysEqual(strategyTags, profile.strategyTags) || !arraysEqual(strategyTags, receipt.trainingExample && receipt.trainingExample.strategyTags)) return held(base, 'HOLD_STRATEGY_LABEL_LINEAGE_DISAGREES');
  const estimatedCost = clean(profile.estimatedCost, 20).toUpperCase();
  if (!COSTS.has(estimatedCost)) return held(base, 'HOLD_ESTIMATED_COST_OUT_OF_BOUNDS');
  const rawInformationValue = Number(profile.informationValue);
  const informationValue = informationValueLabel(rawInformationValue);
  if (!informationValue) return held(base, 'HOLD_INFORMATION_VALUE_OUT_OF_BOUNDS');

  const expected = { actionKind, strategyTags, estimatedCost, informationValue };
  const labelBasis = {
    receiptId: receipt.receiptId,
    actionId: decision.selectedActionId,
    expected,
    rawInformationValue,
    informationValueMapping: INFORMATION_VALUE_MAPPING,
    strategyLabelSource: evaluation.strategyLabelSource,
    contextDigest: base.contextDigest
  };
  const label = Object.assign({}, labelBasis, {
    labelDigest: digest(labelBasis),
    fullContextPersisted: false,
    labelsInferredFromProse: 0
  });
  return Object.assign({}, base, { state: 'ELIGIBLE_EXPLICIT_MACHINE_LABEL', reasonCode: null, label });
}

function batchAuthority() {
  return {
    sourceRead: true,
    privateProposalTraceWrite: true,
    humanDecision: false,
    evidenceAdmission: false,
    reviewApproval: false,
    heldOutAuthoring: false,
    heldOutEvaluation: false,
    candidateBuild: false,
    candidateInstall: false,
    candidateLoad: false,
    pathSelection: false,
    toolUse: false,
    permissionGrant: false,
    trainingAdmission: false,
    runtimePromotion: false,
    canonChange: false,
    identityChange: false,
    worldAction: false
  };
}

function summaryFor(records) {
  const eligible = records.filter(item => item.state === 'ELIGIBLE_EXPLICIT_MACHINE_LABEL');
  const reasons = new Map();
  for (const record of records.filter(item => item.state === 'HELD')) reasons.set(record.reasonCode, (reasons.get(record.reasonCode) || 0) + 1);
  return {
    receiptsObserved: records.length,
    verifiedReceipts: records.length,
    eligibleExplicitLabels: eligible.length,
    heldReceipts: records.length - eligible.length,
    byActionKind: {
      ASK: eligible.filter(item => item.label.expected.actionKind === 'ASK').length,
      OBSERVE: eligible.filter(item => item.label.expected.actionKind === 'OBSERVE').length,
      HOLD: eligible.filter(item => item.label.expected.actionKind === 'HOLD').length
    },
    heldByReason: Array.from(reasons.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([reasonCode, count]) => ({ reasonCode, count })),
    labelsInferredFromProse: 0,
    fullContextsPersisted: 0,
    authoringExamplesPersisted: 0,
    recipeDraftsProduced: 0,
    humanReviews: 0,
    candidateFilesWritten: 0,
    trainingAdmissions: 0,
    runtimePromotions: 0,
    canonChanges: 0,
    worldActions: 0
  };
}

function stateFor(summary) {
  if (!summary.receiptsObserved) return 'NO_REASONING_RECEIPTS_FOUND';
  if (!summary.eligibleExplicitLabels) return 'ALL_RECEIPTS_HELD';
  if (summary.heldReceipts) return 'EXPLICIT_LABELS_DISCOVERED_WITH_HOLDS';
  return 'ALL_RECEIPTS_HAVE_ELIGIBLE_EXPLICIT_LABELS';
}

function buildBatchFromRecords(records, lineage) {
  records = records.slice().sort((left, right) => left.receiptId.localeCompare(right.receiptId));
  if (records.length > MAX_RECEIPTS || new Set(records.map(item => item.receiptId)).size !== records.length) throw new Error('reasoning recipe discovery record bound or uniqueness changed');
  const inputs = records.map(item => ({ receiptId: item.receiptId, receiptDigest: item.receiptDigest, sourceFile: item.sourceFile, sourceFileSha256: item.sourceFileSha256 }));
  const inputsDigest = digest({ organId: ORGAN_ID, sourceLineage: lineage, inputs });
  const summary = summaryFor(records);
  const batch = {
    schema: BATCH_SCHEMA,
    batchId: `reasoning-recipe-example-discovery-${inputsDigest.slice(0, 24)}`,
    batchDigest: null,
    inputsDigest,
    createdAt: null,
    organ: { id: ORGAN_ID, status: 'TEST_VERIFIED_EXPLICIT_LABEL_DISCOVERY_PROPOSAL_ONLY', learnedWeights: false },
    sourceLineage: clone(lineage),
    records: clone(records),
    summary,
    state: stateFor(summary),
    authority: batchAuthority(),
    boundary: 'This target-neutral TEST inventory reuses only explicit ASK, OBSERVE, or HOLD labels already sealed in verified permissioned reasoning-experience receipts. Unsupported, failed, permissionful, tool-using, side-effecting, non-reversible, malformed, or known-fail sources remain typed holds. It persists no full reasoning context and creates no authoring example, rule, review, held-out case, candidate, training admission, runtime change, CANON change, or world action.'
  };
  batch.batchDigest = digest(without(batch, 'batchDigest'));
  return batch;
}

function buildBatch(loaded, root = ROOT) {
  const records = loaded.map(buildRecord);
  return buildBatchFromRecords(records, sourceLineage(root));
}

function verifyBatch(batch, options = {}) {
  const root = path.resolve(options.root || ROOT);
  if (!batch || batch.schema !== BATCH_SCHEMA || !/^reasoning-recipe-example-discovery-[a-f0-9]{24}$/.test(String(batch.batchId || '')) || batch.batchDigest !== digest(without(batch, 'batchDigest'))) throw new Error('reasoning recipe discovery batch seal changed');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.status !== 'TEST_VERIFIED_EXPLICIT_LABEL_DISCOVERY_PROPOSAL_ONLY' || batch.organ.learnedWeights !== false) throw new Error('reasoning recipe discovery organ lineage changed');
  if (!same(batch.authority, batchAuthority())) throw new Error('reasoning recipe discovery authority changed');
  const lineage = sourceLineage(root);
  if (!same(batch.sourceLineage, lineage)) throw new Error('reasoning recipe discovery source lineage changed');
  if (!Array.isArray(batch.records) || batch.records.length > MAX_RECEIPTS) throw new Error('reasoning recipe discovery record bound changed');
  const rebuiltRecords = batch.records.map(record => {
    const loaded = readReceiptFile(root, path.join(root, record.sourceFile), record.sourceFileSha256);
    return buildRecord(loaded);
  });
  const expected = buildBatchFromRecords(rebuiltRecords, lineage);
  if (!same(expected, batch)) throw new Error('reasoning recipe discovery batch does not reconstruct from its sealed verified receipts');
  if (options.runDir) {
    const runDir = path.resolve(options.runDir);
    const name = path.basename(runDir);
    if (name !== batch.batchId && !name.startsWith(`.stage-${batch.batchId}-`)) throw new Error('stored reasoning recipe discovery directory does not match its batch ID');
    const file = path.join(runDir, 'batch.json');
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || !same(JSON.parse(fs.readFileSync(file, 'utf8')), batch)) throw new Error('stored reasoning recipe discovery batch changed');
  }
  return true;
}

function derive(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const receiptsDir = path.resolve(options.receiptsDir || path.join(root, 'training', 'datasets', 'reasoning-receipts'));
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'reasoning-recipe-example-discovery-runs'));
  if (!inside(root, receiptsDir) || !inside(root, stateDir)) throw new Error('reasoning recipe discovery private paths must stay inside the Mirror root');
  const batch = buildBatch(scanReceiptDirectory(root, receiptsDir), root);
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, batch.batchId);
  if (fs.existsSync(runDir)) {
    const stored = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    verifyBatch(stored, { root, runDir });
    return { batch: stored, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${batch.batchId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error('reasoning recipe discovery staging directory already exists');
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { encoding: 'utf8', flag: 'wx' });
  verifyBatch(batch, { root, runDir: stageDir });
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

function materializationAuthority() {
  return {
    humanDecision: false,
    evidenceAdmission: false,
    reviewApproval: false,
    heldOutAuthoring: false,
    heldOutEvaluation: false,
    candidateBuild: false,
    candidateInstall: false,
    candidateLoad: false,
    pathSelection: false,
    toolUse: false,
    permissionGrant: false,
    trainingAdmission: false,
    runtimePromotion: false,
    canonChange: false,
    identityChange: false,
    worldAction: false
  };
}

function evaluatorKind(receipt) {
  return ['SYNTHETIC_COUNTEREXAMPLE', 'CONTRACT_DERIVED_EXAM'].includes(receipt.source.experienceKind) ? 'TEST_FIXTURE' : 'EXTERNAL_EVALUATOR';
}

function materialize(batch, targetOrganId, options = {}) {
  const root = path.resolve(options.root || ROOT);
  verifyBatch(batch, { root });
  targetOrganId = identifier(targetOrganId);
  if (!targetOrganId) throw new Error('reasoning recipe materialization requires one exact target organ ID');
  const examples = [];
  const accepted = [];
  const holds = [];
  for (const record of batch.records) {
    if (record.state !== 'ELIGIBLE_EXPLICIT_MACHINE_LABEL') {
      holds.push({ sourceReceiptId: record.receiptId, reasonCode: record.reasonCode });
      continue;
    }
    const loaded = readReceiptFile(root, path.join(root, record.sourceFile), record.sourceFileSha256);
    const receipt = loaded.receipt;
    const evaluatorId = receipt.source.evaluator.id;
    const learnerId = clean(receipt.reasoningSession.identity && receipt.reasoningSession.identity.id || receipt.reasoningSession.identity, 200);
    const cellId = clean(receipt.reasoningSession.cell && receipt.reasoningSession.cell.id, 200);
    if ([evaluatorId, learnerId, cellId, receipt.organ.id].includes(targetOrganId)) {
      holds.push({ sourceReceiptId: record.receiptId, reasonCode: 'HOLD_TARGET_SOURCE_IDENTITY_CONFLICT' });
      continue;
    }
    const example = {
      schema: DraftCell.EXAMPLE_SCHEMA,
      exampleId: `reasoning-recipe/${receipt.receiptId}`,
      sourceGroupId: record.sourceGroupId,
      role: 'AUTHORING_TRAIN',
      usePermission: 'allowed',
      permissionBasis: receipt.source.permissionBasis,
      source: {
        evaluatorId,
        evaluatorKind: evaluatorKind(receipt),
        independentFromTarget: true,
        sourceRef: `mirror-private://${record.sourceFile}`,
        sourceDigest: record.sourceFileSha256
      },
      context: clone(receipt.reasoningSession),
      expected: clone(record.label.expected)
    };
    const exampleDigest = digest(example);
    examples.push(example);
    accepted.push({
      exampleId: example.exampleId,
      sourceReceiptId: record.receiptId,
      sourceGroupId: example.sourceGroupId,
      evaluatorId,
      exampleDigest,
      contextDigest: record.contextDigest,
      expected: clone(example.expected)
    });
  }
  examples.sort((left, right) => left.exampleId.localeCompare(right.exampleId));
  accepted.sort((left, right) => left.exampleId.localeCompare(right.exampleId));
  holds.sort((left, right) => left.sourceReceiptId.localeCompare(right.sourceReceiptId));
  const basis = {
    organId: ORGAN_ID,
    sourceBatchId: batch.batchId,
    sourceBatchDigest: batch.batchDigest,
    targetOrganId,
    accepted,
    holds
  };
  const receipt = {
    schema: MATERIALIZATION_SCHEMA,
    receiptId: `reasoning-recipe-example-materialization-${digest(basis).slice(0, 24)}`,
    receiptDigest: null,
    createdAt: null,
    organId: ORGAN_ID,
    sourceBatchId: batch.batchId,
    sourceBatchDigest: batch.batchDigest,
    targetOrganId,
    accepted,
    holds,
    summary: {
      sourceRecords: batch.records.length,
      acceptedExamples: accepted.length,
      holds: holds.length,
      labelsInferredFromProse: 0,
      fullContextsPersisted: 0,
      sourceIndependenceCertified: false,
      authoringRoleExpandedBeyondPermission: false,
      recipeDraftsProduced: 0,
      humanReviews: 0,
      candidateFilesWritten: 0,
      trainingAdmissions: 0,
      runtimePromotions: 0,
      canonChanges: 0,
      worldActions: 0
    },
    authority: materializationAuthority(),
    boundary: 'This receipt records ephemeral conversion of verified private training-role evidence into target-bound AUTHORING_TRAIN examples. Full reasoning contexts remain in memory only and are not written by this bridge. Independence is declared and identity-checked, not externally certified. The receipt is not a rule, review, held-out exam, candidate, training admission, runtime authority, CANON change, or action.'
  };
  receipt.receiptDigest = digest(without(receipt, 'receiptDigest'));
  return { examples, receipt };
}

function verifyMaterialization(receipt, batch, targetOrganId, options = {}) {
  if (!receipt || receipt.schema !== MATERIALIZATION_SCHEMA || !/^reasoning-recipe-example-materialization-[a-f0-9]{24}$/.test(String(receipt.receiptId || '')) || receipt.receiptDigest !== digest(without(receipt, 'receiptDigest'))) throw new Error('reasoning recipe example materialization seal changed');
  if (!same(receipt.authority, materializationAuthority())) throw new Error('reasoning recipe example materialization authority changed');
  const expected = materialize(batch, targetOrganId, options).receipt;
  if (!same(expected, receipt)) throw new Error('reasoning recipe example materialization does not reconstruct from its discovery batch');
  return true;
}

function composeRecipeDraft(batch, admissionInput, assessment, selector, options = {}) {
  if (!assessment || !assessment.proposedContract || !assessment.proposedContract.organId) throw new Error('reasoning recipe composition requires one exact PROPOSE_BUILD assessment');
  const materialized = materialize(batch, assessment.proposedContract.organId, options);
  if (!materialized.examples.length) return { state: 'HOLD_NO_ELIGIBLE_TARGET_BOUND_AUTHORING_EXAMPLES', materializationReceipt: materialized.receipt, request: null, draft: null };
  const request = { admissionInput, assessment, selector, examples: materialized.examples };
  const draft = DraftCell.build(request);
  return { state: draft.state, materializationReceipt: materialized.receipt, request, draft };
}

module.exports = {
  ORGAN_ID, BATCH_SCHEMA, MATERIALIZATION_SCHEMA, ROOT, DEFAULT_RECEIPTS_DIR, DEFAULT_STATE_DIR,
  MAX_RECEIPTS, MAX_RECEIPT_BYTES, MAX_TOTAL_RECEIPT_BYTES, INFORMATION_VALUE_MAPPING, SOURCE_PATHS,
  stable, digest, shaBytes, clone, same, sourceLineage, readReceiptFile, scanReceiptDirectory,
  informationValueLabel, buildRecord, batchAuthority, summaryFor, buildBatchFromRecords, buildBatch,
  verifyBatch, derive, materializationAuthority, materialize, verifyMaterialization, composeRecipeDraft
};
