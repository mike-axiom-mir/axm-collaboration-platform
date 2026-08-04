(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMEvidenceChainApplicationDrillCore = api;
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';

  var PLAN_SCHEMA = 'axm.evidence-chain-recovery-application-plan/v1';
  var PLAN_CAPABILITY = 'capability.plan.evidence-chain-recovery-application/v1';
  var REQUEST_SCHEMA = 'axm.evidence-chain-recovery-application-drill-request/v1';
  var RECEIPT_SCHEMA = 'axm.evidence-chain-recovery-application-drill/v1';
  var CAPABILITY = 'capability.drill.evidence-chain-recovery-application/v1';
  var SAFE_ROOT_PREFIX = 'axm-evidence-chain-drill-';
  var CORRECTABLE_ERRORS = ['PREVIOUS_HASH_MISMATCH', 'EVENT_HASH_MISMATCH', 'EVENT_HASH_FORMAT_INVALID'];
  var PHASE_CODES = [
    'REVERIFY_CURRENT_TARGET_DIGEST',
    'CREATE_IMMUTABLE_SAFETY_COPY',
    'STAGE_CANDIDATE_SEPARATELY',
    'REINSPECT_STAGED_CANDIDATE',
    'REQUEST_FRESH_PERMISSIONED_PREVIEW',
    'EXECUTE_THROUGH_TRUSTED_RECOVERY_SERVICE',
    'REINSPECT_APPLIED_RESULT',
    'RETAIN_ROLLBACK_LINEAGE'
  ];
  var HASH_PATTERN = /^[a-f0-9]{64}$/i;

  function inspectorDependency(override) {
    var inspector = override || (root && root.AXMEvidenceChainCore);
    if (!inspector && typeof require === 'function') inspector = require('../evidence-chain-inspector/evidence-chain-core');
    if (!inspector || typeof inspector.inspect !== 'function' || typeof inspector.sha256 !== 'function' || typeof inspector.canonical !== 'function') throw new Error('Evidence Chain Inspector dependency is unavailable');
    return inspector;
  }

  function planDependency(override) {
    var plan = override || (root && root.AXMEvidenceChainApplicationPlanCore);
    if (!plan && typeof require === 'function') plan = require('../evidence-chain-application-plan-foundry/evidence-chain-application-plan-core');
    if (!plan || typeof plan.example !== 'function' || typeof plan.build !== 'function') throw new Error('Evidence Chain Application Plan Foundry dependency is unavailable');
    return plan;
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function parseDate(value, label) {
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error(label + ' must be a valid date');
    return date;
  }

  function parsePlan(value) {
    var parsed = value;
    if (typeof value === 'string') {
      if (value.length > 2 * 1024 * 1024) throw new Error('application plan exceeds the 2 MiB limit');
      try { parsed = JSON.parse(value); }
      catch (error) { throw new Error('application plan JSON is invalid: ' + error.message); }
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('application plan must be a JSON object');
    parsed = clone(parsed);
    if (parsed.schema !== PLAN_SCHEMA || parsed.capability !== PLAN_CAPABILITY || parsed.status !== 'READY_FOR_TRUSTED_OPERATOR_PLANNING_REVIEW') throw new Error('application plan identity mismatch');
    if (!HASH_PATTERN.test(String(parsed.planId || ''))) throw new Error('application plan needs a valid planId');
    if (!parsed.target || !parsed.candidate || !parsed.review || !parsed.handoff || !parsed.truth) throw new Error('application plan structure is incomplete');
    ['expectedCurrentSourceSha256'].forEach(function (field) { if (!HASH_PATTERN.test(String(parsed.target[field] || ''))) throw new Error('application plan target.' + field + ' must be SHA-256'); });
    ['sha256'].forEach(function (field) { if (!HASH_PATTERN.test(String(parsed.candidate[field] || ''))) throw new Error('application plan candidate.' + field + ' must be SHA-256'); });
    ['assessmentSha256', 'decisionSha256'].forEach(function (field) { if (!HASH_PATTERN.test(String(parsed.review[field] || ''))) throw new Error('application plan review.' + field + ' must be SHA-256'); });
    if (!Array.isArray(parsed.phases) || parsed.phases.length !== PHASE_CODES.length || parsed.phases.some(function (phase, index) { return !phase || phase.order !== index + 1 || phase.code !== PHASE_CODES[index]; })) throw new Error('application plan phase contract mismatch');
    if (parsed.handoff.targetServiceCompatibility !== 'ADAPTER_REQUIRED' || parsed.handoff.missingCapability !== 'capability.apply.evidence-chain-reviewed-recovery/v1' || parsed.handoff.directExecutionAvailable !== false) throw new Error('application plan must preserve the live-apply adapter gap');
    var truth = parsed.truth;
    if (truth.planOnly !== true || truth.nonExecutable !== true || truth.reviewBundleDigestBound !== true) throw new Error('application plan positive truth boundary mismatch');
    ['liveTargetRead', 'targetPathEmitted', 'commandsEmitted', 'filesWritten', 'backupCreated', 'candidateStaged', 'previewCreated', 'permissionChecked', 'permissionGranted', 'readyToApply', 'applicationAuthorized', 'candidateApplied', 'rollbackPerformed', 'humanIdentityVerified', 'reviewDecisionAuthenticityProven', 'contentAuthenticityProven', 'sourceHistoryRestored', 'sessionRecovered', 'serverStarted', 'authorityGranted', 'promoted', 'canon'].forEach(function (field) {
      if (truth[field] !== false) throw new Error('application plan truth.' + field + ' must be false');
    });
    return parsed;
  }

  function parsedRows(source) {
    var rows = [];
    try {
      String(source).split(/\r?\n/).forEach(function (line) {
        if (line === '') return;
        var item = JSON.parse(line);
        if (!item || Array.isArray(item) || typeof item !== 'object') throw new Error('event is not an object');
        rows.push(item);
      });
      return { ok: true, rows: rows };
    } catch (error) { return { ok: false, rows: [] }; }
  }

  function nonHash(item) {
    var value = clone(item);
    delete value.previousHash;
    delete value.eventHash;
    return value;
  }

  function add(checks, code, pass) { checks.push({ code: code, verdict: pass ? 'PASS' : 'FAIL' }); }

  async function prepare(source, candidate, plan, options, inspectorOverride) {
    var inspector = inspectorDependency(inspectorOverride);
    var settings = options || {};
    var parsedPlan = parsePlan(plan);
    if (String(settings.confirmPlanId || '') !== parsedPlan.planId) throw new Error('exact planId confirmation is required');
    if (settings.acknowledgeSandboxOnly !== true) throw new Error('sandbox-only acknowledgement is required');
    if (settings.acknowledgeEphemeralCleanup !== true) throw new Error('ephemeral cleanup acknowledgement is required');
    var now = parseDate(settings.now || new Date().toISOString(), 'now');
    var generated = parseDate(parsedPlan.generatedAt, 'application plan generatedAt');
    var expires = parseDate(parsedPlan.expiresAt, 'application plan expiresAt');
    if (now.getTime() < generated.getTime()) throw new Error('application plan is not active yet');
    if (now.getTime() > expires.getTime()) throw new Error('application plan has expired');

    var identityMaterial = {
      capability: PLAN_CAPABILITY,
      sourceSha256: parsedPlan.target.expectedCurrentSourceSha256,
      candidateSha256: parsedPlan.candidate.sha256,
      assessmentSha256: parsedPlan.review.assessmentSha256,
      decisionSha256: parsedPlan.review.decisionSha256,
      posture: parsedPlan.target.posture,
      generatedAt: parsedPlan.generatedAt
    };
    var expectedPlanId = await inspector.sha256(inspector.canonical(identityMaterial));
    var planDigest = await inspector.sha256(inspector.canonical(parsedPlan));
    var sourceInput = String(source == null ? '' : source);
    var candidateInput = String(candidate == null ? '' : candidate);
    var sourceInspection = await inspector.inspect(sourceInput, { label: 'application-drill-source' });
    var candidateInspection = await inspector.inspect(candidateInput, { label: 'application-drill-candidate' });
    var sourceRows = parsedRows(sourceInput);
    var candidateRows = parsedRows(candidateInput);
    var sourceSemantic = sourceRows.ok ? await inspector.sha256(inspector.canonical(sourceRows.rows.map(nonHash))) : null;
    var candidateSemantic = candidateRows.ok ? await inspector.sha256(inspector.canonical(candidateRows.rows.map(nonHash))) : null;
    var sourceErrors = sourceInspection.findings.filter(function (finding) { return finding.severity === 'ERROR'; });
    var sourceWarnings = sourceInspection.findings.filter(function (finding) { return finding.severity === 'WARNING'; });
    var checks = [];
    add(checks, 'PLAN_ID_RECOMPUTES', expectedPlanId === parsedPlan.planId);
    add(checks, 'SOURCE_DIGEST_MATCHES_PLAN', sourceInspection.source.sha256 === parsedPlan.target.expectedCurrentSourceSha256);
    add(checks, 'SOURCE_REMAINS_ELIGIBLE_HASH_BREAK', sourceInspection.verdict === 'FAIL' && sourceInspection.chainState === 'BROKEN' && sourceErrors.length > 0 && sourceErrors.every(function (finding) { return CORRECTABLE_ERRORS.indexOf(finding.code) >= 0; }) && sourceWarnings.length === 0);
    add(checks, 'CANDIDATE_DIGEST_MATCHES_PLAN', candidateInspection.source.sha256 === parsedPlan.candidate.sha256);
    add(checks, 'CANDIDATE_CHAIN_VALID', candidateInspection.verdict === 'PASS' && candidateInspection.chainState === 'VALID' && candidateInspection.summary.warnings === 0);
    add(checks, 'NON_HASH_FIELDS_PRESERVED', sourceSemantic !== null && sourceSemantic === candidateSemantic);
    var failed = checks.filter(function (check) { return check.verdict === 'FAIL'; }).map(function (check) { return check.code; });
    if (failed.length) throw new Error('application drill refused: ' + failed.join(', '));
    return {
      schema: REQUEST_SCHEMA,
      capability: CAPABILITY,
      status: 'READY_FOR_OWNED_SANDBOX_DRILL',
      preparedAt: now.toISOString(),
      planId: parsedPlan.planId,
      planSha256: planDigest,
      sourceSha256: sourceInspection.source.sha256,
      candidateSha256: candidateInspection.source.sha256,
      candidateEvents: candidateInspection.summary.parsedEvents,
      checks: checks,
      sandboxContract: {
        rootMustNotExist: true,
        safeNamePrefix: SAFE_ROOT_PREFIX,
        canonicalNonSymlinkParentRequired: true,
        fixedInternalNamesOnly: true,
        automaticExactRootCleanupRequired: true
      },
      drillCoverage: {
        actualFilesystemPhases: [1, 2, 3, 4, 6, 7, 8],
        excludedPlanPhase: 5,
        excludedReason: 'NO_PERMISSION_OR_TRUSTED_SERVICE_CALL_IN_SANDBOX_DRILL'
      },
      truth: {
        requestOnly: true,
        filesystemIoPerformed: false,
        liveStateRead: false,
        liveStateWritten: false,
        permissionChecked: false,
        permissionGranted: false,
        trustedRecoveryServiceCalled: false,
        liveApplyCapabilityClosed: false,
        candidateAppliedLive: false,
        filesRetained: false,
        authorityGranted: false,
        promoted: false,
        canon: false
      }
    };
  }

  async function example(options, overrides) {
    var settings = options || {};
    var dependencies = overrides || {};
    var planCore = planDependency(dependencies.plan);
    var inspector = inspectorDependency(dependencies.inspector);
    var generatedAt = settings.generatedAt || new Date().toISOString();
    var packet = await planCore.example({
      recoveryGeneratedAt: generatedAt,
      assessmentGeneratedAt: generatedAt,
      decisionGeneratedAt: generatedAt
    }, dependencies.planDependencies);
    var plan = await planCore.build(packet.source, packet.candidate, packet.assessment, packet.decision, {
      posture: 'ISOLATED_REPLACEMENT_COPY',
      acknowledgeCurrentDigestRecheck: true,
      acknowledgeSafetyCopyRequired: true,
      acknowledgeFreshPermissionRequired: true,
      acknowledgeNoAuthority: true,
      generatedAt: generatedAt
    }, inspector);
    return { source: packet.source, candidate: packet.candidate, plan: plan };
  }

  function downloadName() { return 'evidence-chain-application-drill-request.json'; }

  return {
    REQUEST_SCHEMA: REQUEST_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    CAPABILITY: CAPABILITY,
    SAFE_ROOT_PREFIX: SAFE_ROOT_PREFIX,
    PHASE_CODES: clone(PHASE_CODES),
    descriptor: {
      id: 'evidence-chain-application-drill-runner',
      capability: CAPABILITY,
      version: '1.0.0',
      status: 'TEST',
      accepts: ['application/x-ndjson', PLAN_SCHEMA],
      produces: [REQUEST_SCHEMA, RECEIPT_SCHEMA],
      sideEffects: ['create-exact-new-owned-sandbox', 'write-fixed-drill-fixtures', 'delete-exact-owned-sandbox']
    },
    parsePlan: parsePlan,
    prepare: prepare,
    example: example,
    downloadName: downloadName
  };
});
