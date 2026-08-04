(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMEvidenceChainRecoveryAdapterConformanceCore = api;
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';

  var PROFILE_SCHEMA = 'axm.evidence-chain-recovery-adapter-fixture-profile/v1';
  var PROBE_SCHEMA = 'axm.evidence-chain-recovery-adapter-conformance-probe/v1';
  var RECEIPT_SCHEMA = 'axm.evidence-chain-recovery-adapter-conformance-receipt/v1';
  var CAPABILITY = 'capability.verify.evidence-chain-recovery-adapter/v1';
  var LIVE_CAPABILITY = 'capability.apply.evidence-chain-reviewed-recovery/v1';
  var REQUIRED_METHODS = ['openFixture', 'preview', 'apply', 'inspect', 'injectTestFault', 'previewRollback', 'rollback', 'audit', 'close'];
  var REQUIRED_SCENARIOS = [
    'FIXTURE_PERMISSION_DENIAL',
    'EXACT_APPLY_CONFIRMATION',
    'STALE_PREVIEW_REFUSAL',
    'CANDIDATE_DIGEST_MISMATCH_REFUSAL',
    'CURRENT_STATE_DRIFT_REFUSAL',
    'APPLY_INSPECT_ROLLBACK',
    'DIGEST_ONLY_RECEIPT_PRIVACY'
  ];
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
    if (!drill || typeof drill.prepare !== 'function' || typeof drill.example !== 'function') throw new Error('Evidence Chain Application Drill dependency is unavailable');
    return drill;
  }

  function referenceProfile() {
    return {
      schema: PROFILE_SCHEMA,
      id: 'reference-evidence-chain-recovery-fixture-adapter',
      version: '1.0.0',
      status: 'TEST_FIXTURE',
      capabilityUnderTest: LIVE_CAPABILITY,
      fixtureOnly: true,
      liveTargetAccess: false,
      filesystemAccess: false,
      networkAccess: false,
      persistentWrites: false,
      permissionsExercised: false,
      authoritySource: 'synthetic-fixture-flag',
      permissionRequired: 'recovery.apply',
      previewTtlSeconds: 60,
      exactApplyConfirmation: 'APPLY REVIEWED EVIDENCE REPAIR',
      exactRollbackConfirmation: 'ROLL BACK REVIEWED EVIDENCE REPAIR',
      methods: clone(REQUIRED_METHODS)
    };
  }

  function parseProfile(value) {
    var parsed = value;
    if (typeof value === 'string') {
      if (value.length > 128 * 1024) throw new Error('adapter fixture profile exceeds the 128 KiB limit');
      try { parsed = JSON.parse(value); }
      catch (error) { throw new Error('adapter fixture profile JSON is invalid: ' + error.message); }
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('adapter fixture profile must be a JSON object');
    parsed = clone(parsed);
    if (parsed.schema !== PROFILE_SCHEMA || parsed.status !== 'TEST_FIXTURE' || parsed.capabilityUnderTest !== LIVE_CAPABILITY) throw new Error('adapter fixture profile identity mismatch');
    if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(String(parsed.id || '')) || !/^\d+\.\d+\.\d+$/.test(String(parsed.version || ''))) throw new Error('adapter fixture profile id or version is invalid');
    if (parsed.fixtureOnly !== true || parsed.liveTargetAccess !== false || parsed.filesystemAccess !== false || parsed.networkAccess !== false || parsed.persistentWrites !== false || parsed.permissionsExercised !== false) throw new Error('adapter fixture profile must preserve the zero-authority fixture boundary');
    if (parsed.authoritySource !== 'synthetic-fixture-flag' || parsed.permissionRequired !== 'recovery.apply') throw new Error('adapter fixture permission contract mismatch');
    if (!Number.isInteger(parsed.previewTtlSeconds) || parsed.previewTtlSeconds < 10 || parsed.previewTtlSeconds > 900) throw new Error('adapter fixture preview TTL must be between 10 and 900 seconds');
    if (parsed.exactApplyConfirmation !== 'APPLY REVIEWED EVIDENCE REPAIR' || parsed.exactRollbackConfirmation !== 'ROLL BACK REVIEWED EVIDENCE REPAIR') throw new Error('adapter fixture exact confirmation contract mismatch');
    if (!Array.isArray(parsed.methods) || parsed.methods.length !== REQUIRED_METHODS.length || parsed.methods.some(function (name, index) { return name !== REQUIRED_METHODS[index]; })) throw new Error('adapter fixture method contract mismatch');
    return parsed;
  }

  async function prepare(source, candidate, plan, profile, options, overrides) {
    var dependencies = overrides || {};
    var inspector = inspectorDependency(dependencies.inspector);
    var drill = drillDependency(dependencies.drill);
    var settings = options || {};
    var parsedProfile = parseProfile(profile);
    if (settings.acknowledgeFixtureOnly !== true) throw new Error('fixture-only acknowledgement is required');
    if (settings.acknowledgeNoAuthority !== true) throw new Error('no-authority acknowledgement is required');
    var drillRequest = await drill.prepare(source, candidate, plan, {
      confirmPlanId: settings.confirmPlanId,
      acknowledgeSandboxOnly: true,
      acknowledgeEphemeralCleanup: true,
      now: settings.now
    }, inspector);
    if (!drillRequest.truth || drillRequest.truth.filesystemIoPerformed !== false || drillRequest.truth.liveStateRead !== false || drillRequest.truth.liveStateWritten !== false) throw new Error('bundle validator crossed its read-only boundary');
    var profileSha256 = await inspector.sha256(inspector.canonical(parsedProfile));
    var preparedAt = drillRequest.preparedAt;
    var identity = {
      capability: CAPABILITY,
      planId: drillRequest.planId,
      planSha256: drillRequest.planSha256,
      sourceSha256: drillRequest.sourceSha256,
      candidateSha256: drillRequest.candidateSha256,
      profileSha256: profileSha256,
      preparedAt: preparedAt
    };
    var probeId = await inspector.sha256(inspector.canonical(identity));
    return {
      schema: PROBE_SCHEMA,
      capability: CAPABILITY,
      status: 'READY_FOR_FIXTURE_ADAPTER_CONFORMANCE',
      probeId: probeId,
      preparedAt: preparedAt,
      planId: drillRequest.planId,
      planSha256: drillRequest.planSha256,
      sourceSha256: drillRequest.sourceSha256,
      candidateSha256: drillRequest.candidateSha256,
      candidateEvents: drillRequest.candidateEvents,
      profileId: parsedProfile.id,
      profileVersion: parsedProfile.version,
      profileSha256: profileSha256,
      previewTtlSeconds: parsedProfile.previewTtlSeconds,
      requiredScenarios: clone(REQUIRED_SCENARIOS),
      confirmations: {
        apply: parsedProfile.exactApplyConfirmation,
        rollback: parsedProfile.exactRollbackConfirmation
      },
      truth: {
        probeOnly: true,
        fixtureAdapterLoaded: false,
        fixtureAdapterExecuted: false,
        filesystemIoPerformed: false,
        networkCalled: false,
        RecoveryCenterCalled: false,
        permissionRequested: false,
        permissionGranted: false,
        realIdentityVerified: false,
        liveTargetRead: false,
        liveTargetWritten: false,
        liveApplyCapabilityClosed: false,
        authorityGranted: false,
        promoted: false,
        canon: false
      },
      limits: {
        missingCapability: LIVE_CAPABILITY,
        liveAuthorizationEvidenceRequired: true,
        productionAdapterEvidenceRequired: true
      }
    };
  }

  async function example(options, overrides) {
    var settings = options || {};
    var dependencies = overrides || {};
    var drill = drillDependency(dependencies.drill);
    var packet = await drill.example({ generatedAt: settings.generatedAt }, dependencies.drillDependencies);
    return { source: packet.source, candidate: packet.candidate, plan: packet.plan, profile: referenceProfile() };
  }

  function downloadName() { return 'evidence-chain-recovery-adapter-conformance-probe.json'; }

  return {
    PROFILE_SCHEMA: PROFILE_SCHEMA,
    PROBE_SCHEMA: PROBE_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    CAPABILITY: CAPABILITY,
    LIVE_CAPABILITY: LIVE_CAPABILITY,
    REQUIRED_METHODS: clone(REQUIRED_METHODS),
    REQUIRED_SCENARIOS: clone(REQUIRED_SCENARIOS),
    HASH_PATTERN: HASH_PATTERN,
    descriptor: {
      id: 'evidence-chain-recovery-adapter-conformance-lab',
      capability: CAPABILITY,
      version: '1.0.0',
      status: 'TEST',
      accepts: ['application/x-ndjson', 'axm.evidence-chain-recovery-application-plan/v1', PROFILE_SCHEMA],
      produces: [PROBE_SCHEMA, RECEIPT_SCHEMA],
      sideEffects: []
    },
    referenceProfile: referenceProfile,
    parseProfile: parseProfile,
    prepare: prepare,
    example: example,
    downloadName: downloadName
  };
});
