(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMEvidenceChainRecoverySnapshotStagingCore = api;
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';

  var INTEGRATION_SCHEMA = 'axm.evidence-chain-recovery-adapter-integration-acceptance-packet/v1';
  var REQUEST_SCHEMA = 'axm.evidence-chain-recovery-snapshot-staging-request/v1';
  var RECEIPT_SCHEMA = 'axm.evidence-chain-recovery-snapshot-staging-receipt/v1';
  var CAPABILITY = 'capability.stage.evidence-chain-recovery-snapshot/v1';
  var INTEGRATION_CAPABILITY = 'capability.plan.evidence-chain-recovery-adapter-integration/v1';
  var LIVE_CAPABILITY = 'capability.apply.evidence-chain-reviewed-recovery/v1';
  var PLACE_CAPABILITY = 'capability.place.evidence-chain-recovery-snapshot/v1';
  var SAFE_ROOT_PREFIX = 'axm-evidence-chain-recovery-stage-';
  var SNAPSHOT_PREFIX = 'axm-workshop-full-evidence-repair-';
  var HASH_PATTERN = /^[a-f0-9]{64}$/i;

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
    if (!drill || typeof drill.prepare !== 'function' || typeof drill.parsePlan !== 'function') throw new Error('Evidence Chain Application Drill dependency is unavailable');
    return drill;
  }

  function integrationDependency(override) {
    var integration = override || (root && root.AXMEvidenceChainRecoveryAdapterIntegrationCore);
    if (!integration && typeof require === 'function') integration = require('../evidence-chain-recovery-adapter-integration-foundry/evidence-chain-recovery-adapter-integration-core');
    if (!integration || typeof integration.parseReceipt !== 'function') throw new Error('Evidence Chain Recovery Adapter Integration dependency is unavailable');
    return integration;
  }

  function parseObject(value, label, limit) {
    var parsed = value;
    if (typeof value === 'string') {
      if (value.length > limit) throw new Error(label + ' exceeds its size limit');
      try { parsed = JSON.parse(value); }
      catch (error) { throw new Error(label + ' JSON is invalid: ' + error.message); }
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(label + ' must be a JSON object');
    return clone(parsed);
  }

  function parseDate(value, label) {
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error(label + ' must be a valid date');
    return date;
  }

  function byteLength(value) {
    var source = String(value == null ? '' : value);
    if (typeof Buffer !== 'undefined') return Buffer.byteLength(source, 'utf8');
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(source).length;
    return unescape(encodeURIComponent(source)).length;
  }

  function requireHash(value, label) { if (!HASH_PATTERN.test(String(value || ''))) throw new Error(label + ' must be SHA-256'); }

  function parseIntegrationPacket(value) {
    var parsed = parseObject(value, 'integration packet', 2 * 1024 * 1024);
    if (parsed.schema !== INTEGRATION_SCHEMA || parsed.capability !== INTEGRATION_CAPABILITY || parsed.status !== 'INTEGRATION_ACCEPTANCE_PACKET_READY_WITH_BLOCKERS') throw new Error('integration packet identity mismatch');
    ['packetId', 'planId', 'planSha256', 'conformanceRunId', 'conformanceProbeId', 'conformanceProfileSha256', 'sourceSha256', 'candidateSha256'].forEach(function (field) { requireHash(parsed[field], 'integration packet.' + field); });
    if (!parsed.adapterArtifact || !parsed.recoveryService || !parsed.integrationContract || !parsed.truth) throw new Error('integration packet structure is incomplete');
    requireHash(parsed.adapterArtifact.sha256, 'integration packet.adapterArtifact.sha256');
    requireHash(parsed.recoveryService.manifestSha256, 'integration packet.recoveryService.manifestSha256');
    requireHash(parsed.recoveryService.contractSha256, 'integration packet.recoveryService.contractSha256');
    if (parsed.adapterArtifact.dataOnly !== true || parsed.adapterArtifact.executed !== false || parsed.adapterArtifact.sourceIncluded !== false) throw new Error('integration packet artifact boundary mismatch');
    if (parsed.recoveryService.id !== 'recovery-center' || parsed.recoveryService.requiredPermission !== 'recovery.apply' || parsed.recoveryService.permissionCount !== 1 || parsed.recoveryService.declarationsAreRuntimeProof !== false) throw new Error('integration packet Recovery Center boundary mismatch');
    if (parsed.integrationContract.capabilityTarget !== LIVE_CAPABILITY || parsed.integrationContract.candidateTransport !== 'ADAPTER_IMPLEMENTATION_REQUIRED' || parsed.integrationContract.productionExecutionAvailable !== false) throw new Error('integration packet transport gap mismatch');
    if (!Array.isArray(parsed.acceptanceGates) || parsed.acceptanceGates.length !== 12 || !parsed.acceptanceGates.some(function (gate) { return gate.code === 'CANDIDATE_STAGING_ADAPTER_IMPLEMENTED' && gate.state === 'BLOCKED'; })) throw new Error('integration packet acceptance gates mismatch');
    if (!Array.isArray(parsed.blockers) || parsed.blockers.indexOf('CANDIDATE_TO_RECOVERY_REQUEST_ADAPTER_NOT_IMPLEMENTED') < 0 || parsed.blockers.indexOf('LIVE_APPLY_NOT_TESTED') < 0 || parsed.blockers.indexOf('LIVE_ROLLBACK_NOT_TESTED') < 0) throw new Error('integration packet blockers mismatch');
    var truth = parsed.truth;
    ['packetOnly', 'artifactDigestBound', 'planAndConformanceReceiptBound', 'RecoveryCenterDeclarationsInspected'].forEach(function (field) { if (truth[field] !== true) throw new Error('integration packet truth.' + field + ' must be true'); });
    ['artifactParsedAsCode', 'artifactExecuted', 'adapterImplemented', 'candidateStagingAvailable', 'productionAdapterLoaded', 'permissionRequested', 'permissionGranted', 'allowedIdentityVerified', 'deniedIdentityVerified', 'liveTargetRead', 'liveTargetWritten', 'RecoveryCenterCalled', 'candidateApplied', 'rollbackPerformed', 'liveApplyCapabilityClosed', 'installed', 'promoted', 'canon'].forEach(function (field) { if (truth[field] !== false) throw new Error('integration packet truth.' + field + ' must be false'); });
    parseDate(parsed.generatedAt, 'integration packet generatedAt');
    parseDate(parsed.expiresAt, 'integration packet expiresAt');
    return parsed;
  }

  function normalizeTarget(value) {
    var target = String(value || '').trim().replace(/\\/g, '/');
    if (!target || target.length > 240 || target[0] === '/' || /^[A-Za-z]:/.test(target) || target.indexOf('//') >= 0) throw new Error('target must be a bounded relative path');
    var parts = target.split('/');
    if (parts.some(function (part) { return !part || part === '.' || part === '..' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(part); })) throw new Error('target contains an unsafe path segment');
    if (parts.length < 4 || parts[0] !== 'state' || parts[1] !== 'evidence-retention' || !/\.jsonl$/i.test(parts[parts.length - 1])) throw new Error('target must be a JSONL file under state/evidence-retention');
    return parts.join('/');
  }

  async function prepare(source, candidate, plan, conformanceReceipt, integrationPacket, targetRelativePath, options, overrides) {
    var dependencies = overrides || {};
    var inspector = inspectorDependency(dependencies.inspector);
    var drill = drillDependency(dependencies.drill);
    var integration = integrationDependency(dependencies.integration);
    var settings = options || {};
    var packet = parseIntegrationPacket(integrationPacket);
    if (String(settings.confirmPacketId || '') !== packet.packetId) throw new Error('exact integration packet confirmation is required');
    if (settings.acknowledgePrivateTargetPath !== true) throw new Error('private target path acknowledgement is required');
    if (settings.acknowledgeRetainedStaging !== true) throw new Error('retained staging acknowledgement is required');
    if (settings.acknowledgeNoLivePlacement !== true) throw new Error('no-live-placement acknowledgement is required');
    if (settings.acknowledgeNoAuthority !== true) throw new Error('no-authority acknowledgement is required');
    var target = normalizeTarget(targetRelativePath);
    var parsedPlan = drill.parsePlan(plan);
    var receipt = integration.parseReceipt(conformanceReceipt);
    var drillRequest = await drill.prepare(source, candidate, parsedPlan, {
      confirmPlanId: parsedPlan.planId,
      acknowledgeSandboxOnly: true,
      acknowledgeEphemeralCleanup: true,
      now: settings.now
    }, inspector);
    var now = parseDate(settings.now || drillRequest.preparedAt, 'now');
    var packetGenerated = parseDate(packet.generatedAt, 'integration packet generatedAt');
    var packetExpires = parseDate(packet.expiresAt, 'integration packet expiresAt');
    if (now.getTime() < packetGenerated.getTime()) throw new Error('integration packet is not active yet');
    if (now.getTime() > packetExpires.getTime()) throw new Error('integration packet has expired');
    var planSha256 = await inspector.sha256(inspector.canonical(parsedPlan));
    var expectedRunId = await inspector.sha256(inspector.canonical({ probeId: receipt.probeId, profileSha256: receipt.profileSha256, scenarioCodes: receipt.scenarios.map(function (item) { return item.code; }) }));
    if (receipt.runId !== expectedRunId) throw new Error('conformance receipt runId does not recompute');
    var expectedPacketId = await inspector.sha256(inspector.canonical({
      capability: INTEGRATION_CAPABILITY,
      adapterArtifactSha256: packet.adapterArtifact.sha256,
      planId: packet.planId,
      conformanceRunId: packet.conformanceRunId,
      recoveryManifestSha256: packet.recoveryService.manifestSha256,
      recoveryContractSha256: packet.recoveryService.contractSha256,
      generatedAt: packet.generatedAt
    }));
    if (packet.packetId !== expectedPacketId) throw new Error('integration packet packetId does not recompute');
    if (packet.planId !== parsedPlan.planId || packet.planSha256 !== planSha256 || packet.conformanceRunId !== receipt.runId || packet.conformanceProbeId !== receipt.probeId || packet.sourceSha256 !== drillRequest.sourceSha256 || packet.candidateSha256 !== drillRequest.candidateSha256 || receipt.planId !== parsedPlan.planId || receipt.planSha256 !== planSha256) throw new Error('staging lineage digest mismatch');
    var targetPathSha256 = await inspector.sha256(target);
    var identity = { capability: CAPABILITY, packetId: packet.packetId, candidateSha256: drillRequest.candidateSha256, targetPathSha256: targetPathSha256, preparedAt: now.toISOString() };
    var requestId = await inspector.sha256(inspector.canonical(identity));
    return {
      schema: REQUEST_SCHEMA,
      capability: CAPABILITY,
      status: 'READY_FOR_EXPLICIT_RECOVERY_SNAPSHOT_STAGING',
      requestId: requestId,
      preparedAt: now.toISOString(),
      packetId: packet.packetId,
      planId: parsedPlan.planId,
      planSha256: planSha256,
      conformanceRunId: receipt.runId,
      sourceSha256: drillRequest.sourceSha256,
      candidateSha256: drillRequest.candidateSha256,
      candidateBytes: byteLength(candidate),
      candidateEvents: drillRequest.candidateEvents,
      target: {
        relativePath: target,
        sha256: targetPathSha256,
        scope: 'state/evidence-retention',
        pathIncluded: true
      },
      snapshotId: SNAPSHOT_PREFIX + requestId.slice(0, 16),
      stagingContract: {
        safeRootPrefix: SAFE_ROOT_PREFIX,
        rootMustNotExist: true,
        canonicalNonSymlinkParentRequired: true,
        packageManifestSchema: 'axm.workshop-package/v1',
        snapshotFolderPrefix: 'axm-workshop-full-',
        successRetainedForReview: true,
        failedPartialRootCleanupRequired: true,
        livePackagerPlacementAvailable: false
      },
      truth: {
        requestOnly: true,
        targetPathIncludedInPrivateRequest: true,
        candidatePayloadIncluded: false,
        filesystemIoPerformed: false,
        stagedRootCreated: false,
        WorkshopPackagerOutputWritten: false,
        snapshotPlacedLive: false,
        RecoveryCenterCalled: false,
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
        missingPlacementCapability: PLACE_CAPABILITY,
        missingLiveApplyCapability: LIVE_CAPABILITY
      }
    };
  }

  function downloadName() { return 'evidence-chain-recovery-snapshot-staging-request.json'; }

  return {
    REQUEST_SCHEMA: REQUEST_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    CAPABILITY: CAPABILITY,
    LIVE_CAPABILITY: LIVE_CAPABILITY,
    PLACE_CAPABILITY: PLACE_CAPABILITY,
    SAFE_ROOT_PREFIX: SAFE_ROOT_PREFIX,
    SNAPSHOT_PREFIX: SNAPSHOT_PREFIX,
    descriptor: {
      id: 'evidence-chain-recovery-snapshot-staging-foundry',
      capability: CAPABILITY,
      version: '1.0.0',
      status: 'TEST',
      accepts: ['application/x-ndjson', 'axm.evidence-chain-recovery-application-plan/v1', 'axm.evidence-chain-recovery-adapter-conformance-receipt/v1', INTEGRATION_SCHEMA],
      produces: [REQUEST_SCHEMA, RECEIPT_SCHEMA, 'axm.workshop-package/v1'],
      sideEffects: ['create-explicit-new-staging-root', 'retain-successful-staging-root', 'delete-partial-owned-root-on-failure']
    },
    parseIntegrationPacket: parseIntegrationPacket,
    normalizeTarget: normalizeTarget,
    prepare: prepare,
    downloadName: downloadName
  };
});
