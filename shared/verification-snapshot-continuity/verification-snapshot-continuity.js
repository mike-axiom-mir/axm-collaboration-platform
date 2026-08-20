'use strict';

const crypto = require('crypto');

const RECEIPT_SCHEMA = 'axm.verification-snapshot-continuity-receipt/v1';
const VERSION = '0.1.0';
const STATUS = 'TEST';
const MUTABLE_DERIVED_PATH = 'exports/verification-spine-report.json';
const MUTABLE_DERIVED_SCHEMA = 'axm.verification-spine-report/v2';
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).sort().forEach(key => { result[key] = stableValue(value[key]); });
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' must be an object');
  }
  const extras = Object.keys(value).filter(key => !allowed.includes(key));
  if (extras.length) throw new Error(label + ' has unsupported field(s): ' + extras.join(', '));
}

function requiredText(value, label, maximum) {
  const result = String(value == null ? '' : value).trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > (maximum || 240)) throw new Error(label + ' is too long');
  return result;
}

function normalizePath(value, label) {
  const result = requiredText(value, label, 500).replace(/\\/g, '/');
  if (result.startsWith('/') || /^[A-Za-z]:\//.test(result)) {
    throw new Error(label + ' must be workspace-relative');
  }
  const segments = result.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error(label + ' contains an unsafe segment');
  }
  return result;
}

function normalizeDigest(value, label) {
  const result = requiredText(value, label, 80);
  if (!DIGEST_PATTERN.test(result)) throw new Error(label + ' must be a lowercase SHA-256 digest');
  return result;
}

function normalizeSourceRef(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' must be an object');
  }
  return {
    path: normalizePath(value.path, label + '.path'),
    sha256: normalizeDigest(value.sha256, label + '.sha256')
  };
}

function collectHistoricalSourceRefs(receipt) {
  const candidates = [];
  if (Array.isArray(receipt && receipt.sourceRefs)) candidates.push(...receipt.sourceRefs);
  if (Array.isArray(receipt && receipt.sources)) candidates.push(...receipt.sources);
  if (receipt && receipt.broadVerification && receipt.broadVerification.source) {
    candidates.push(receipt.broadVerification.source);
  }

  const errors = [];
  const byPath = new Map();
  candidates.forEach((candidate, index) => {
    try {
      const ref = normalizeSourceRef(candidate, 'historical source ' + index);
      if (byPath.has(ref.path) && byPath.get(ref.path).sha256 !== ref.sha256) {
        errors.push('conflicting historical digests for ' + ref.path);
      } else {
        byPath.set(ref.path, ref);
      }
    } catch (error) {
      errors.push(error.message);
    }
  });

  const refs = Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
  return { refs, errors };
}

function collectCurrentSourceRefs(values) {
  if (!Array.isArray(values)) throw new Error('currentSources must be an array');
  const errors = [];
  const byPath = new Map();
  values.forEach((candidate, index) => {
    try {
      const ref = normalizeSourceRef(candidate, 'current source ' + index);
      if (byPath.has(ref.path)) {
        errors.push('duplicate current source ' + ref.path);
      } else {
        byPath.set(ref.path, ref);
      }
    } catch (error) {
      errors.push(error.message);
    }
  });
  const refs = Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
  return { refs, errors };
}

function verifyHistoricalSelfDigest(receipt) {
  const fields = ['verificationDigest', 'receiptDigest'].filter(field =>
    Object.prototype.hasOwnProperty.call(receipt || {}, field) && receipt[field] != null
  );
  if (!fields.length) {
    return { state: 'NOT_DECLARED', field: null, declared: null, rebuilt: null, pass: false };
  }
  if (fields.length > 1) {
    return { state: 'CONFLICTING_DECLARATIONS', field: null, declared: null, rebuilt: null, pass: false };
  }
  const field = fields[0];
  let declared;
  try {
    declared = normalizeDigest(receipt[field], 'historicalReceipt.' + field);
  } catch (error) {
    return { state: 'INVALID_DECLARATION', field, declared: receipt[field], rebuilt: null, pass: false };
  }
  const payload = clone(receipt);
  delete payload[field];
  const rebuilt = sha256(payload);
  return {
    state: rebuilt === declared ? 'VALID' : 'INVALID',
    field,
    declared,
    rebuilt,
    pass: rebuilt === declared
  };
}

