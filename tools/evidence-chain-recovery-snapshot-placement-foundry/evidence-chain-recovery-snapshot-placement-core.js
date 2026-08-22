(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMEvidenceChainRecoverySnapshotPlacementCore = api;
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';

  var STAGING_SCHEMA = 'axm.evidence-chain-recovery-snapshot-staging-receipt/v1';
  var STAGING_CAPABILITY = 'capability.stage.evidence-chain-recovery-snapshot/v1';
  var REQUEST_SCHEMA = 'axm.evidence-chain-recovery-snapshot-placement-request/v1';
  var RECEIPT_SCHEMA = 'axm.evidence-chain-recovery-snapshot-placement-receipt/v1';
  var CAPABILITY = 'capability.place.evidence-chain-recovery-snapshot/v1';
  var LIVE_CAPABILITY = 'capability.apply.evidence-chain-reviewed-recovery/v1';
  var SAFE_ROOT_PREFIX = 'axm-evidence-chain-recovery-stage-';
  var SNAPSHOT_PREFIX = 'axm-workshop-full-evidence-repair-';
  var HASH_PATTERN = /^[a-f0-9]{64}$/i;
  var SNAPSHOT_PATTERN = /^axm-workshop-full-evidence-repair-[a-f0-9]{16}$/;
  var DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  var REQUEST_TTL_MS = 15 * 60 * 1000;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function inspectorDependency(override) {
    var inspector = override || (root && root.AXMEvidenceChainCore);
    if (!inspector && typeof require === 'function') inspector = require('../evidence-chain-inspector/evidence-chain-core');
    if (!inspector || typeof inspector.sha256 !== 'function' || typeof inspector.canonical !== 'function') throw new Error('Evidence Chain Inspector dependency is unavailable');
    return inspector;
  }

  function parseTextObject(value, label, limit) {
    if (typeof value !== 'string') throw new Error(label + ' must be supplied as exact UTF-8 JSON text');
    if (!value.length || value.length > limit) throw new Error(label + ' exceeds its size limit');
    var parsed;
    try { parsed = JSON.parse(value); }
    catch (error) { throw new Error(label + ' JSON is invalid: ' + error.message); }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(label + ' must be a JSON object');
    return clone(parsed);
  }

  function requireHash(value, label) {
    if (!HASH_PATTERN.test(String(value || ''))) throw new Error(label + ' must be SHA-256');
  }

  function requireTrue(object, fields, label) {
    fields.forEach(function (field) {
      if (!object || object[field] !== true) throw new Error(label + '.' + field + ' must be true');
    });
  }

  function requireFalse(object, fields, label) {
    fields.forEach(function (field) {
      if (!object || object[field] !== false) throw new Error(label + '.' + field + ' must be false');
    });
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

  function normalizeTarget(value) {
    var target = String(value || '').trim().replace(/\\/g, '/');
    if (!target || target.length > 400 || target.indexOf('\0') >= 0 || /^\//.test(target) || /^[A-Za-z]:/.test(target)) throw new Error('package target must be a safe relative path');
    var parts = target.split('/');
    if (parts.some(function (part) { return !part || part === '.' || part === '..'; })) throw new Error('package target contains an unsafe path segment');
    if (parts.length < 4 || parts[0] !== 'state' || parts[1] !== 'evidence-retention' || !/\.jsonl$/i.test(parts[parts.length - 1])) throw new Error('package target must be a JSONL file below a retained state/evidence-retention subfolder');
    return parts.join('/');
  }

  function normalizeOutputBinding(value) {
    var binding = String(value || '').trim();
    if (!binding || binding.length > 2048 || /[\r\n\0]/.test(binding)) throw new Error('private packager output binding is required');
    return binding;
  }

  function parseStagingReceipt(text) {
    var receipt = parseTextObject(text, 'staging receipt', 2 * 1024 * 1024);
    if (receipt.schema !== STAGING_SCHEMA || receipt.capability !== STAGING_CAPABILITY || receipt.status !== 'STAGED_FOR_HUMAN_PLACEMENT_WITH_LIMITS') throw new Error('staging receipt identity mismatch');
    ['requestId', 'packetId', 'planId', 'conformanceRunId', 'sourceSha256', 'candidateSha256', 'targetPathSha256', 'manifestSha256'].forEach(function (field) { requireHash(receipt[field], 'staging receipt.' + field); });
    if (!SNAPSHOT_PATTERN.test(String(receipt.snapshotId || ''))) throw new Error('staging receipt snapshotId mismatch');
    if (!Number.isSafeInteger(receipt.candidateBytes) || receipt.candidateBytes < 1 || !Number.isSafeInteger(receipt.candidateEvents) || receipt.candidateEvents < 1) throw new Error('staging receipt candidate counts are invalid');
    requireTrue(receipt.observations, ['ownedRootCreated', 'packageFolderCreated', 'candidateExactBytesObserved', 'candidateDigestObserved', 'manifestReadbackObserved', 'manifestCandidateLedgerMatches', 'retainedForHumanReview'], 'staging receipt.observations');
    requireFalse(receipt.privacy, ['outputRootPathIncluded', 'targetRelativePathIncluded', 'sourcePayloadIncluded', 'candidatePayloadIncluded', 'identityIncluded', 'secretIncluded'], 'staging receipt.privacy');
    requireTrue(receipt.truth, ['actualFilesystemWrite', 'stagedRootRetained'], 'staging receipt.truth');
    requireFalse(receipt.truth, ['WorkshopPackagerOutputWritten', 'snapshotPlacedLive', 'RecoveryCenterCalled', 'permissionChecked', 'permissionGranted', 'liveTargetRead', 'liveTargetWritten', 'candidateApplied', 'rollbackPerformed', 'liveApplyCapabilityClosed', 'installed', 'promoted', 'canon'], 'staging receipt.truth');
    if (!receipt.limits || receipt.limits.missingPlacementCapability !== CAPABILITY || receipt.limits.missingLiveApplyCapability !== LIVE_CAPABILITY || receipt.limits.restoreTestStatus !== 'NOT_RUN') throw new Error('staging receipt limits mismatch');
    return receipt;
  }

  function parseManifest(text, receipt, now, maxAgeMs) {
    var manifest = parseTextObject(text, 'package manifest', 4 * 1024 * 1024);
    if (manifest.schema !== 'axm.workshop-package/v1' || manifest.mode !== 'full' || manifest.package_kind !== 'evidence-chain-recovery-staging-candidate') throw new Error('package manifest identity mismatch');
    if (manifest.snapshot_id !== receipt.snapshotId || manifest.file_count !== 1 || !Array.isArray(manifest.files) || manifest.files.length !== 1) throw new Error('package manifest snapshot or file count mismatch');
    if (!Number.isSafeInteger(manifest.total_bytes) || manifest.total_bytes !== receipt.candidateBytes) throw new Error('package manifest total bytes mismatch');
    if (!manifest.selection || !Array.isArray(manifest.selection.scopes) || manifest.selection.scopes.length !== 1 || manifest.selection.scopes[0] !== 'state/evidence-retention' || manifest.selection.paths_preserved !== true || manifest.selection.dependency_closure !== 'exact-reviewed-candidate-only') throw new Error('package manifest selection mismatch');
    var created = parseDate(manifest.created_at, 'package manifest.created_at');
    if (created.getTime() > now.getTime() + 5 * 60 * 1000) throw new Error('package manifest is from the future');
    if (now.getTime() - created.getTime() > maxAgeMs) throw new Error('package manifest is stale; rebuild and review the staging package');
    var recovery = manifest.evidence_chain_recovery;
    if (!recovery || recovery.request_id !== receipt.requestId || recovery.integration_packet_id !== receipt.packetId || recovery.application_plan_id !== receipt.planId || recovery.conformance_run_id !== receipt.conformanceRunId || recovery.expected_current_source_sha256 !== receipt.sourceSha256 || recovery.reviewed_candidate_sha256 !== receipt.candidateSha256 || recovery.live_placement !== false || recovery.application_authority !== false) throw new Error('package manifest recovery lineage mismatch');
    requireTrue(manifest.truth, ['staging_only'], 'package manifest.truth');
    requireFalse(manifest.truth, ['restore_test_run', 'packager_output_written', 'recovery_center_called', 'permission_granted', 'candidate_applied', 'promoted', 'canon'], 'package manifest.truth');
    var file = manifest.files[0];
    var target = normalizeTarget(file && file.path);
    requireHash(file && file.sha256, 'package manifest.files[0].sha256');
    if (!Number.isSafeInteger(file.bytes) || file.bytes !== receipt.candidateBytes || file.sha256 !== receipt.candidateSha256) throw new Error('package manifest candidate ledger mismatch');
    return { manifest: manifest, target: target, file: clone(file) };
  }

  async function prepare(stagingReceiptText, manifestText, candidateText, outputBinding, options) {
    options = options || {};
    var inspector = inspectorDependency(options.inspector);
    var now = options.now ? new Date(options.now) : new Date();
    if (!Number.isFinite(now.getTime())) throw new Error('placement time is invalid');
    var maxAgeMs = options.maxAgeMs == null ? DEFAULT_MAX_AGE_MS : Number(options.maxAgeMs);
    if (!Number.isFinite(maxAgeMs) || maxAgeMs < 60 * 1000 || maxAgeMs > 30 * 24 * 60 * 60 * 1000) throw new Error('placement maximum age is invalid');
    var receipt = parseStagingReceipt(stagingReceiptText);
    if (String(options.confirmSnapshotId || '') !== receipt.snapshotId) throw new Error('exact snapshot confirmation is required');
    if (options.acknowledgePackagerOutputPlacement !== true) throw new Error('packager output placement acknowledgement is required');
    if (options.acknowledgePrivateLocalData !== true) throw new Error('private local data acknowledgement is required');
    if (options.acknowledgeRetainedStaging !== true) throw new Error('retained staging acknowledgement is required');
    if (options.acknowledgeNoRestoreAuthority !== true) throw new Error('no restore authority acknowledgement is required');
    var parsed = parseManifest(manifestText, receipt, now, maxAgeMs);
    var candidate = String(candidateText == null ? '' : candidateText);
    var candidateSha256 = await inspector.sha256(candidate);
    var candidateBytes = byteLength(candidate);
    if (candidateSha256 !== receipt.candidateSha256 || candidateSha256 !== parsed.file.sha256 || candidateBytes !== receipt.candidateBytes || candidateBytes !== parsed.file.bytes) throw new Error('candidate bytes do not match the staged ledger');
    var targetPathSha256 = await inspector.sha256(parsed.target);
    if (targetPathSha256 !== receipt.targetPathSha256) throw new Error('candidate target path digest mismatch');
    var manifestSha256 = await inspector.sha256(manifestText);
    if (manifestSha256 !== receipt.manifestSha256) throw new Error('package manifest exact-byte digest mismatch');
    var stagingReceiptSha256 = await inspector.sha256(stagingReceiptText);
    var privateOutput = normalizeOutputBinding(outputBinding);
    var outputRootSha256 = await inspector.sha256(privateOutput);
    var preparedAt = now.toISOString();
    var expiresAt = new Date(now.getTime() + REQUEST_TTL_MS).toISOString();
    var identity = {
      capability: CAPABILITY,
      snapshotId: receipt.snapshotId,
      stagingReceiptSha256: stagingReceiptSha256,
      manifestSha256: manifestSha256,
      candidateSha256: candidateSha256,
      outputRootSha256: outputRootSha256,
      preparedAt: preparedAt
    };
    var requestId = await inspector.sha256(inspector.canonical(identity));
    return {
      schema: REQUEST_SCHEMA,
      capability: CAPABILITY,
      status: 'READY_FOR_EXPLICIT_PACKAGER_OUTPUT_PLACEMENT',
      requestId: requestId,
      preparedAt: preparedAt,
      expiresAt: expiresAt,
      snapshotId: receipt.snapshotId,
      stagingRequestId: receipt.requestId,
      packetId: receipt.packetId,
      planId: receipt.planId,
      conformanceRunId: receipt.conformanceRunId,
      stagingReceiptSha256: stagingReceiptSha256,
      manifestSha256: manifestSha256,
      sourceSha256: receipt.sourceSha256,
      candidateSha256: candidateSha256,
      targetPathSha256: targetPathSha256,
      outputRootSha256: outputRootSha256,
      candidateBytes: candidateBytes,
      candidateEvents: receipt.candidateEvents,
      placementContract: {
        destinationShape: '*/exports/workshop-packages',
        finalFolderName: receipt.snapshotId,
        finalMustNotExist: true,
        copyFileCount: 2,
        exactManifestAndCandidateOnly: true,
        privateScratchThenAtomicRename: true,
        retainedStagingSourceRequired: true,
        failedOwnedOutputCleanupRequired: true,
        receiverFolderLayoutCompatible: true
      },
      privacy: {
        outputRootPathIncluded: false,
        stagingRootPathIncluded: false,
        targetRelativePathIncluded: false,
        sourcePayloadIncluded: false,
        candidatePayloadIncluded: false
      },
      truth: {
        requestOnly: true,
        filesystemIoPerformed: false,
        packagerOutputWritten: false,
        snapshotPlacedForDiscovery: false,
        RecoveryCenterCalled: false,
        recoveryCenterListObserved: false,
        restorePreviewCreated: false,
        restoreTestRun: false,
        permissionChecked: false,
        permissionGranted: false,
        liveTargetRead: false,
        liveTargetWritten: false,
        candidateApplied: false,
        rollbackPerformed: false,
        liveApplyCapabilityClosed: false,
        installed: false,
        promoted: false,
        canon: false
      },
      limits: {
        missingLiveApplyCapability: LIVE_CAPABILITY,
        receiverRuntimeObservation: 'NOT_RUN',
        restoreTestStatus: 'NOT_RUN'
      }
    };
  }

  function downloadName() { return 'evidence-chain-recovery-snapshot-placement-request.json'; }

  return {
    STAGING_SCHEMA: STAGING_SCHEMA,
    STAGING_CAPABILITY: STAGING_CAPABILITY,
    REQUEST_SCHEMA: REQUEST_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    CAPABILITY: CAPABILITY,
    LIVE_CAPABILITY: LIVE_CAPABILITY,
    SAFE_ROOT_PREFIX: SAFE_ROOT_PREFIX,
    SNAPSHOT_PREFIX: SNAPSHOT_PREFIX,
    DEFAULT_MAX_AGE_MS: DEFAULT_MAX_AGE_MS,
    descriptor: {
      id: 'evidence-chain-recovery-snapshot-placement-foundry',
      capability: CAPABILITY,
      version: '1.0.0',
      status: 'TEST',
      accepts: [STAGING_SCHEMA, 'axm.workshop-package/v1', 'application/x-ndjson'],
      produces: [REQUEST_SCHEMA, RECEIPT_SCHEMA],
      sideEffects: ['copy-verified-package-into-explicit-packager-output', 'retain-staging-source', 'write-placement-receipt-to-staging-source', 'clean-owned-partial-output-on-handled-failure']
    },
    parseStagingReceipt: parseStagingReceipt,
    parseManifest: parseManifest,
    normalizeTarget: normalizeTarget,
    normalizeOutputBinding: normalizeOutputBinding,
    prepare: prepare,
    downloadName: downloadName
  };
});
