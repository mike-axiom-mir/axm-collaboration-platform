(function (root, factory) {
  'use strict';
  var deterministic = typeof module !== 'undefined' && module.exports
    ? require('../deterministic-json-core')
    : root.AXMDeterministicJson;
  var api = factory(root, deterministic);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHistoryReconciliationReviewView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, Deterministic) {
  'use strict';

  var REVIEW_KIND = 'model-shadow-transition-settlement-history-reconciliation';
  var ARTIFACT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-artifact/v1';
  var OBSERVATION_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-history-pairwise-observation/v1';
  var COMMITMENT_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-history-commitment/v1';
  var ACTION_SCHEMA = 'axm.model-shadow-retention-audit-review-outcome-transition-settlement-history-reconciliation-review-action/v1';
  var VERSION = '4.0.0';
  var STATUS = 'TEST';
  var MODE = 'DATA_ONLY_COMPLETE_HISTORY_DIVERGENCE_RECONCILIATION_REVIEW_REQUEST_UNAUTHENTICATED';
  var MAX_ARTIFACT_CANONICAL_BYTES = 1048576;
  var ARTIFACT_KEYS = [
    'schema', 'version', 'status', 'artifactId', 'generatedAt', 'mode', 'classification',
    'observationRef', 'leftHistory', 'rightHistory', 'comparison', 'decision', 'truth', 'artifactDigest'
  ];
  var ACTION_KEYS = [
    'schema', 'type', 'artifact', 'automaticApply', 'reconciliationOnApproval',
    'executionOnApproval', 'adoptionOnApproval', 'promotionAuthority', 'mergeAuthority', 'canonAuthority'
  ];
  var HISTORY_KEYS = ['commitmentRef', 'snapshotRef', 'proposalCount', 'settlementCount', 'heldSettlementCount', 'eventCount'];
  var DIVERGENCE_KEYS = ['eventIndex', 'leftKind', 'leftSequence', 'leftContentDigest', 'rightKind', 'rightSequence', 'rightContentDigest'];
  var EXPECTED_TRUTH = {
    v39ObservationExactRebuilt: true,
    completeHistoryDivergenceRequired: true,
    leftHistoryCommitmentPreserved: true,
    rightHistoryCommitmentPreserved: true,
    earliestDivergencePreserved: true,
    completeV39ObservationCopied: false,
    completeStoredHistoryCopied: false,
    rawStoredArtifactEmbedded: false,
    sourceOrSettlementPathEmbedded: false,
    rootControllersIndependent: false,
    globallyConsistentHistoryProven: false,
    reviewSubmitted: false,
    hostMutationAuthorizationProven: false,
    actualHumanReviewProven: false,
    reviewActorAuthenticated: false,
    reviewDecisionRecorded: false,
    reconciliationPerformed: false,
    divergenceResolved: false,
    executionAuthorized: false,
    adoptionAuthorized: false,
    humanBenefitProven: false,
    broadLearningClaimed: false,
    providerInvoked: false,
    evaluationPerformed: false,
    autonomousActionCount: 0,
    automaticPermissionGrant: false,
    automaticInstall: false,
    automaticPromotion: false,
    automaticMerge: false,
    automaticCanon: false,
    foundationMutation: false
  };

  function ViewError(code, message) {
    this.name = 'HistoryReconciliationReviewViewError';
    this.code = code;
    this.message = message;
    if (Error.captureStackTrace) Error.captureStackTrace(this, ViewError);
  }
  ViewError.prototype = Object.create(Error.prototype);
  ViewError.prototype.constructor = ViewError;
  function fail(code, message) { throw new ViewError(code, message); }
  function ensure(condition, message) { if (!condition) fail('INVALID_V40_ARTIFACT', message); }
  function isObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
  function exactKeys(value, expected, label) {
    if (!isObject(value)) fail('INVALID_V40_ARTIFACT', label + ' must be an object');
    var actual = Object.keys(value).sort();
    var wanted = expected.slice().sort();
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail('INVALID_V40_ARTIFACT', label + ' fields are not exact');
  }
  function text(value, maximum, label) { ensure(typeof value === 'string' && value.length > 0 && value.length <= maximum && value === value.trim(), label + ' is invalid'); }
  function digest(value, label) { ensure(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value), label + ' is invalid'); }
  function rawDigest(value, label) { ensure(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), label + ' is invalid'); }
  function integer(value, minimum, maximum, label) { ensure(Number.isSafeInteger(value) && value >= minimum && value <= maximum, label + ' is invalid'); }
  function timestamp(value, label) {
    ensure(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), label + ' is invalid');
    ensure(Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString() === value, label + ' is invalid');
  }
  function reference(value, label, expectedSchema) {
    exactKeys(value, ['id', 'schema', 'sha256'], label);
    text(value.id, 180, label + ' id');
    text(value.schema, 180, label + ' schema');
    digest(value.sha256, label + ' digest');
    if (expectedSchema) ensure(value.schema === expectedSchema, label + ' schema mismatch');
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
  function validateHistory(value, label) {
    exactKeys(value, HISTORY_KEYS, label);
    reference(value.commitmentRef, label + ' commitment', COMMITMENT_SCHEMA);
    reference(value.snapshotRef, label + ' snapshot');
    integer(value.proposalCount, 0, 10000, label + ' proposal count');
    integer(value.settlementCount, 0, 10000, label + ' settlement count');
    integer(value.heldSettlementCount, 0, value.settlementCount, label + ' held settlement count');
    integer(value.eventCount, 0, 20000, label + ' event count');
    ensure(value.eventCount === value.proposalCount + value.settlementCount, label + ' event count mismatch');
  }
  function validateDivergence(value) {
    exactKeys(value, DIVERGENCE_KEYS, 'earliest divergence');
    integer(value.eventIndex, 1, 20001, 'earliest divergence event index');
    ensure(['PROPOSAL', 'SETTLEMENT'].indexOf(value.leftKind) !== -1, 'left divergence kind is invalid');
    ensure(['PROPOSAL', 'SETTLEMENT'].indexOf(value.rightKind) !== -1, 'right divergence kind is invalid');
    integer(value.leftSequence, 1, 10000, 'left divergence sequence');
    integer(value.rightSequence, 1, 10000, 'right divergence sequence');
    digest(value.leftContentDigest, 'left divergence digest');
    digest(value.rightContentDigest, 'right divergence digest');
    ensure(!(value.leftKind === value.rightKind && value.leftSequence === value.rightSequence && value.leftContentDigest === value.rightContentDigest), 'claimed divergence events match');
  }
  function validateStatic(item) {
    ensure(isObject(item), 'review item is invalid');
    ensure(item.kind === REVIEW_KIND, 'review item kind is invalid');
    rawDigest(item.artifactDigest, 'review item artifact digest');
    var action = item.action;
    exactKeys(action, ACTION_KEYS, 'review action');
    ensure(action.schema === ACTION_SCHEMA && action.type === 'inspect-transition-settlement-history-divergence', 'review action identity is invalid');
    ['automaticApply', 'reconciliationOnApproval', 'executionOnApproval', 'adoptionOnApproval', 'promotionAuthority', 'mergeAuthority', 'canonAuthority'].forEach(function (key) {
      ensure(action[key] === false, 'review action authority boundary is invalid');
    });
    var artifact = action.artifact;
    var rough;
    try { rough = JSON.stringify(artifact); } catch (_) { fail('INVALID_V40_ARTIFACT', 'artifact cannot be serialized'); }
    if (utf8Bytes(rough).byteLength > MAX_ARTIFACT_CANONICAL_BYTES) fail('OVERSIZED_ARTIFACT', 'artifact exceeds one MiB inspection bound');
    exactKeys(artifact, ARTIFACT_KEYS, 'review artifact');
    ensure(artifact.schema === ARTIFACT_SCHEMA && artifact.version === VERSION && artifact.status === STATUS && artifact.mode === MODE, 'artifact identity is invalid');
    ensure(artifact.classification === 'COMPLETE_HISTORY_DIVERGENCE_RECONCILIATION_REVIEW_ARTIFACT', 'artifact is not a history divergence');
    text(artifact.artifactId, 180, 'artifact id');
    timestamp(artifact.generatedAt, 'artifact generation time');
    reference(artifact.observationRef, 'v3.9 observation reference', OBSERVATION_SCHEMA);
    validateHistory(artifact.leftHistory, 'left history');
    validateHistory(artifact.rightHistory, 'right history');
    exactKeys(artifact.comparison, ['commonNormalizedEventPrefixLength', 'earliestDivergence'], 'history comparison');
    integer(artifact.comparison.commonNormalizedEventPrefixLength, 0, 20000, 'common history prefix length');
    validateDivergence(artifact.comparison.earliestDivergence);
    ensure(artifact.comparison.earliestDivergence.eventIndex === artifact.comparison.commonNormalizedEventPrefixLength + 1, 'divergence index does not follow common prefix');
    exactKeys(artifact.decision, ['reviewRequired', 'holdRequired', 'reconciliationRequired', 'bestAction', 'autonomousActionCount'], 'review decision');
    ensure(artifact.decision.reviewRequired === true && artifact.decision.holdRequired === true && artifact.decision.reconciliationRequired === true && artifact.decision.autonomousActionCount === 0, 'review decision boundary is invalid');
    ensure(artifact.decision.bestAction === 'PRESERVE_BOTH_HISTORY_COMMITMENTS_AND_REQUEST_AUTHENTICATED_STEWARD_RECONCILIATION', 'review best action is invalid');
    exactKeys(artifact.truth, Object.keys(EXPECTED_TRUTH), 'artifact truth');
    Object.keys(EXPECTED_TRUTH).forEach(function (key) { ensure(artifact.truth[key] === EXPECTED_TRUTH[key], 'artifact truth boundary is invalid'); });
    digest(artifact.artifactDigest, 'artifact self digest');
    return artifact;
  }
  function genericView() { return { applies: false, state: 'GENERIC', voteReady: true, integrityCode: 'NOT_APPLICABLE' }; }
  function holdView(code) {
    return {
      applies: true,
      state: 'HOLD',
      voteReady: false,
      integrityCode: code || 'INVALID_V40_ARTIFACT',
      message: 'Exact transition-history reconciliation artifact integrity was not verified. Voting is disabled for this item.'
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
        bestAction: artifact.decision.bestAction,
        observation: artifact.observationRef,
        leftHistory: artifact.leftHistory,
        rightHistory: artifact.rightHistory,
        commonPrefixLength: artifact.comparison.commonNormalizedEventPrefixLength,
        divergence: artifact.comparison.earliestDivergence
      };
    }).catch(function (error) { return holdView(error && error.code || 'DIGEST_VERIFIER_UNAVAILABLE'); });
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character];
    });
  }
  function fact(label, value, className) {
    return '<div class="audit-fact ' + esc(className || '') + '"><dt>' + esc(label) + '</dt><dd><code>' + esc(value) + '</code></dd></div>';
  }
  function historyFacts(label, history) {
    return fact(label + ' commitment', history.commitmentRef.sha256, 'wide') +
      fact(label + ' snapshot', history.snapshotRef.sha256, 'wide') +
      fact(label + ' proposals / settlements / held', history.proposalCount + ' / ' + history.settlementCount + ' / ' + history.heldSettlementCount) +
      fact(label + ' normalized events', history.eventCount);
  }
  function renderPending() {
    return '<section class="typed-audit-review pending" role="status" aria-label="Transition-history reconciliation artifact integrity check pending">' +
      '<span class="badge warn">VERIFYING</span><h3>Checking exact divergence artifact…</h3>' +
      '<p>Voting stays disabled until the embedded canonical SHA-256 matches the Review Inbox item.</p></section>';
  }
  function renderUnavailable() {
    return '<section class="typed-audit-review hold" role="alert" aria-label="Transition-history reconciliation verifier unavailable">' +
      '<span class="badge bad">HOLD</span><h3>Typed divergence verifier unavailable</h3>' +
      '<p>Voting is disabled. Raw evidence remains below for diagnosis; no review or reconciliation authority was granted.</p></section>';
  }
  function render(view) {
    if (!view || !view.applies) return '';
    if (view.state !== 'VERIFIED') {
      return '<section class="typed-audit-review hold" role="alert" data-integrity-state="HOLD" aria-label="Transition-history reconciliation artifact integrity mismatch">' +
        '<span class="badge bad">INTEGRITY HOLD</span><h3>Do not vote on this claimed divergence</h3>' +
        '<p>' + esc(view.message) + '</p><p class="integrity-code">Reason: <code>' + esc(view.integrityCode) + '</code></p>' +
        '<p class="truth">Raw evidence remains below for diagnosis. This hold authenticates no actor and reconciles no history.</p></section>';
    }
    var divergence = view.divergence;
    return '<section class="typed-audit-review verified" role="status" data-integrity-state="VERIFIED" aria-labelledby="historyReconciliationHeading">' +
      '<div class="typed-audit-heading"><div><span class="badge ok">EXACT DIGEST VERIFIED</span><h3 id="historyReconciliationHeading">Transition-history divergence context</h3></div><span class="review-state">Review item: ' + esc(view.itemState) + '</span></div>' +
      '<p class="typed-audit-intro">The embedded v4.0 artifact matches this Review Inbox digest. Compare both complete-history commitments and the first different normalized event; approval would approve only this exact artifact.</p>' +
      '<dl class="audit-facts">' +
        fact('Current best action', view.bestAction, 'wide') +
        fact('Common normalized prefix', view.commonPrefixLength + ' event(s)') +
        fact('First divergence', 'event ' + divergence.eventIndex) +
        fact('Left divergent event', divergence.leftKind + ' ' + divergence.leftSequence, 'wide') +
        fact('Left divergent digest', divergence.leftContentDigest, 'wide') +
        fact('Right divergent event', divergence.rightKind + ' ' + divergence.rightSequence, 'wide') +
        fact('Right divergent digest', divergence.rightContentDigest, 'wide') +
        historyFacts('Left history', view.leftHistory) +
        historyFacts('Right history', view.rightHistory) +
        fact('V3.9 observation', view.observation.sha256, 'wide') +
        fact('Artifact generated', view.generatedAt) +
        fact('Full reviewed digest', view.digest, 'wide full-digest') +
      '</dl>' +
      '<div class="authority-boundaries" aria-label="Authority boundaries"><h4>What this review cannot do</h4><ul>' +
        '<li><b>The history divergence remains unresolved.</b> Approval is not reconciliation.</li>' +
        '<li>Pairwise evidence proves no independent custody, protected global history, or later currentness.</li>' +
        '<li>No execution, adoption, provider call, evaluation, permission grant, install, promotion, merge, Foundation mutation, or CANON.</li>' +
        '<li>No authenticated submitter, reviewer, steward identity, or actual human participation is proven by this view.</li>' +
      '</ul></div>' +
      '<p class="truth">Raw exact-item JSON remains visible below. Digest verification proves content equality only—not origin, identity, durability, reconciliation, benefit, or learning.</p>' +
    '</section>';
  }

  return {
    REVIEW_KIND: REVIEW_KIND,
    ARTIFACT_SCHEMA: ARTIFACT_SCHEMA,
    VERSION: VERSION,
    STATUS: STATUS,
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