function normalizeDerivedView(value) {
  exactKeys(value, [
    'path', 'sha256', 'schema', 'verdict', 'failures', 'holds', 'warningGroups', 'invalidReceipts'
  ], 'currentDerivedView');
  const result = {
    path: normalizePath(value.path, 'currentDerivedView.path'),
    sha256: normalizeDigest(value.sha256, 'currentDerivedView.sha256'),
    schema: requiredText(value.schema, 'currentDerivedView.schema', 160),
    verdict: requiredText(value.verdict, 'currentDerivedView.verdict', 120),
    failures: Number(value.failures),
    holds: Number(value.holds),
    warningGroups: Number(value.warningGroups),
    invalidReceipts: Number(value.invalidReceipts)
  };
  ['failures', 'holds', 'warningGroups', 'invalidReceipts'].forEach(field => {
    if (!Number.isInteger(result[field]) || result[field] < 0) {
      throw new Error('currentDerivedView.' + field + ' must be a non-negative integer');
    }
  });
  return result;
}

function classify(context) {
  const {
    digestCheck, historicalErrors, currentErrors, historicalRefs, currentRefs,
    currentDerivedView
  } = context;
  const historicalMap = new Map(historicalRefs.map(ref => [ref.path, ref.sha256]));
  const currentMap = new Map(currentRefs.map(ref => [ref.path, ref.sha256]));
  const historicalPaths = Array.from(historicalMap.keys()).sort();
  const currentPaths = Array.from(currentMap.keys()).sort();
  const missingCurrentPaths = historicalPaths.filter(item => !currentMap.has(item));
  const extraCurrentPaths = currentPaths.filter(item => !historicalMap.has(item));
  const trackedSourceDrift = historicalPaths
    .filter(item => item !== MUTABLE_DERIVED_PATH && currentMap.has(item) && historicalMap.get(item) !== currentMap.get(item))
    .map(item => ({ path: item, historicalSha256: historicalMap.get(item), currentSha256: currentMap.get(item) }));
  const historicalDerivedDigest = historicalMap.get(MUTABLE_DERIVED_PATH) || null;
  const currentDerivedDigest = currentMap.get(MUTABLE_DERIVED_PATH) || null;
  const derivedViewChanged = Boolean(
    historicalDerivedDigest && currentDerivedDigest && historicalDerivedDigest !== currentDerivedDigest
  );
  const derivedBoundaryValid = currentDerivedView.path === MUTABLE_DERIVED_PATH &&
    currentDerivedView.schema === MUTABLE_DERIVED_SCHEMA &&
    currentDerivedDigest === currentDerivedView.sha256;

  let classification;
  let bestAction;
  let reviewRequired = false;

  if (historicalErrors.length || currentErrors.length) {
    classification = 'HOLD_INVALID_SOURCE_EVIDENCE';
    bestAction = 'REPAIR_SOURCE_EVIDENCE_BEFORE_CLASSIFICATION';
  } else if (digestCheck.state === 'NOT_DECLARED') {
    classification = 'HOLD_HISTORICAL_SELF_DIGEST_NOT_DECLARED';
    bestAction = 'PRESERVE_RECEIPT_AND_REQUEST_AN_EXTERNAL_INTEGRITY_ANCHOR';
  } else if (digestCheck.state !== 'VALID') {
    classification = 'HOLD_INVALID_HISTORICAL_SELF_DIGEST';
    bestAction = 'PRESERVE_RECEIPT_AND_INVESTIGATE_INTEGRITY_CONTRADICTION';
  } else if (!historicalDerivedDigest) {
    classification = 'HOLD_HISTORICAL_DERIVED_REFERENCE_NOT_DECLARED';
    bestAction = 'PRESERVE_RECEIPT_AND_DECLARE_THE_DERIVED_VIEW_BOUNDARY';
  } else if (missingCurrentPaths.length || extraCurrentPaths.length) {
    classification = 'HOLD_INCOMPLETE_CURRENT_SOURCE_SET';
    bestAction = 'COMPLETE_THE_EXACT_CURRENT_SOURCE_SET';
  } else if (!derivedBoundaryValid) {
    classification = 'HOLD_DERIVED_VIEW_BOUNDARY';
    bestAction = 'VERIFY_THE_EXACT_MUTABLE_DERIVED_VIEW_PATH_SCHEMA_AND_DIGEST';
  } else if (trackedSourceDrift.length) {
    classification = 'TRACKED_SOURCE_DRIFT';
    bestAction = 'REVIEW_TRACKED_SOURCE_DRIFT_WITHOUT_REWRITING_HISTORY';
    reviewRequired = true;
  } else if (derivedViewChanged) {
    classification = 'MUTABLE_DERIVED_VIEW_DRIFT_ONLY';
    bestAction = 'PRESERVE_HISTORICAL_RECEIPT_AND_USE_CURRENT_DERIVED_VIEW_FOR_CURRENT_STATUS';
  } else {
    classification = 'CURRENT_SOURCE_SET_EXACT';
    bestAction = 'NO_CONTINUITY_REPAIR_REQUIRED';
  }

  return {
    classification,
    bestAction,
    reviewRequired,
    historicalPaths,
    currentPaths,
    missingCurrentPaths,
    extraCurrentPaths,
    trackedSourceDrift,
    historicalDerivedDigest,
    currentDerivedDigest,
    derivedViewChanged,
    derivedBoundaryValid
  };
}

