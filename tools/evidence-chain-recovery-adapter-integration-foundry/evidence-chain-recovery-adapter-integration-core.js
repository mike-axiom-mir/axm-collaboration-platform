(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMEvidenceChainRecoveryAdapterIntegrationCore = api;
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';

  var RECEIPT_SCHEMA = 'axm.evidence-chain-recovery-adapter-conformance-receipt/v1';
  var PACKET_SCHEMA = 'axm.evidence-chain-recovery-adapter-integration-acceptance-packet/v1';
  var CAPABILITY = 'capability.plan.evidence-chain-recovery-adapter-integration/v1';
  var CONFORMANCE_CAPABILITY = 'capability.verify.evidence-chain-recovery-adapter/v1';
  var LIVE_CAPABILITY = 'capability.apply.evidence-chain-reviewed-recovery/v1';
  var MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
  var HASH_PATTERN = /^[a-f0-9]{64}$/i;
  var REQUIRED_SCENARIOS = [
    'FIXTURE_PERMISSION_DENIAL',
    'EXACT_APPLY_CONFIRMATION',
    'STALE_PREVIEW_REFUSAL',
    'CANDIDATE_DIGEST_MISMATCH_REFUSAL',
    'CURRENT_STATE_DRIFT_REFUSAL',
    'APPLY_INSPECT_ROLLBACK',
    'DIGEST_ONLY_RECEIPT_PRIVACY'
  ];
  var REQUIRED_PROVIDES = ['current-state-bound-restore-preview', 'expiring-restore-preview', 'pre-restore-safety-copy', 'persistent-restore-lineage', 'governed-rollback-preview', 'pre-rollback-safety-copy', 'recoverable-restore-rollback'];
  var REQUIRED_REFUSALS = ['stale-restore-preview', 'restore-after-current-state-drift', 'restore-without-permission', 'restore-without-exact-confirmation', 'restore-without-safety-copy', 'stale-rollback-preview', 'rollback-after-current-state-drift', 'rollback-without-permission', 'rollback-without-exact-confirmation', 'rollback-without-safety-copy', 'path-escape', 'symbolic-link-target', 'automatic-restore', 'automatic-rollback', 'automatic-promotion'];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function inspectorDependency(override) {
    var inspector = override || (root && root.AXMEvidenceChainCore);
    if (!inspector && typeof require === 'function') inspector = require('../evidence-chain-inspector/evidence-chain-core');
    if (!inspector || typeof inspector.sha256 !== 'function' || typeof inspector.canonical !== 'function') throw new Error('Evidence Chain Inspector dependency is unavailable');
    return inspector;
  }

  function drillDependency(override) {
    var drill = override || (root && root.AXMEvidenceChainApplicationDrillCore);
    if (!drill && typeof require === 'function') drill = require('../evidence-chain-application-drill-runner/evidence-chain-application-drill-core');
    if (!drill || typeof drill.parsePlan !== 'function') throw new Error('Evidence Chain Application Drill dependency is unavailable');
    return drill;
  }

  function conformanceDependency(override) {
    var conformance = override || (root && root.AXMEvidenceChainRecoveryAdapterConformanceCore);
    if (!conformance && typeof require === 'function') conformance = require('../evidence-chain-recovery-adapter-conformance-lab/evidence-chain-recovery-adapter-conformance-core');
    if (!conformance || !Array.isArray(conformance.REQUIRED_SCENARIOS)) throw new Error('Evidence Chain Recovery Adapter Conformance dependency is unavailable');
    return conformance;
  }

  function parseObject(value, label, maxBytes) {
    var parsed = value;
    if (typeof value === 'string') {
      if (byteLength(value) > maxBytes) throw new Error(label + ' exceeds its size limit');
      try { parsed = JSON.parse(value); }
      catch (error) { throw new Error(label + ' JSON is invalid: ' + error.message); }
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(label + ' must be a JSON object');
    return clone(parsed);
  }

  function byteLength(value) {
    var source = String(value == null ? '' : value);
    if (typeof Buffer !== 'undefined') return Buffer.byteLength(source, 'utf8');
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(source).length;
    return unescape(encodeURIComponent(source)).length;
  }

  function parseDate(value, label) {
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error(label + ' must be a valid date');
    return date;
  }

  function requireHashes(object, fields, label) {
    fields.forEach(function (field) { if (!HASH_PATTERN.test(String(object[field] || ''))) throw new Error(label + '.' + field + ' must be SHA-256'); });
  }

  function requireTruth(truth, trueFields, falseFields, label) {
    trueFields.forEach(function (field) { if (truth[field] !== true) throw new Error(label + '.' + field + ' must be true'); });
    falseFields.forEach(function (field) { if (truth[field] !== false) throw new Error(label + '.' + field + ' must be false'); });
  }

  function parseReceipt(value) {
    var parsed = parseObject(value, 'conformance receipt', 1024 * 1024);
    if (parsed.schema !== RECEIPT_SCHEMA || parsed.capability !== CONFORMANCE_CAPABILITY || parsed.status !== 'PASS_WITH_LIMITS') throw new Error('conformance receipt identity mismatch');
    requireHashes(parsed, ['runId', 'probeId', 'planId', 'planSha256', 'sourceSha256', 'candidateSha256', 'profileSha256'], 'conformance receipt');
    if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(String(parsed.profileId || '')) || !/^\d+\.\d+\.\d+$/.test(String(parsed.profileVersion || ''))) throw new Error('conformance receipt profile identity is invalid');
    if (!Array.isArray(parsed.scenarios) || parsed.scenarios.length !== REQUIRED_SCENARIOS.length || parsed.scenarios.some(function (item, index) { return !item || item.code !== REQUIRED_SCENARIOS[index] || item.verdict !== 'PASS'; })) throw new Error('conformance receipt scenario coverage mismatch');
    requireTruth(parsed.truth || {}, ['fixtureAdapterExecuted', 'fixturePermissionDenialObserved', 'fixtureApplyDigestObserved', 'fixtureRollbackDigestObserved', 'responsePrivacyChecked'], ['productionAdapterExecuted', 'RecoveryCenterCalled', 'filesystemIoPerformed', 'networkCalled', 'permissionRequestedLive', 'allowedIdentityVerifiedLive', 'deniedIdentityVerifiedLive', 'liveTargetRead', 'liveTargetWritten', 'liveApplyCapabilityClosed', 'authorityGranted', 'promoted', 'canon'], 'conformance receipt truth');
    if (!parsed.limits || parsed.limits.missingCapability !== LIVE_CAPABILITY || parsed.limits.productionAdapterEvidenceRequired !== true || parsed.limits.independentLiveAuthorizationEvidenceRequired !== true || parsed.limits.humanApplicationDecisionRequired !== true) throw new Error('conformance receipt limits mismatch');
    parseDate(parsed.verifiedAt, 'conformance receipt verifiedAt');
    return parsed;
  }

  function parseRecoveryManifest(value) {
    var parsed = parseObject(value, 'Recovery Center manifest', 256 * 1024);
    if (parsed.schema !== 'axm.tool-manifest/v1' || parsed.id !== 'recovery-center' || parsed.kind !== 'product' || parsed.status !== 'TEST') throw new Error('Recovery Center manifest identity mismatch');
    if (!Array.isArray(parsed.permissions) || parsed.permissions.length !== 1 || parsed.permissions[0] !== 'recovery.apply') throw new Error('Recovery Center manifest must declare exactly recovery.apply');
    ['axm.restore-preview/v2', 'axm.recovery-restore-receipt/v1', 'axm.recovery-rollback-preview/v1', 'axm.recovery-rollback-receipt/v1'].forEach(function (schema) { if (!Array.isArray(parsed.produces) || parsed.produces.indexOf(schema) < 0) throw new Error('Recovery Center manifest is missing ' + schema); });
    return parsed;
  }

  function parseRecoveryContract(value) {
    var parsed = parseObject(value, 'Recovery Center contract', 256 * 1024);
    if (parsed.schema !== 'axm.module-contract/v1' || parsed.id !== 'recovery-center') throw new Error('Recovery Center contract identity mismatch');
    if (!Array.isArray(parsed.permissions) || parsed.permissions.length !== 1 || parsed.permissions[0] !== 'recovery.apply') throw new Error('Recovery Center contract must declare exactly recovery.apply');
    REQUIRED_PROVIDES.forEach(function (capability) { if (!Array.isArray(parsed.provides) || parsed.provides.indexOf(capability) < 0) throw new Error('Recovery Center contract is missing ' + capability); });
    REQUIRED_REFUSALS.forEach(function (refusal) { if (!parsed.boundaries || !Array.isArray(parsed.boundaries.refuses) || parsed.boundaries.refuses.indexOf(refusal) < 0) throw new Error('Recovery Center contract is missing refusal ' + refusal); });
    return parsed;
  }

  function acceptanceGates() {
    return [
      { order: 1, code: 'EXACT_ARTIFACT_DIGEST_BOUND', state: 'PASS_STATIC', evidenceRequired: 'adapter-source-sha256-and-byte-count', stopIf: 'artifact-bytes-differ' },
      { order: 2, code: 'PLAN_AND_CONFORMANCE_RECEIPT_BOUND', state: 'PASS_STATIC', evidenceRequired: 'recomputed-plan-receipt-and-run-digests', stopIf: 'any-binding-differs' },
      { order: 3, code: 'RECOVERY_DECLARATIONS_COMPATIBLE', state: 'PASS_STATIC', evidenceRequired: 'exact-manifest-contract-digests-and-required-refusals', stopIf: 'declaration-drift' },
      { order: 4, code: 'CANDIDATE_STAGING_ADAPTER_IMPLEMENTED', state: 'BLOCKED', evidenceRequired: 'reviewed-ndjson-to-recovery-request-transport', stopIf: 'adapter-not-implemented-or-bytes-change' },
      { order: 5, code: 'PRODUCTION_BUILD_MATCHES_REVIEWED_DIGEST', state: 'NOT_RUN', evidenceRequired: 'loaded-build-sha256-equals-adapter-artifact-sha256', stopIf: 'loaded-build-differs' },
      { order: 6, code: 'ALLOWED_IDENTITY_PREVIEW', state: 'NOT_RUN', evidenceRequired: 'permission-service-and-adapter-receipts-for-one-allowed-identity', stopIf: 'permission-or-preview-missing' },
      { order: 7, code: 'DENIED_IDENTITY_REFUSAL', state: 'NOT_RUN', evidenceRequired: 'permission-service-and-adapter-denial-receipts-for-separate-denied-identity', stopIf: 'preview-or-apply-succeeds' },
      { order: 8, code: 'STALE_TAMPER_AND_DRIFT_REFUSAL', state: 'NOT_RUN', evidenceRequired: 'live-refusal-receipts-with-zero-writes', stopIf: 'any-refusal-is-untyped-or-writes' },
      { order: 9, code: 'APPLY_WITH_SAFETY_COPY', state: 'NOT_RUN', evidenceRequired: 'fresh-preview-permission-confirmation-safety-copy-and-application-receipts', stopIf: 'any-lineage-link-missing' },
      { order: 10, code: 'POST_APPLY_INSPECTION', state: 'NOT_RUN', evidenceRequired: 'independent-candidate-chain-pass-and-target-digest', stopIf: 'inspection-does-not-match-candidate' },
      { order: 11, code: 'ROLLBACK_AND_POST_INSPECTION', state: 'NOT_RUN', evidenceRequired: 'fresh-rollback-preview-safety-copy-receipt-and-restored-source-digest', stopIf: 'rollback-lineage-or-source-digest-missing' },
      { order: 12, code: 'AUDIT_PRIVACY_AND_CLEANUP', state: 'NOT_RUN', evidenceRequired: 'redacted-audit-and-explicit-test-artifact-cleanup-receipts', stopIf: 'private-data-leak-or-retained-test-artifact' }
    ];
  }

  function evidenceRoutes() {
    return [
      { claim: 'exact-build-loaded', kind: 'transport', primarySurface: 'reviewed-artifact-digest-plus-loaded-runtime-digest', verdict: 'UNKNOWN' },
      { claim: 'allowed-and-denied-identities-enforced', kind: 'authorization', primarySurface: 'independent-allowed-and-denied-identity-attempts-plus-permission-audit', verdict: 'UNKNOWN' },
      { claim: 'live-apply-and-rollback-preserve-lineage', kind: 'deterministic-behavior-and-persistence', primarySurface: 'fresh-preview-apply-inspect-rollback-restart-and-compare', verdict: 'UNKNOWN' },
      { claim: 'operator-journey-is-usable', kind: 'interaction-journey', primarySurface: 'live-browser-input-action-settled-observation', verdict: 'UNKNOWN' }
    ];
  }

  async function build(adapterSource, plan, receipt, recoveryManifest, recoveryContract, options, overrides) {
    var dependencies = overrides || {};
    var inspector = inspectorDependency(dependencies.inspector);
    var drill = drillDependency(dependencies.drill);
    var conformance = conformanceDependency(dependencies.conformance);
    var settings = options || {};
    if (JSON.stringify(conformance.REQUIRED_SCENARIOS) !== JSON.stringify(REQUIRED_SCENARIOS)) throw new Error('conformance scenario dependency drift');
    if (settings.acknowledgeArtifactIsData !== true) throw new Error('artifact-is-data acknowledgement is required');
    if (settings.acknowledgeNoAuthority !== true) throw new Error('no-authority acknowledgement is required');
    if (settings.acknowledgeIndependentIdentityTests !== true) throw new Error('independent identity tests acknowledgement is required');
    if (settings.acknowledgeLiveRollbackRequired !== true) throw new Error('live rollback acknowledgement is required');
    var artifact = String(adapterSource == null ? '' : adapterSource);
    var artifactBytes = byteLength(artifact);
    if (!artifactBytes || artifactBytes > MAX_ARTIFACT_BYTES) throw new Error('adapter source must be non-empty UTF-8 text no larger than 2 MiB');
    if (artifact.indexOf('\u0000') >= 0) throw new Error('adapter source cannot contain NUL bytes');
    var parsedPlan = drill.parsePlan(plan);
    var parsedReceipt = parseReceipt(receipt);
    var manifest = parseRecoveryManifest(recoveryManifest);
    var contract = parseRecoveryContract(recoveryContract);
    var generated = parseDate(settings.generatedAt || new Date().toISOString(), 'generatedAt');
    var planGenerated = parseDate(parsedPlan.generatedAt, 'application plan generatedAt');
    var planExpires = parseDate(parsedPlan.expiresAt, 'application plan expiresAt');
    var receiptVerified = parseDate(parsedReceipt.verifiedAt, 'conformance receipt verifiedAt');
    if (generated.getTime() < planGenerated.getTime()) throw new Error('application plan is not active yet');
    if (generated.getTime() > planExpires.getTime()) throw new Error('application plan has expired');
    if (receiptVerified.getTime() < planGenerated.getTime() || receiptVerified.getTime() > planExpires.getTime() || receiptVerified.getTime() > generated.getTime()) throw new Error('conformance receipt time is outside the active plan window');
    var planSha256 = await inspector.sha256(inspector.canonical(parsedPlan));
    var expectedRunId = await inspector.sha256(inspector.canonical({ probeId: parsedReceipt.probeId, profileSha256: parsedReceipt.profileSha256, scenarioCodes: parsedReceipt.scenarios.map(function (item) { return item.code; }) }));
    if (parsedReceipt.runId !== expectedRunId) throw new Error('conformance receipt runId does not recompute');
    if (parsedReceipt.planId !== parsedPlan.planId || parsedReceipt.planSha256 !== planSha256 || parsedReceipt.sourceSha256 !== parsedPlan.target.expectedCurrentSourceSha256 || parsedReceipt.candidateSha256 !== parsedPlan.candidate.sha256) throw new Error('application plan and conformance receipt digest binding mismatch');
    var artifactSha256 = await inspector.sha256(artifact);
    var manifestSha256 = await inspector.sha256(inspector.canonical(manifest));
    var contractSha256 = await inspector.sha256(inspector.canonical(contract));
    var identity = {
      capability: CAPABILITY,
      adapterArtifactSha256: artifactSha256,
      planId: parsedPlan.planId,
      conformanceRunId: parsedReceipt.runId,
      recoveryManifestSha256: manifestSha256,
      recoveryContractSha256: contractSha256,
      generatedAt: generated.toISOString()
    };
    var packetId = await inspector.sha256(inspector.canonical(identity));
    return {
      schema: PACKET_SCHEMA,
      capability: CAPABILITY,
      status: 'INTEGRATION_ACCEPTANCE_PACKET_READY_WITH_BLOCKERS',
      packetId: packetId,
      generatedAt: generated.toISOString(),
      expiresAt: planExpires.toISOString(),
      planId: parsedPlan.planId,
      planSha256: planSha256,
      conformanceRunId: parsedReceipt.runId,
      conformanceProbeId: parsedReceipt.probeId,
      conformanceProfileSha256: parsedReceipt.profileSha256,
      sourceSha256: parsedReceipt.sourceSha256,
      candidateSha256: parsedReceipt.candidateSha256,
      adapterArtifact: {
        mediaType: 'text/javascript; charset=utf-8',
        sha256: artifactSha256,
        bytes: artifactBytes,
        dataOnly: true,
        executed: false,
        nameIncluded: false,
        pathIncluded: false,
        sourceIncluded: false
      },
      recoveryService: {
        id: 'recovery-center',
        status: manifest.status,
        manifestSha256: manifestSha256,
        contractSha256: contractSha256,
        requiredPermission: 'recovery.apply',
        permissionCount: 1,
        previewCurrentStateBound: true,
        restoreSafetyCopyRequired: true,
        rollbackPreviewRequired: true,
        rollbackSafetyCopyRequired: true,
        declarationsAreRuntimeProof: false
      },
      integrationContract: {
        capabilityTarget: LIVE_CAPABILITY,
        adapterArtifactMustMatchDigest: true,
        candidateTransport: 'ADAPTER_IMPLEMENTATION_REQUIRED',
        acceptedCandidateFormat: 'application/x-ndjson',
        recoveryInputs: ['axm.recovery-request/v1', 'axm.workshop-package/v1'],
        permissionSource: 'service:secrets-permissions-console',
        permissionMustBeFresh: true,
        exactApplyConfirmationRequired: true,
        exactRollbackConfirmationRequired: true,
        safetyCopiesRequired: 2,
        productionExecutionAvailable: false
      },
      acceptanceGates: acceptanceGates(),
      blockers: [
        'CANDIDATE_TO_RECOVERY_REQUEST_ADAPTER_NOT_IMPLEMENTED',
        'PRODUCTION_BUILD_NOT_EXECUTED',
        'ALLOWED_IDENTITY_NOT_VERIFIED',
        'DENIED_IDENTITY_NOT_VERIFIED',
        'LIVE_APPLY_NOT_TESTED',
        'LIVE_ROLLBACK_NOT_TESTED',
        'LIVE_BROWSER_JOURNEY_NOT_OBSERVED'
      ],
      evidenceRoutes: evidenceRoutes(),
      resourceBudget: {
        maxAdapterSourceBytes: MAX_ARTIFACT_BYTES,
        artifactCount: 1,
        networkCalls: 0,
        filesystemWrites: 0,
        persistentRecords: 0
      },
      truth: {
        packetOnly: true,
        artifactDigestBound: true,
        planAndConformanceReceiptBound: true,
        RecoveryCenterDeclarationsInspected: true,
        artifactParsedAsCode: false,
        artifactExecuted: false,
        adapterImplemented: false,
        candidateStagingAvailable: false,
        productionAdapterLoaded: false,
        permissionRequested: false,
        permissionGranted: false,
        allowedIdentityVerified: false,
        deniedIdentityVerified: false,
        liveTargetRead: false,
        liveTargetWritten: false,
        RecoveryCenterCalled: false,
        candidateApplied: false,
        rollbackPerformed: false,
        liveApplyCapabilityClosed: false,
        installed: false,
        promoted: false,
        canon: false
      }
    };
  }

  function downloadName() { return 'evidence-chain-recovery-adapter-integration-acceptance-packet.json'; }

  return {
    PACKET_SCHEMA: PACKET_SCHEMA,
    CAPABILITY: CAPABILITY,
    LIVE_CAPABILITY: LIVE_CAPABILITY,
    MAX_ARTIFACT_BYTES: MAX_ARTIFACT_BYTES,
    REQUIRED_SCENARIOS: clone(REQUIRED_SCENARIOS),
    REQUIRED_PROVIDES: clone(REQUIRED_PROVIDES),
    REQUIRED_REFUSALS: clone(REQUIRED_REFUSALS),
    descriptor: {
      id: 'evidence-chain-recovery-adapter-integration-foundry',
      capability: CAPABILITY,
      version: '1.0.0',
      status: 'TEST',
      accepts: ['text/javascript', 'axm.evidence-chain-recovery-application-plan/v1', RECEIPT_SCHEMA, 'axm.tool-manifest/v1', 'axm.module-contract/v1'],
      produces: [PACKET_SCHEMA],
      sideEffects: []
    },
    parseReceipt: parseReceipt,
    parseRecoveryManifest: parseRecoveryManifest,
    parseRecoveryContract: parseRecoveryContract,
    build: build,
    downloadName: downloadName
  };
});
