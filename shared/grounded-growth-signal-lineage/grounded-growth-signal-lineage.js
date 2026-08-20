'use strict';

const crypto = require('crypto');
const Growth = require('../grounded-growth-outcomes/grounded-growth-outcomes');

const RECEIPT_SCHEMA = 'axm.grounded-growth-signal-lineage-receipt/v1';
const VERSION = '0.1.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SIGNAL_STATES = [
  'CURRENT_TECHNICAL_EVIDENCE',
  'WAITING_VOLUNTARY_HUMAN_EVIDENCE'
];
const PROPOSAL_STATES = [
  'REJECTED_NO_ACTION',
  'REJECTED_REDUNDANT_NO_ACTION',
  'DEFERRED_NO_ACTION'
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).sort().forEach((key) => { result[key] = stableValue(value[key]); });
    return result;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  if (extras.length) throw new Error(label + ' has unsupported field(s): ' + extras.join(', '));
  if (missing.length) throw new Error(label + ' is missing field(s): ' + missing.join(', '));
}

function text(value, label, maximum) {
  const result = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > (maximum || 240)) throw new Error(label + ' is too long');
  return result;
}

function timestamp(value, label) {
  const result = text(value, label, 80);
  if (!Number.isFinite(Date.parse(result))) throw new Error(label + ' must be a timestamp');
  return new Date(result).toISOString();
}

function reference(input, label) {
  exactKeys(input, ['id', 'schema', 'sha256'], label);
  const digest = text(input.sha256, label + ' sha256', 80).toLowerCase();
  if (!DIGEST.test(digest)) throw new Error(label + ' sha256 must be a SHA-256 digest');
  return {
    id: text(input.id, label + ' id', 180),
    schema: text(input.schema, label + ' schema', 240),
    sha256: digest
  };
}