function build(input) {
  exactKeys(input, [
    'continuityId', 'checkedAt', 'historicalReceiptRef', 'historicalReceipt',
    'currentSources', 'currentDerivedView'
  ], 'input');
  exactKeys(input.historicalReceiptRef, ['path', 'sha256'], 'historicalReceiptRef');
  const historicalReceiptRef = normalizeSourceRef(input.historicalReceiptRef, 'historicalReceiptRef');
  if (!input.historicalReceipt || typeof input.historicalReceipt !== 'object' || Array.isArray(input.historicalReceipt)) {
    throw new Error('historicalReceipt must be an object');
  }
  const continuityId = requiredText(input.continuityId, 'continuityId', 180);
  const checkedAt = requiredText(input.checkedAt, 'checkedAt', 80);
  if (!Number.isFinite(Date.parse(checkedAt))) throw new Error('checkedAt must be an ISO date-time');

  const historical = collectHistoricalSourceRefs(input.historicalReceipt);
  const current = collectCurrentSourceRefs(input.currentSources);
  const currentDerivedView = normalizeDerivedView(input.currentDerivedView);
  const digestCheck = verifyHistoricalSelfDigest(input.historicalReceipt);
  const result = classify({
    digestCheck,
    historicalErrors: historical.errors,
    currentErrors: current.errors,
    historicalRefs: historical.refs,
    currentRefs: current.refs,
    currentDerivedView
  });

  const receipt = {
    schema: RECEIPT_SCHEMA,
    version: VERSION,
    continuityId,
    checkedAt,
    status: STATUS,
    scope: 'HISTORICAL_RECEIPT_AND_CURRENT_SOURCE_CONTINUITY',
    historicalReceipt: {
      ref: historicalReceiptRef,
      schema: typeof input.historicalReceipt.schema === 'string' ? input.historicalReceipt.schema : null,
      selfDigest: digestCheck,
      sourceCount: historical.refs.length,
      sourceEvidenceErrors: historical.errors
    },
    currentEvidence: {
      sourceCount: current.refs.length,
      sourceEvidenceErrors: current.errors,
      derivedView: currentDerivedView
    },
    comparison: {
      missingCurrentPaths: result.missingCurrentPaths,
      extraCurrentPaths: result.extraCurrentPaths,
      trackedSourceDrift: result.trackedSourceDrift,
      mutableDerivedView: {
        path: MUTABLE_DERIVED_PATH,
        historicalSha256: result.historicalDerivedDigest,
        currentSha256: result.currentDerivedDigest,
        changed: result.derivedViewChanged,
        boundaryValid: result.derivedBoundaryValid,
        historicalBytesAvailable: false
      }
    },
    decision: {
      classification: result.classification,
      bestAction: result.bestAction,
      reviewRequired: result.reviewRequired,
      autonomousActionCount: 0
    },
    truth: {
      historicalReceiptSelfDigestValid: digestCheck.state === 'VALID',
      currentTrackedSourcesMatchHistorical: result.trackedSourceDrift.length === 0 &&
        result.missingCurrentPaths.length === 0 && result.extraCurrentPaths.length === 0,
      mutableDerivedViewRecognizedExactly: result.derivedBoundaryValid,
      mutableDerivedViewDriftClaimedAsProductPass: false,
      trackedSourceDriftClaimedAsHarmless: false,
      historicalDerivedBytesRetained: false,
      historicalReceiptRewritten: false,
      currentBroadVerificationClaimedByThisReceipt: false,
      authorityGranted: false,
      canonicalStateTouched: false
    },
    continuityDigest: null
  };
  const payload = clone(receipt);
  delete payload.continuityDigest;
  receipt.continuityDigest = sha256(payload);
  return receipt;
}

function verify(input, receipt) {
  const errors = [];
  let rebuilt;
  try {
    rebuilt = build(input);
  } catch (error) {
    return { pass: false, errors: [error.message] };
  }
  if (stableStringify(rebuilt) !== stableStringify(receipt)) {
    errors.push('continuity receipt does not exact-rebuild from supplied evidence');
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  RECEIPT_SCHEMA,
  VERSION,
  STATUS,
  MUTABLE_DERIVED_PATH,
  MUTABLE_DERIVED_SCHEMA,
  clone,
  stableValue,
  stableStringify,
  sha256,
  collectHistoricalSourceRefs,
  verifyHistoricalSelfDigest,
  build,
  verify
};

