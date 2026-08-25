'use strict';

const crypto = require('crypto');

const WORK_KINDS = Object.freeze([
  'ARTIFACT_BUILD',
  'ADMISSION_CHECK',
  'QUICK_TEST',
  'HEAVY_VERIFIER'
]);
const WORK_KIND_SET = new Set(WORK_KINDS);
const STOP_SIGNALS = Object.freeze([
  'CALLER_PAUSE',
  'REVIEW_CHECKPOINT_REQUESTED',
  'BLOCKING_FAILURE',
  'EVIDENCE_CONFLICT',
  'DEPENDENCY_UNAVAILABLE'
]);
const STOP_SIGNAL_SET = new Set(STOP_SIGNALS);
const ACTORS = new Set(['MACHINE', 'AI', 'HUMAN', 'UNKNOWN']);
const CEILING_RULES = Object.freeze({
  maxTotalDraftRevisions: 256,
  maxRevisionsPerDraft: 64,
  maxArtifactBuilds: 128,
  maxAdmissionChecks: 128,
  maxQuickTests: 128,
  maxHeavyVerifierRuns: 64
});
const KIND_TO_COUNTER = Object.freeze({
  ARTIFACT_BUILD: 'artifactBuilds',
  ADMISSION_CHECK: 'admissionChecks',
  QUICK_TEST: 'quickTests',
  HEAVY_VERIFIER: 'heavyVerifierRuns'
});
const COUNTER_TO_CEILING = Object.freeze({
  totalDraftRevisions: 'maxTotalDraftRevisions',
  maxObservedRevisionsPerDraft: 'maxRevisionsPerDraft',
  artifactBuilds: 'maxArtifactBuilds',
  admissionChecks: 'maxAdmissionChecks',
  quickTests: 'maxQuickTests',
  heavyVerifierRuns: 'maxHeavyVerifierRuns'
});

const AUTHORITY = Object.freeze({
  workspaceRead: false,
  workspaceMutation: false,
  toolExecution: false,
  network: false,
  install: false,
  deployment: false,
  promotion: false,
  merge: false,
  canon: false
});

function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}

function hash(v) {
  return crypto.createHash('sha256').update(canon(v)).digest('hex');
}

function actor(v) {
  const value = String(v || 'UNKNOWN').toUpperCase();
  return ACTORS.has(value) ? value : 'UNKNOWN';
}

function validBatch(batch) {
  return !!batch && batch.schema === 'axm.code.production-batch.v1' && batch.result === 'PRODUCTION_BATCH_READY' && !!batch.batchSha256;
}

function digestCurrent(record, digestField) {
  if (!record || !record[digestField]) return false;
  const core = { ...record };
  const expected = core[digestField];
  delete core[digestField];
  return hash(core) === expected;
}

function batchDraftIds(batch) {
  return new Set((Array.isArray(batch.slots) ? batch.slots : []).map(slot => String(slot && slot.draftId || '')).filter(Boolean));
}

function normalizeCeilings(ceilings) {
  if (!ceilings || typeof ceilings !== 'object' || Array.isArray(ceilings)) {
    return { result: 'PRODUCTION_BUDGET_CEILINGS_REQUIRED', errors: Object.keys(CEILING_RULES) };
  }
  const normalized = {};
  const errors = [];
  for (const [name, hardMaximum] of Object.entries(CEILING_RULES)) {
    const value = ceilings[name];
    if (!Number.isInteger(value) || value < 0 || value > hardMaximum) {
      errors.push({ name, value: value == null ? null : value, minimum: 0, hardMaximum });
    } else {
      normalized[name] = value;
    }
  }
  return errors.length
    ? { result: 'PRODUCTION_BUDGET_CEILINGS_INVALID', errors }
    : { result: 'PRODUCTION_BUDGET_CEILINGS_VALID', ceilings: normalized };
}