function unique(values, label) {
  const seen = new Set();
  values.forEach((value) => {
    if (seen.has(value)) throw new Error(label + ' must be unique: ' + value);
    seen.add(value);
  });
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function validateDisposition(disposition) {
  if (!disposition || disposition.schema !== 'axm.research-disposition/v1') {
    throw new Error('research disposition schema mismatch');
  }
  if (!Array.isArray(disposition.acceptedSignals) || !disposition.acceptedSignals.length) {
    throw new Error('research disposition needs accepted signals');
  }
  if (!Array.isArray(disposition.rejectedOrDeferred) || !disposition.rejectedOrDeferred.length) {
    throw new Error('research disposition needs rejected or deferred proposals');
  }
  disposition.acceptedSignals.forEach((signal, index) => {
    ['id', 'statement', 'stage', 'sourceIds', 'currentDisposition'].forEach((field) => {
      if (signal[field] == null) throw new Error('accepted signal ' + index + ' lacks ' + field);
    });
    if (!Array.isArray(signal.sourceIds) || !signal.sourceIds.length) {
      throw new Error('accepted signal ' + index + ' needs sourceIds');
    }
  });
  disposition.rejectedOrDeferred.forEach((proposal, index) => {
    ['id', 'disposition', 'reason'].forEach((field) => {
      if (proposal[field] == null) throw new Error('proposal ' + index + ' lacks ' + field);
    });
  });
  unique(disposition.acceptedSignals.map((item) => item.id), 'accepted signal ids');
  unique(disposition.rejectedOrDeferred.map((item) => item.id), 'proposal ids');
}

function evidenceSource(input, index) {
  exactKeys(input, ['id', 'schema', 'sha256', 'role'], 'evidence source ' + index);
  return {
    ...reference({ id: input.id, schema: input.schema, sha256: input.sha256 }, 'evidence source ' + index),
    role: text(input.role, 'evidence source role', 120)
  };
}

function outcomeBinding(input, portfolio, signalId, index) {
  exactKeys(input, [
    'outcomeId', 'receiptDigest', 'claimId', 'beneficiary', 'admittedVerdict', 'proofSurface'
  ], 'signal ' + signalId + ' outcome binding ' + index);
  const outcome = portfolio.outcomes.find((item) => item.outcomeId === input.outcomeId);
  if (!outcome) throw new Error('signal ' + signalId + ' names an outcome outside the current portfolio');
  if (outcome.receiptDigest !== input.receiptDigest) throw new Error('signal ' + signalId + ' outcome digest mismatch');
  const claim = outcome.claims.find((item) => item.id === input.claimId);
  if (!claim) throw new Error('signal ' + signalId + ' names an unknown outcome claim');
  ['beneficiary', 'admittedVerdict', 'proofSurface'].forEach((field) => {
    if (claim[field] !== input[field]) throw new Error('signal ' + signalId + ' claim ' + field + ' mismatch');
  });
  if (claim.admittedVerdict !== 'PASS' || claim.routeStatus !== 'ADMITTED') {
    throw new Error('signal ' + signalId + ' outcome binding must point to an admitted PASS claim');
  }
  return {
    outcomeId: outcome.outcomeId,
    receiptDigest: outcome.receiptDigest,
    claimId: claim.id,
    beneficiary: claim.beneficiary,
    admittedVerdict: claim.admittedVerdict,
    proofSurface: claim.proofSurface
  };
}

function signalLink(input, signal, portfolio, sourceById) {
  exactKeys(input, [
    'signalId', 'state', 'evidenceRefIds', 'outcomeBindings', 'requiredEvent', 'notes'
  ], 'signal link');
  if (input.signalId !== signal.id) throw new Error('signal link identity mismatch');
  const state = text(input.state, 'signal state', 80).toUpperCase();
  if (!SIGNAL_STATES.includes(state)) throw new Error('signal state is unsupported');
  if (!Array.isArray(input.evidenceRefIds) || !Array.isArray(input.outcomeBindings)) {
    throw new Error('signal evidenceRefIds and outcomeBindings must be arrays');
  }
  const evidenceRefIds = sorted(input.evidenceRefIds.map((id) => text(id, 'signal evidence reference id', 180)));
  unique(evidenceRefIds, 'signal evidence reference ids');
  evidenceRefIds.forEach((id) => {
    if (!sourceById.has(id)) throw new Error('signal ' + signal.id + ' names unknown evidence source ' + id);
  });
  const outcomeBindings = input.outcomeBindings.map((item, index) => outcomeBinding(item, portfolio, signal.id, index))
    .sort((left, right) => (left.outcomeId + left.claimId).localeCompare(right.outcomeId + right.claimId));
  unique(outcomeBindings.map((item) => item.outcomeId + ':' + item.claimId), 'signal outcome bindings');
  const requiredEvent = input.requiredEvent == null ? null : text(input.requiredEvent, 'signal required event', 180);

  if (state === 'CURRENT_TECHNICAL_EVIDENCE') {
    if (!evidenceRefIds.length && !outcomeBindings.length) throw new Error('technical signal needs current evidence');
    if (requiredEvent !== null) throw new Error('technical signal cannot declare a pending required event');
    if (signal.stage === 'UNKNOWN' || signal.currentDisposition === 'WAIT_FOR_VOLUNTARY_EVIDENCE') {
      throw new Error('unknown human signal cannot be converted into technical closure');
    }
  } else {
    if (signal.stage !== 'UNKNOWN' || signal.currentDisposition !== 'WAIT_FOR_VOLUNTARY_EVIDENCE') {
      throw new Error('voluntary-human wait must preserve the source disposition');
    }
    if (requiredEvent !== 'VOLUNTARY_HUMAN_NATIVE_EVIDENCE') {
      throw new Error('voluntary-human wait needs the exact human-native evidence event');
    }
    if (outcomeBindings.some((item) => item.beneficiary === 'HUMAN')) {
      throw new Error('human waiting signal cannot bind a human PASS claim');
    }
  }

  return {
    signalId: signal.id,
    statement: text(signal.statement, 'signal statement', 1200),
    sourceIds: sorted(signal.sourceIds.map((id) => text(id, 'signal source id', 180))),
    dispositionStage: text(signal.stage, 'signal disposition stage', 80),
    currentDisposition: text(signal.currentDisposition, 'signal current disposition', 120),
    state,
    evidenceRefs: evidenceRefIds.map((id) => clone(sourceById.get(id))),
    outcomeBindings,
    requiredEvent,
    notes: text(input.notes, 'signal notes', 800),
    automaticAction: false,
    humanBenefitClaimed: false
  };
}

function expectedProposalState(disposition) {
  if (disposition === 'REJECTED') return 'REJECTED_NO_ACTION';
  if (disposition === 'REJECTED_AS_REDUNDANT') return 'REJECTED_REDUNDANT_NO_ACTION';
  if (disposition === 'DEFERRED') return 'DEFERRED_NO_ACTION';
  throw new Error('proposal disposition is unsupported: ' + disposition);
}

function proposalLink(input, proposal, sourceById) {
  exactKeys(input, ['proposalId', 'state', 'evidenceRefIds', 'notes'], 'proposal link');
  if (input.proposalId !== proposal.id) throw new Error('proposal link identity mismatch');
  const state = text(input.state, 'proposal state', 80).toUpperCase();
  if (!PROPOSAL_STATES.includes(state) || state !== expectedProposalState(proposal.disposition)) {
    throw new Error('proposal state does not preserve its source disposition');
  }
  if (!Array.isArray(input.evidenceRefIds)) throw new Error('proposal evidenceRefIds must be an array');
  const evidenceRefIds = sorted(input.evidenceRefIds.map((id) => text(id, 'proposal evidence reference id', 180)));
  unique(evidenceRefIds, 'proposal evidence reference ids');
  evidenceRefIds.forEach((id) => {
    if (!sourceById.has(id)) throw new Error('proposal ' + proposal.id + ' names unknown evidence source ' + id);
  });
  return {
    proposalId: proposal.id,
    sourceDisposition: proposal.disposition,
    reason: text(proposal.reason, 'proposal reason', 1200),
    state,
    evidenceRefs: evidenceRefIds.map((id) => clone(sourceById.get(id))),
    notes: text(input.notes, 'proposal notes', 800),
    action: 'NONE',
    implementedByThisReceipt: false,
    automaticAction: false
  };
}

function build(input) {
  exactKeys(input, [
    'lineageId', 'generatedAt', 'disposition', 'dispositionRef', 'portfolio',
    'evidenceSources', 'signalLinks', 'proposalLinks'
  ], 'signal lineage input');
  validateDisposition(input.disposition);
  const dispositionRef = reference(input.dispositionRef, 'disposition reference');
  if (dispositionRef.schema !== input.disposition.schema || dispositionRef.sha256 !== sha256(input.disposition)) {
    throw new Error('disposition reference does not bind the supplied disposition bytes');
  }
  const portfolioCheck = Growth.verifyPortfolio(input.portfolio);
  if (!portfolioCheck.pass) throw new Error('current Grounded Growth portfolio is invalid: ' + portfolioCheck.errors.join('; '));

  if (!Array.isArray(input.evidenceSources) || !Array.isArray(input.signalLinks) || !Array.isArray(input.proposalLinks)) {
    throw new Error('evidenceSources, signalLinks, and proposalLinks must be arrays');
  }
  const evidenceSources = input.evidenceSources.map(evidenceSource)
    .sort((left, right) => left.id.localeCompare(right.id));
  unique(evidenceSources.map((item) => item.id), 'evidence source ids');
  const sourceById = new Map(evidenceSources.map((item) => [item.id, item]));

  const signalInputById = new Map(input.signalLinks.map((item) => [item.signalId, item]));
  unique(input.signalLinks.map((item) => item.signalId), 'signal link ids');
  if (signalInputById.size !== input.disposition.acceptedSignals.length) {
    throw new Error('every accepted signal must have exactly one lineage link');
  }
  const signals = input.disposition.acceptedSignals.map((signal) => {
    const link = signalInputById.get(signal.id);
    if (!link) throw new Error('accepted signal lacks lineage: ' + signal.id);
    return signalLink(link, signal, input.portfolio, sourceById);
  }).sort((left, right) => left.signalId.localeCompare(right.signalId));

  const proposalInputById = new Map(input.proposalLinks.map((item) => [item.proposalId, item]));
  unique(input.proposalLinks.map((item) => item.proposalId), 'proposal link ids');
  if (proposalInputById.size !== input.disposition.rejectedOrDeferred.length) {
    throw new Error('every rejected or deferred proposal must have exactly one lineage link');
  }
  const proposals = input.disposition.rejectedOrDeferred.map((proposal) => {
    const link = proposalInputById.get(proposal.id);
    if (!link) throw new Error('proposal lacks lineage: ' + proposal.id);
    return proposalLink(link, proposal, sourceById);
  }).sort((left, right) => left.proposalId.localeCompare(right.proposalId));

  const signalIds = sorted(input.disposition.acceptedSignals.map((item) => item.id));
  const proposalIds = sorted(input.disposition.rejectedOrDeferred.map((item) => item.id));
  const technicalSignals = signals.filter((item) => item.state === 'CURRENT_TECHNICAL_EVIDENCE').length;
  const humanSignals = signals.filter((item) => item.state === 'WAITING_VOLUNTARY_HUMAN_EVIDENCE').length;
  const rejected = proposals.filter((item) => item.state.startsWith('REJECTED')).length;
  const deferred = proposals.filter((item) => item.state === 'DEFERRED_NO_ACTION').length;
  const outcomeBound = signals.filter((item) => item.outcomeBindings.length > 0).length;
  const evidenceOnly = signals.filter((item) => item.state === 'CURRENT_TECHNICAL_EVIDENCE' && item.outcomeBindings.length === 0).length;
  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    lineageId: text(input.lineageId, 'lineageId', 180),
    generatedAt: timestamp(input.generatedAt, 'generatedAt'),
    status: 'TEST',
    state: humanSignals > 0 ? 'CURRENT_WITH_OPEN_HUMAN_EVIDENCE' : 'CURRENT_TECHNICAL_LINEAGE',
    sourceRefs: {
      disposition: dispositionRef,
      portfolio: {
        id: input.portfolio.portfolioId,
        schema: input.portfolio.schema,
        sha256: input.portfolio.portfolioDigest
      },
      evidence: evidenceSources
    },
    dispositionSnapshot: {
      signalIds,
      proposalIds
    },
    signals,
    proposals,
    coverage: {
      acceptedSignals: signalIds.length,
      signalLinks: signals.length,
      currentTechnicalSignals: technicalSignals,
      waitingVoluntaryHumanSignals: humanSignals,
      outcomeBoundSignals: outcomeBound,
      evidenceOnlyTechnicalSignals: evidenceOnly,
      rejectedOrRedundantProposals: rejected,
      deferredProposals: deferred,
      proposalLinks: proposals.length,
      acceptedSignalCoverageComplete: signals.length === signalIds.length,
      proposalCoverageComplete: proposals.length === proposalIds.length
    },
    decision: {
      state: 'BOUNDED_SIGNAL_LINEAGE_DECISION',
      autonomousActionCount: 0,
      reviewableActionCount: 0,
      currentBestAction: humanSignals > 0
        ? 'PRESERVE_CURRENT_LINEAGE_AND_WAIT_FOR_OPTIONAL_VOLUNTARY_HUMAN_EVIDENCE'
        : 'PRESERVE_CURRENT_LINEAGE_UNTIL_NEW_INFORMATION',
      externalEvidenceNeeded: humanSignals > 0 ? ['VOLUNTARY_HUMAN_NATIVE_EVIDENCE'] : []
    },
    truth: {
      dispositionDigestBound: true,
      portfolioVerifiedNatively: true,
      acceptedSignalCoverageComplete: true,
      proposalCoverageComplete: true,
      sourceFileCurrentnessClaimed: false,
      technicalLineageIsHumanBenefit: false,
      deferredSignalLedgerImplemented: false,
      modelLearningClaimed: false,
      broadGeneralizationClaimed: false,
      automaticParticipation: false,
      automaticExecution: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false
    },
    receiptDigest: null
  };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  receipt.receiptDigest = sha256(payload);
  return receipt;
}

