(function (root, factory) {
  'use strict';
  var deterministic = typeof module !== 'undefined' && module.exports
    ? require('../deterministic-json-core')
    : root.AXMDeterministicJson;
  var api = factory(root, deterministic);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMRetentionAuditReviewView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, Deterministic) {
  'use strict';

  var REVIEW_KIND = 'model-shadow-retention-audit-hold';
  var ARTIFACT_SCHEMA = 'axm.model-shadow-retention-audit-review-artifact/v1';
  var ACTION_SCHEMA = 'axm.model-shadow-retention-audit-review-action/v1';
  var VERSION = '2.9.0';
  var STATUS = 'TEST';
  var MODE = 'DATA_ONLY_HELD_RETENTION_AUDIT_REVIEW_REQUEST_UNAUTHENTICATED';
  var MAX_ARTIFACT_CANONICAL_BYTES = 1048576;
  var HELD_CLASSIFICATIONS = [
    'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT',
    'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT',
    'OBSERVED_LEDGER_IDENTITY_DRIFT',
    'OBSERVED_LEDGER_ABSENT',
    'OBSERVED_LEDGER_OR_CONFIGURATION_INVALID'
  ];
  var ARTIFACT_KEYS = [
    'schema', 'version', 'status', 'artifactId', 'generatedAt', 'mode', 'classification',
    'observationRef', 'observationManifestRef', 'observationSequence', 'v27AuditRef',
    'v27Classification', 'retentionSelection', 'decision', 'truth', 'artifactDigest'
  ];
  var ACTION_KEYS = [
    'schema', 'type', 'artifact', 'automaticApply', 'executionOnApproval',
    'holdResolutionOnApproval', 'adoptionOnApproval', 'promotionAuthority',
    'mergeAuthority', 'canonAuthority'
  ];
  var TRUTH_KEYS = [
    'v28ObservationExactReloaded', 'v28HeldClassificationRequired', 'completeV28ObservationCopied', 'completeV27AuditCopied',
    'sourceRollbackObserved', 'sourceAbsenceObserved', 'sourceReplacementOrForkObserved', 'currentSourceValidatedByV26Audit',
    'pendingObservationGrantsSettledAuthority', 'causeBeyondAuditClassificationProven', 'continuousMonitoringPerformed',
    'reviewSubmitted', 'hostMutationAuthorizationProven', 'actualHumanReviewProven', 'reviewActorAuthenticated',
    'reviewDecisionRecorded', 'holdResolved', 'executionAuthorized', 'adoptionAuthorized', 'humanBenefitProven',
    'broadLearningClaimed', 'rawModelOutputEmbedded', 'privateContextEmbedded', 'sourceOrLedgerPathEmbedded',
    'autonomousActionCount', 'automaticPermissionGrant', 'automaticInstall', 'automaticPromotion', 'automaticMerge',
    'automaticCanon', 'foundationMutation'
  ];

  function ViewError(code, message) {
    this.name = 'RetentionAuditReviewViewError';
    this.code = code;
    this.message = message;
    if (Error.captureStackTrace) Error.captureStackTrace(this, ViewError);
  }
  ViewError.prototype = Object.create(Error.prototype);
  ViewError.prototype.constructor = ViewError;
  function fail(code, message) { throw new ViewError(code, message); }
  function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
  function exactKeys(value, expected, label) {
    if (!isObject(value)) fail('INVALID_V29_ARTIFACT', label + ' must be an object');
    var actual = Object.keys(value).sort();
    var wanted = expected.slice().sort();
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail('INVALID_V29_ARTIFACT', label + ' fields are not exact');
  }
  function ensure(condition, message) { if (!condition) fail('INVALID_V29_ARTIFACT', message); }
  function text(value, maximum, label) { ensure(typeof value === 'string' && value.length > 0 && value.length <= maximum, label + ' is invalid'); }
  function digest(value, label) { ensure(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value), label + ' is invalid'); }
  function rawDigest(value, label) { ensure(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), label + ' is invalid'); }
  function timestamp(value, label) {
    ensure(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), label + ' is invalid');
    ensure(Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value, label + ' is invalid');
  }
  function reference(value, label) {
    exactKeys(value, ['id', 'schema', 'sha256'], label);
    text(value.id, 180, label + ' id');
    text(value.schema, 180, label + ' schema');
    digest(value.sha256, label + ' digest');
  }
  function canonical(value) {
    if (!Deterministic || typeof Deterministic.canonicalJson !== 'function') fail('DIGEST_VERIFIER_UNAVAILABLE', 'deterministic JSON encoder is unavailable');
    return Deterministic.canonicalJson(value);
  }
  function utf8Bytes(value) {
    var Encoder = root && root.TextEncoder;
    if (typeof Encoder !== 'function' && typeof TextEncoder === 'function') Encoder = TextEncoder;
    if (typeof Encoder !== 'function') fail('DIGEST_VERIFIER_UNAVAILABLE', 'UTF-8 encoder is unavailable');
    return new Encoder().encode(value);
  }
  function cryptoProvider() {
    if (root && root.crypto && root.crypto.subtle) return root.crypto;
    if (typeof require === 'function') {
      try { return require('crypto').webcrypto; } catch (_) {}
    }
    return null;
  }
  function sha256Hex(value) {
    var provider = cryptoProvider();
    if (!provider || !provider.subtle) return Promise.reject(new ViewError('DIGEST_VERIFIER_UNAVAILABLE', 'Web Crypto SHA-256 is unavailable'));
    return provider.subtle.digest('SHA-256', utf8Bytes(value)).then(function (bytes) {
      return Array.prototype.map.call(new Uint8Array(bytes), function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
    });
  }
  function withoutDigest(artifact) {
    var result = JSON.parse(JSON.stringify(artifact));
    delete result.artifactDigest;
    return result;
  }
  function validateStatic(item) {
    ensure(isObject(item), 'review item is invalid');
    ensure(item.kind === REVIEW_KIND, 'review item kind is invalid');
    rawDigest(item.artifactDigest, 'review item artifact digest');
    var action = item.action;
    exactKeys(action, ACTION_KEYS, 'review action');
    ensure(action.schema === ACTION_SCHEMA && action.type === 'inspect-held-retention-audit-observation', 'review action identity is invalid');
    [
      'automaticApply', 'executionOnApproval', 'holdResolutionOnApproval', 'adoptionOnApproval',
      'promotionAuthority', 'mergeAuthority', 'canonAuthority'
    ].forEach(function (key) { ensure(action[key] === false, 'review action authority boundary is invalid'); });
    var artifact = action.artifact;
    var rough;
    try { rough = JSON.stringify(artifact); } catch (_) { fail('INVALID_V29_ARTIFACT', 'artifact cannot be serialized'); }
    if (utf8Bytes(rough).byteLength > MAX_ARTIFACT_CANONICAL_BYTES) fail('OVERSIZED_ARTIFACT', 'artifact exceeds one MiB inspection bound');
    exactKeys(artifact, ARTIFACT_KEYS, 'review artifact');
    ensure(artifact.schema === ARTIFACT_SCHEMA && artifact.version === VERSION && artifact.status === STATUS && artifact.mode === MODE, 'artifact identity is invalid');
    ensure(artifact.classification === 'HELD_RETENTION_AUDIT_REVIEW_ARTIFACT', 'artifact is not held');
    text(artifact.artifactId, 180, 'artifact id');
    timestamp(artifact.generatedAt, 'artifact generation time');
    reference(artifact.observationRef, 'observation reference');
    reference(artifact.observationManifestRef, 'observation manifest reference');
    ensure(Number.isSafeInteger(artifact.observationSequence) && artifact.observationSequence >= 1 && artifact.observationSequence <= 10000, 'observation sequence is invalid');
    reference(artifact.v27AuditRef, 'v2.7 audit reference');
    ensure(HELD_CLASSIFICATIONS.indexOf(artifact.v27Classification) !== -1, 'v2.7 classification is not held');
    exactKeys(artifact.retentionSelection, ['manifestRef', 'checkpointRef', 'sequence', 'selectionStatus'], 'retention selection');
    reference(artifact.retentionSelection.manifestRef, 'retention manifest reference');
    reference(artifact.retentionSelection.checkpointRef, 'retention checkpoint reference');
    ensure(Number.isSafeInteger(artifact.retentionSelection.sequence) && artifact.retentionSelection.sequence >= 1 && artifact.retentionSelection.sequence <= 10000, 'retention sequence is invalid');
    ensure(['PENDING', 'SETTLED'].indexOf(artifact.retentionSelection.selectionStatus) !== -1, 'retention selection status is invalid');
    exactKeys(artifact.decision, ['reviewRequired', 'holdRequired', 'bestAction', 'autonomousActionCount'], 'artifact decision');
    ensure(artifact.decision.reviewRequired === true && artifact.decision.holdRequired === true && artifact.decision.autonomousActionCount === 0, 'artifact decision boundary is invalid');
    text(artifact.decision.bestAction, 180, 'best action');
    exactKeys(artifact.truth, TRUTH_KEYS, 'artifact truth');
    ensure(artifact.truth.v28ObservationExactReloaded === true && artifact.truth.v28HeldClassificationRequired === true, 'artifact upstream truth is invalid');
    ensure(typeof artifact.truth.currentSourceValidatedByV26Audit === 'boolean', 'current-source validation truth is invalid');
    var dynamic = {
      sourceRollbackObserved: artifact.v27Classification === 'OBSERVED_STRICT_HISTORY_ROLLBACK_RELATIVE_TO_PRESENTED_CHECKPOINT',
      sourceAbsenceObserved: artifact.v27Classification === 'OBSERVED_LEDGER_ABSENT',
      sourceReplacementOrForkObserved: artifact.v27Classification === 'OBSERVED_HISTORY_REPLACEMENT_OR_FORK_RELATIVE_TO_PRESENTED_CHECKPOINT'
    };
    Object.keys(dynamic).forEach(function (key) { ensure(artifact.truth[key] === dynamic[key], 'artifact classification truth is invalid'); });
    var trueKeys = ['v28ObservationExactReloaded', 'v28HeldClassificationRequired'];
    TRUTH_KEYS.forEach(function (key) {
      if (trueKeys.indexOf(key) !== -1 || Object.prototype.hasOwnProperty.call(dynamic, key) || key === 'currentSourceValidatedByV26Audit' || key === 'autonomousActionCount') return;
      ensure(artifact.truth[key] === false, 'artifact authority or minimization truth is invalid');
    });
    ensure(artifact.truth.autonomousActionCount === 0, 'artifact autonomous action truth is invalid');
    digest(artifact.artifactDigest, 'artifact self digest');
    return artifact;
  }
  function genericView() { return { applies: false, state: 'GENERIC', voteReady: true, integrityCode: 'NOT_APPLICABLE' }; }
  function holdView(code) {
    return {
      applies: true,
      state: 'HOLD',
      voteReady: false,
      integrityCode: code || 'INVALID_V29_ARTIFACT',
      message: 'Exact held-audit integrity was not verified. Voting is disabled for this item.'
    };
  }
  function inspect(item) {
    if (!item || item.kind !== REVIEW_KIND) return Promise.resolve(genericView());
    var artifact;
    var canonicalPayload;
    try {
      artifact = validateStatic(item);
      canonicalPayload = canonical(withoutDigest(artifact));
      if (utf8Bytes(canonicalPayload).byteLength > MAX_ARTIFACT_CANONICAL_BYTES) fail('OVERSIZED_ARTIFACT', 'artifact exceeds canonical inspection bound');
    } catch (error) {
      return Promise.resolve(holdView(error && error.code));
    }
    return sha256Hex(canonicalPayload).then(function (hex) {
      var expected = 'sha256:' + hex;
      if (artifact.artifactDigest !== expected) return holdView('ARTIFACT_SELF_DIGEST_MISMATCH');
      if (item.artifactDigest !== hex) return holdView('ITEM_ARTIFACT_DIGEST_MISMATCH');
      return {
        applies: true,
        state: 'VERIFIED',
        voteReady: true,
        integrityCode: 'EXACT_ARTIFACT_DIGEST_VERIFIED',
        itemState: String(item.state || 'UNKNOWN'),
        digest: hex,
        generatedAt: artifact.generatedAt,
        classification: artifact.v27Classification,
        bestAction: artifact.decision.bestAction,
        observation: artifact.observationRef,
        audit: artifact.v27AuditRef,
        checkpoint: artifact.retentionSelection.checkpointRef,
        retentionStatus: artifact.retentionSelection.selectionStatus
      };
    }).catch(function (error) { return holdView(error && error.code || 'DIGEST_VERIFIER_UNAVAILABLE'); });
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }
  function fact(label, value, className) {
    return '<div class="audit-fact ' + esc(className || '') + '"><dt>' + esc(label) + '</dt><dd><code>' + esc(value) + '</code></dd></div>';
  }
  function renderPending() {
    return '<section class="typed-audit-review pending" role="status" aria-label="Held retention audit integrity check pending">' +
      '<span class="badge warn">VERIFYING</span><h3>Checking exact held-audit artifact…</h3>' +
      '<p>Voting stays disabled until the embedded canonical SHA-256 matches the Review Inbox item.</p></section>';
  }
  function renderUnavailable() {
    return '<section class="typed-audit-review hold" role="alert" aria-label="Held retention audit verifier unavailable">' +
      '<span class="badge bad">HOLD</span><h3>Typed artifact verifier unavailable</h3>' +
      '<p>Voting is disabled. Raw evidence remains below for diagnosis; no review authority was granted.</p></section>';
  }
  function render(view) {
    if (!view || !view.applies) return '';
    if (view.state !== 'VERIFIED') {
      return '<section class="typed-audit-review hold" role="alert" data-integrity-state="HOLD" aria-label="Held retention audit integrity mismatch">' +
        '<span class="badge bad">INTEGRITY HOLD</span><h3>Do not vote on this claimed held audit</h3>' +
        '<p>' + esc(view.message) + '</p><p class="integrity-code">Reason: <code>' + esc(view.integrityCode) + '</code></p>' +
        '<p class="truth">Raw evidence remains below for diagnosis. This hold authenticates no actor and resolves no retention decision.</p></section>';
    }
    return '<section class="typed-audit-review verified" role="status" data-integrity-state="VERIFIED" aria-labelledby="heldAuditHeading">' +
      '<div class="typed-audit-heading"><div><span class="badge ok">EXACT DIGEST VERIFIED</span><h3 id="heldAuditHeading">Held retention-audit decision context</h3></div><span class="review-state">Review item: ' + esc(view.itemState) + '</span></div>' +
      '<p class="typed-audit-intro">The embedded v2.9 artifact matches this Review Inbox digest. Inspect the held evidence below; approval would approve only this exact artifact.</p>' +
      '<dl class="audit-facts">' +
        fact('V2.7 classification', view.classification, 'wide') +
        fact('Current best action', view.bestAction, 'wide') +
        fact('Observation', view.observation.id) +
        fact('Observation digest', view.observation.sha256) +
        fact('V2.7 audit', view.audit.id) +
        fact('Audit digest', view.audit.sha256) +
        fact('Retention checkpoint', view.checkpoint.id) +
        fact('Checkpoint digest', view.checkpoint.sha256) +
        fact('Retention selection', view.retentionStatus) +
        fact('Artifact generated', view.generatedAt) +
        fact('Full reviewed digest', view.digest, 'wide full-digest') +
      '</dl>' +
      '<div class="authority-boundaries" aria-label="Authority boundaries"><h4>What this review cannot do</h4><ul>' +
        '<li><b>Retention hold remains unresolved.</b></li>' +
        '<li>No execution, adoption, provider call, or evaluation.</li>' +
        '<li>No permission grant, install, promotion, merge, Foundation mutation, or CANON.</li>' +
        '<li>No authenticated submitter, reviewer identity, or actual human participation is proven by this view.</li>' +
      '</ul></div>' +
      '<p class="truth">Raw exact-item JSON remains visible below. Digest verification proves content equality only—not origin, identity, durability, benefit, or learning.</p>' +
    '</section>';
  }

  return {
    REVIEW_KIND: REVIEW_KIND,
    ARTIFACT_SCHEMA: ARTIFACT_SCHEMA,
    VERSION: '3.0.0',
    STATUS: 'TEST',
    MAX_ARTIFACT_CANONICAL_BYTES: MAX_ARTIFACT_CANONICAL_BYTES,
    inspect: inspect,
    render: render,
    renderPending: renderPending,
    renderUnavailable: renderUnavailable,
    sha256Hex: sha256Hex,
    canonical: canonical,
    escapeHtml: esc
  };
});