function createBudget({ batch, ceilings, label = null } = {}) {
  if (!validBatch(batch)) {
    return Object.freeze({ schema: 'axm.code.production-budget.v1', result: 'INVALID_BATCH', authority: 'NONE' });
  }
  const checked = normalizeCeilings(ceilings);
  if (checked.result !== 'PRODUCTION_BUDGET_CEILINGS_VALID') {
    return Object.freeze({
      schema: 'axm.code.production-budget.v1',
      result: checked.result,
      projectId: batch.projectId,
      batchSha256: batch.batchSha256,
      errors: checked.errors,
      authority: 'NONE'
    });
  }
  const core = {
    schema: 'axm.code.production-budget.v1',
    version: '1.0.0',
    result: 'PRODUCTION_BUDGET_READY',
    projectId: batch.projectId,
    batchSha256: batch.batchSha256,
    directionSha256: batch.directionSha256,
    label: label == null ? null : String(label),
    ceilings: Object.freeze({ ...checked.ceilings }),
    hardMaximums: CEILING_RULES,
    recognizedStopSignals: STOP_SIGNALS,
    truth: {
      budgetIsCeilingNotPermission: true,
      zeroCeilingMeansNoFurtherUnitsOfThatKind: true,
      reachingCeilingHoldsNextWork: true,
      budgetDoesNotRankDrafts: true,
      budgetDoesNotSelectWinner: true,
      admissionDoesNotStopOrSelectAutomatically: true,
      runtimeOrToolExecutionPerformed: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, budgetSha256: hash(core) });
}

function createWorkReceipt({
  batch,
  kind,
  draftId = null,
  draftRevisionSha256 = null,
  evidenceDigest,
  outcome = null,
  actorClass = 'UNKNOWN'
} = {}) {
  if (!validBatch(batch)) {
    return Object.freeze({ schema: 'axm.code.production-work-receipt.v1', result: 'INVALID_BATCH', authority: 'NONE' });
  }
  const normalizedKind = String(kind || '').toUpperCase();
  if (!WORK_KIND_SET.has(normalizedKind)) {
    return Object.freeze({
      schema: 'axm.code.production-work-receipt.v1',
      result: 'WORK_KIND_INVALID',
      kind: normalizedKind || null,
      allowedKinds: WORK_KINDS,
      authority: 'NONE'
    });
  }
  if (!evidenceDigest || !String(evidenceDigest).trim()) {
    return Object.freeze({
      schema: 'axm.code.production-work-receipt.v1',
      result: 'WORK_EVIDENCE_DIGEST_REQUIRED',
      kind: normalizedKind,
      authority: 'NONE'
    });
  }
  const allowedDraftIds = batchDraftIds(batch);
  if (!draftId || !allowedDraftIds.has(String(draftId))) {
    return Object.freeze({
      schema: 'axm.code.production-work-receipt.v1',
      result: 'WORK_DRAFT_REQUIRED_OR_FOREIGN',
      draftId: draftId == null ? null : String(draftId),
      authority: 'NONE'
    });
  }
  if (!draftRevisionSha256 || !String(draftRevisionSha256).trim()) {
    return Object.freeze({
      schema: 'axm.code.production-work-receipt.v1',
      result: 'WORK_DRAFT_REVISION_REQUIRED',
      draftId: String(draftId),
      authority: 'NONE'
    });
  }
  const core = {
    schema: 'axm.code.production-work-receipt.v1',
    version: '1.0.0',
    result: 'PRODUCTION_WORK_OBSERVED_NOT_AUTHORIZED',
    projectId: batch.projectId,
    batchSha256: batch.batchSha256,
    directionSha256: batch.directionSha256,
    kind: normalizedKind,
    draftId: draftId == null ? null : String(draftId),
    draftRevisionSha256: draftRevisionSha256 == null ? null : String(draftRevisionSha256),
    evidenceDigest: String(evidenceDigest),
    outcome: outcome == null ? null : String(outcome),
    observedBy: actor(actorClass),
    truth: {
      receiptRecordsClaimedObservation: true,
      receiptDoesNotProveWorkWithoutEvidence: true,
      receiptDoesNotAuthorizeAnotherRun: true,
      sourceBytesStored: false,
      toolExecutedByThisModule: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, receiptSha256: hash(core) });
}

function normalizeDrafts(batch, drafts) {
  const allowedDraftIds = batchDraftIds(batch);
  const accepted = (Array.isArray(drafts) ? drafts : []).filter(d =>
    d &&
    d.schema === 'axm.code.production-draft-revision.v1' &&
    d.batchSha256 === batch.batchSha256 &&
    d.directionSha256 === batch.directionSha256 &&
    allowedDraftIds.has(String(d.draftId)) &&
    d.draftRevisionSha256
  );
  const unique = new Map();
  for (const draft of accepted) unique.set(draft.draftRevisionSha256, draft);
  return [...unique.values()];
}