function verify(receipt, input) {
  const errors = [];
  try {
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA || receipt.version !== VERSION) {
      throw new Error('signal lineage receipt schema or version mismatch');
    }
    const rebuilt = build(input);
    if (stableStringify(receipt) !== stableStringify(rebuilt)) {
      throw new Error('signal lineage content or derived state mismatch');
    }
  } catch (error) {
    errors.push(error.message);
  }
  return { pass: errors.length === 0, errors };
}

function verifyPortable(receipt) {
  const errors = [];
  try {
    exactKeys(receipt, [
      'schema', 'version', 'lineageId', 'generatedAt', 'status', 'state', 'sourceRefs',
      'dispositionSnapshot', 'signals', 'proposals', 'coverage', 'decision', 'truth', 'receiptDigest'
    ], 'signal lineage receipt');
    if (receipt.schema !== RECEIPT_SCHEMA || receipt.version !== VERSION || receipt.status !== 'TEST') {
      throw new Error('signal lineage receipt identity mismatch');
    }
    if (!DIGEST.test(receipt.receiptDigest || '')) throw new Error('signal lineage receipt digest is invalid');
    const payload = clone(receipt);
    delete payload.receiptDigest;
    if (sha256(payload) !== receipt.receiptDigest) throw new Error('signal lineage receipt digest mismatch');
    if (!Array.isArray(receipt.signals) || !Array.isArray(receipt.proposals)) throw new Error('lineage rows must be arrays');
    unique(receipt.signals.map((item) => item.signalId), 'portable signal ids');
    unique(receipt.proposals.map((item) => item.proposalId), 'portable proposal ids');
    if (stableStringify(sorted(receipt.signals.map((item) => item.signalId))) !== stableStringify(receipt.dispositionSnapshot.signalIds)) {
      throw new Error('portable accepted-signal coverage mismatch');
    }
    if (stableStringify(sorted(receipt.proposals.map((item) => item.proposalId))) !== stableStringify(receipt.dispositionSnapshot.proposalIds)) {
      throw new Error('portable proposal coverage mismatch');
    }
    const technical = receipt.signals.filter((item) => item.state === 'CURRENT_TECHNICAL_EVIDENCE').length;
    const human = receipt.signals.filter((item) => item.state === 'WAITING_VOLUNTARY_HUMAN_EVIDENCE').length;
    const rejected = receipt.proposals.filter((item) => String(item.state).startsWith('REJECTED')).length;
    const deferred = receipt.proposals.filter((item) => item.state === 'DEFERRED_NO_ACTION').length;
    if (receipt.coverage.acceptedSignals !== receipt.signals.length
      || receipt.coverage.signalLinks !== receipt.signals.length
      || receipt.coverage.currentTechnicalSignals !== technical
      || receipt.coverage.waitingVoluntaryHumanSignals !== human
      || receipt.coverage.proposalLinks !== receipt.proposals.length
      || receipt.coverage.rejectedOrRedundantProposals !== rejected
      || receipt.coverage.deferredProposals !== deferred
      || receipt.coverage.acceptedSignalCoverageComplete !== true
      || receipt.coverage.proposalCoverageComplete !== true) {
      throw new Error('portable coverage counts are incoherent');
    }
    receipt.signals.forEach((item) => {
      if (!SIGNAL_STATES.includes(item.state) || item.automaticAction !== false || item.humanBenefitClaimed !== false) {
        throw new Error('portable signal authority boundary mismatch');
      }
      if (item.state === 'WAITING_VOLUNTARY_HUMAN_EVIDENCE'
        && item.requiredEvent !== 'VOLUNTARY_HUMAN_NATIVE_EVIDENCE') {
        throw new Error('portable human signal lost its required event');
      }
    });
    receipt.proposals.forEach((item) => {
      if (!PROPOSAL_STATES.includes(item.state) || item.action !== 'NONE'
        || item.implementedByThisReceipt !== false || item.automaticAction !== false) {
        throw new Error('portable proposal non-action boundary mismatch');
      }
    });
    const falseTruth = [
      'sourceFileCurrentnessClaimed', 'technicalLineageIsHumanBenefit',
      'deferredSignalLedgerImplemented', 'modelLearningClaimed', 'broadGeneralizationClaimed',
      'automaticParticipation', 'automaticExecution', 'automaticWrite', 'automaticInstall',
      'automaticPermissionGrant', 'automaticPromotion', 'automaticMerge', 'automaticCanon',
      'foundationMutation'
    ];
    if (falseTruth.some((field) => receipt.truth[field] !== false)
      || receipt.decision.autonomousActionCount !== 0
      || receipt.decision.reviewableActionCount !== 0) {
      throw new Error('portable receipt inflates authority or beneficiary claims');
    }
  } catch (error) {
    errors.push(error.message);
  }
  return {
    pass: errors.length === 0,
    errors,
    verdict: errors.length === 0 ? 'PORTABLE_INTEGRITY_PASS_SOURCE_TRUTH_UNKNOWN' : 'INVALID',
    sourceTruth: 'UNKNOWN',
    sourceCurrentness: 'UNKNOWN'
  };
}

module.exports = {
  RECEIPT_SCHEMA,
  VERSION,
  SIGNAL_STATES,
  PROPOSAL_STATES,
  stableStringify,
  sha256,
  build,
  verify,
  verifyPortable
};