function measureUse({ batch, drafts = [], workReceipts = [] } = {}) {
  if (!validBatch(batch)) {
    return Object.freeze({ schema: 'axm.code.production-budget-use.v1', result: 'INVALID_BATCH', authority: 'NONE' });
  }
  const receipts = Array.isArray(workReceipts) ? workReceipts : [];
  const invalidReceipts = receipts.filter(receipt =>
    !receipt ||
    receipt.schema !== 'axm.code.production-work-receipt.v1' ||
    receipt.result !== 'PRODUCTION_WORK_OBSERVED_NOT_AUTHORIZED' ||
    receipt.batchSha256 !== batch.batchSha256 ||
    receipt.directionSha256 !== batch.directionSha256 ||
    !WORK_KIND_SET.has(receipt.kind) ||
    !batchDraftIds(batch).has(String(receipt.draftId)) ||
    !receipt.draftRevisionSha256 ||
    !digestCurrent(receipt, 'receiptSha256')
  );
  if (invalidReceipts.length) {
    return Object.freeze({
      schema: 'axm.code.production-budget-use.v1',
      result: 'INVALID_OR_FOREIGN_WORK_RECEIPT',
      invalidReceiptCount: invalidReceipts.length,
      authority: 'NONE'
    });
  }

  const revisions = normalizeDrafts(batch, drafts);
  const perDraft = new Map();
  for (const revision of revisions) {
    perDraft.set(revision.draftId, (perDraft.get(revision.draftId) || 0) + 1);
  }
  const uniqueReceipts = new Map();
  for (const receipt of receipts) uniqueReceipts.set(receipt.receiptSha256, receipt);
  const counters = {
    totalDraftRevisions: revisions.length,
    maxObservedRevisionsPerDraft: perDraft.size ? Math.max(...perDraft.values()) : 0,
    artifactBuilds: 0,
    admissionChecks: 0,
    quickTests: 0,
    heavyVerifierRuns: 0
  };
  for (const receipt of uniqueReceipts.values()) counters[KIND_TO_COUNTER[receipt.kind]] += 1;

  const core = {
    schema: 'axm.code.production-budget-use.v1',
    version: '1.0.0',
    result: 'PRODUCTION_BUDGET_USE_MEASURED',
    projectId: batch.projectId,
    batchSha256: batch.batchSha256,
    counters,
    revisionsByDraft: Object.fromEntries([...perDraft.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    uniqueWorkReceiptCount: uniqueReceipts.size,
    duplicateWorkReceiptCount: receipts.length - uniqueReceipts.size,
    truth: {
      countsObservedReceiptsNotEstimatedCost: true,
      duplicateReceiptIdentityCountedOnce: true,
      missingReceiptMeansUnobservedNotZeroRealWorldCost: true,
      rawSourceInspected: false,
      draftRevisionDigestVerificationRemainsUpstream: true,
      rankingPerformed: false
    },
    authority: 'NONE'
  };
  return Object.freeze({ ...core, useSha256: hash(core) });
}

function normalizeStopSignals(rawSignals) {
  const values = Array.isArray(rawSignals) ? rawSignals : [];
  const signals = [];
  const invalid = [];
  for (const raw of values.slice(0, 32)) {
    const code = String(typeof raw === 'string' ? raw : raw && raw.code || '').toUpperCase();
    if (!STOP_SIGNAL_SET.has(code)) {
      invalid.push(code || null);
      continue;
    }
    signals.push({
      code,
      detail: typeof raw === 'object' && raw && raw.detail != null ? String(raw.detail) : null,
      evidenceDigest: typeof raw === 'object' && raw && raw.evidenceDigest != null ? String(raw.evidenceDigest) : null
    });
  }
  const unique = new Map();
  for (const signal of signals) unique.set(canon(signal), signal);
  return { signals: [...unique.values()].sort((a, b) => a.code.localeCompare(b.code)), invalid };
}

function assessBudget({
  batch,
  budget,
  drafts = [],
  workReceipts = [],
  currentDirection = null,
  stopSignals = []
} = {}) {
  if (!validBatch(batch)) {
    return Object.freeze({ schema: 'axm.code.production-budget-status.v1', result: 'INVALID_BATCH', authority: 'NONE' });
  }
  if (!budget || budget.schema !== 'axm.code.production-budget.v1' || budget.result !== 'PRODUCTION_BUDGET_READY' || budget.batchSha256 !== batch.batchSha256 || !digestCurrent(budget, 'budgetSha256')) {
    return Object.freeze({ schema: 'axm.code.production-budget-status.v1', result: 'INVALID_OR_FOREIGN_BUDGET', authority: 'NONE' });
  }
  const use = measureUse({ batch, drafts, workReceipts });
  if (use.result !== 'PRODUCTION_BUDGET_USE_MEASURED') {
    return Object.freeze({
      schema: 'axm.code.production-budget-status.v1',
      result: 'PRODUCTION_BUDGET_USE_HELD',
      use,
      authority: 'NONE'
    });
  }
  const normalizedSignals = normalizeStopSignals(stopSignals);
  if (normalizedSignals.invalid.length) {
    return Object.freeze({
      schema: 'axm.code.production-budget-status.v1',
      result: 'INVALID_STOP_SIGNAL',
      invalidSignals: normalizedSignals.invalid,
      allowedSignals: STOP_SIGNALS,
      authority: 'NONE'
    });
  }

  const conditions = [];
  let directionStatus = 'CURRENT_DIRECTION_NOT_SUPPLIED';
  if (currentDirection && currentDirection.schema === 'axm.code.work-direction.v1') {
    if (currentDirection.projectId !== batch.projectId) {
      directionStatus = 'PROJECT_MISMATCH';
      conditions.push({ code: 'DIRECTION_PROJECT_MISMATCH', source: 'DIRECTION_BINDING' });
    } else if (currentDirection.directionSha256 !== batch.directionSha256) {
      directionStatus = 'PRODUCTION_BATCH_DIRECTION_STALE';
      conditions.push({ code: 'DIRECTION_CHANGED', source: 'DIRECTION_BINDING' });
    } else {
      directionStatus = 'PRODUCTION_BATCH_DIRECTION_CURRENT';
    }
  } else {
    conditions.push({ code: 'CURRENT_DIRECTION_NOT_SUPPLIED', source: 'DIRECTION_BINDING' });
  }

  const limits = {};
  for (const [counter, ceilingName] of Object.entries(COUNTER_TO_CEILING)) {
    const used = use.counters[counter];
    const ceiling = budget.ceilings[ceilingName];
    const state = used > ceiling ? 'CEILING_EXCEEDED' : used === ceiling ? 'CEILING_REACHED' : 'WITHIN_CEILING';
    limits[counter] = { used, ceiling, remaining: Math.max(0, ceiling - used), state };
    if (state !== 'WITHIN_CEILING') conditions.push({ code: state, counter, ceilingName, used, ceiling, source: 'BUDGET' });
  }
  for (const signal of normalizedSignals.signals) conditions.push({ ...signal, source: 'CALLER_OR_OBSERVER_SIGNAL' });

  const held = conditions.length > 0;
  const core = {
    schema: 'axm.code.production-budget-status.v1',
    version: '1.0.0',
    result: held ? 'PRODUCTION_WORK_HELD' : 'PRODUCTION_WORK_WITHIN_BUDGET',
    projectId: batch.projectId,
    batchSha256: batch.batchSha256,
    directionStatus,
    budgetSha256: budget.budgetSha256,
    useSha256: use.useSha256,
    limits,
    revisionsByDraft: use.revisionsByDraft,
    draftIds: [...batchDraftIds(batch)].sort(),
    stopConditions: conditions,
    truth: {
      withinBudgetIsNotExecutionPermission: true,
      heldDoesNotDeleteOrRejectDrafts: true,
      heldDoesNotSelectWinner: true,
      admittedDraftDoesNotEndProductionAutomatically: true,
      noScoreOrQualityRankCalculated: true,
      missingReceiptsMayUnderstateRealWork: true,
      toolExecutedByThisModule: false
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, budgetStatusSha256: hash(core) });
}

function checkProposedWork({ status, kind, units = 1, draftId = null } = {}) {
  if (!status || status.schema !== 'axm.code.production-budget-status.v1' || !digestCurrent(status, 'budgetStatusSha256')) {
    return Object.freeze({ schema: 'axm.code.production-work-preflight.v1', result: 'INVALID_BUDGET_STATUS', authority: 'NONE' });
  }
  if (status.result !== 'PRODUCTION_WORK_WITHIN_BUDGET') {
    return Object.freeze({
      schema: 'axm.code.production-work-preflight.v1',
      result: 'PROPOSED_WORK_HELD_BY_BUDGET_STATUS',
      budgetStatusSha256: status.budgetStatusSha256,
      stopConditions: status.stopConditions || [],
      authority: 'NONE'
    });
  }
  if (!Number.isInteger(units) || units < 1 || units > 64) {
    return Object.freeze({ schema: 'axm.code.production-work-preflight.v1', result: 'PROPOSED_WORK_UNITS_INVALID', authority: 'NONE' });
  }
  const normalizedKind = String(kind || '').toUpperCase();
  const failures = [];
  if (normalizedKind === 'DRAFT_REVISION') {
    if (!draftId) {
      return Object.freeze({ schema: 'axm.code.production-work-preflight.v1', result: 'DRAFT_ID_REQUIRED_FOR_REVISION_BUDGET', authority: 'NONE' });
    }
    if (!Array.isArray(status.draftIds) || !status.draftIds.includes(String(draftId))) {
      return Object.freeze({ schema: 'axm.code.production-work-preflight.v1', result: 'PROPOSED_DRAFT_ID_NOT_IN_BATCH', draftId: String(draftId), authority: 'NONE' });
    }
    const total = status.limits.totalDraftRevisions;
    const perDraft = status.limits.maxObservedRevisionsPerDraft;
    const currentForDraft = status.revisionsByDraft[String(draftId)] || 0;
    if (total.used + units > total.ceiling) failures.push({ code: 'WOULD_EXCEED_TOTAL_DRAFT_REVISIONS', used: total.used, proposed: units, ceiling: total.ceiling });
    if (currentForDraft + units > perDraft.ceiling) failures.push({ code: 'WOULD_EXCEED_REVISIONS_PER_DRAFT', draftId: String(draftId), used: currentForDraft, proposed: units, ceiling: perDraft.ceiling });
  } else if (WORK_KIND_SET.has(normalizedKind)) {
    const counter = KIND_TO_COUNTER[normalizedKind];
    const limit = status.limits[counter];
    if (limit.used + units > limit.ceiling) failures.push({ code: 'WOULD_EXCEED_WORK_CEILING', kind: normalizedKind, used: limit.used, proposed: units, ceiling: limit.ceiling });
  } else {
    return Object.freeze({
      schema: 'axm.code.production-work-preflight.v1',
      result: 'PROPOSED_WORK_KIND_INVALID',
      kind: normalizedKind || null,
      allowedKinds: ['DRAFT_REVISION', ...WORK_KINDS],
      authority: 'NONE'
    });
  }
  const core = {
    schema: 'axm.code.production-work-preflight.v1',
    version: '1.0.0',
    result: failures.length ? 'PROPOSED_WORK_WOULD_EXCEED_BUDGET' : 'PROPOSED_WORK_WITHIN_CEILING_NOT_AUTHORIZED',
    batchSha256: status.batchSha256,
    budgetStatusSha256: status.budgetStatusSha256,
    kind: normalizedKind,
    units,
    draftId: draftId == null ? null : String(draftId),
    failures,
    truth: {
      preflightDoesNotExecuteWork: true,
      withinCeilingIsNotPermission: true,
      preflightDoesNotSelectDraft: true
    },
    authority: AUTHORITY
  };
  return Object.freeze({ ...core, preflightSha256: hash(core) });
}

function snapshot() {
  const core = {
    schema: 'axm.code.production-budget-snapshot.v1',
    version: '1.0.0',
    workKinds: WORK_KINDS,
    stopSignals: STOP_SIGNALS,
    hardMaximums: CEILING_RULES,
    schemas: [
      'axm.code.production-budget.v1',
      'axm.code.production-work-receipt.v1',
      'axm.code.production-budget-use.v1',
      'axm.code.production-budget-status.v1',
      'axm.code.production-work-preflight.v1'
    ],
    authority: 'NONE'
  };
  return Object.freeze({ ...core, snapshotSha256: hash(core) });
}

module.exports = {
  WORK_KINDS,
  STOP_SIGNALS,
  CEILING_RULES,
  createBudget,
  createWorkReceipt,
  measureUse,
  assessBudget,
  checkProposedWork,
  snapshot
};
