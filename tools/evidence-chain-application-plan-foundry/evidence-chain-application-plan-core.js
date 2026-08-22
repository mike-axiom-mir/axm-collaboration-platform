(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMEvidenceChainApplicationPlanCore = api;
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';

  var REVIEW_SCHEMA = 'axm.evidence-chain-recovery-review/v1';
  var DECISION_SCHEMA = 'axm.evidence-chain-recovery-review-decision/v1';
  var PLAN_SCHEMA = 'axm.evidence-chain-recovery-application-plan/v1';
  var REVIEW_CAPABILITY = 'capability.review.evidence-chain-recovery-candidate/v1';
  var CAPABILITY = 'capability.plan.evidence-chain-recovery-application/v1';
  var ACCEPT_DECISION = 'ACCEPT_STRUCTURE_FOR_SEPARATE_APPLICATION_REVIEW';
  var POSTURES = ['ISOLATED_REPLACEMENT_COPY', 'TRUSTED_RECOVERY_SERVICE_STAGING', 'MANUAL_OPERATOR_HANDOFF'];
  var CORRECTABLE_ERRORS = ['PREVIOUS_HASH_MISMATCH', 'EVENT_HASH_MISMATCH', 'EVENT_HASH_FORMAT_INVALID'];
  var HASH_PATTERN = /^[a-f0-9]{64}$/i;
  var VALID_FOR_SECONDS = 900;

  function inspectorDependency(override) {
    var inspector = override || (root && root.AXMEvidenceChainCore);
    if (!inspector && typeof require === 'function') inspector = require('../evidence-chain-inspector/evidence-chain-core');
    if (!inspector || typeof inspector.inspect !== 'function' || typeof inspector.sha256 !== 'function' || typeof inspector.canonical !== 'function') {
      throw new Error('Evidence Chain Inspector dependency is unavailable');
    }
    return inspector;
  }

  function reviewDependency(override) {
    var review = override || (root && root.AXMEvidenceChainReviewCore);
    if (!review && typeof require === 'function') review = require('../evidence-chain-candidate-review-gate/evidence-chain-review-core');
    if (!review || typeof review.example !== 'function' || typeof review.assess !== 'function' || typeof review.decide !== 'function') {
      throw new Error('Evidence Chain Candidate Review Gate dependency is unavailable');
    }
    return review;
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function validDate(value) {
    var date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) throw new Error('generatedAt must be a valid date');
    return date;
  }

  function parseObject(value, label) {
    var parsed = value;
    if (typeof value === 'string') {
      if (value.length > 2 * 1024 * 1024) throw new Error(label + ' exceeds the 2 MiB limit');
      try { parsed = JSON.parse(value); }
      catch (error) { throw new Error(label + ' JSON is invalid: ' + error.message); }
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(label + ' must be a JSON object');
    return clone(parsed);
  }

  function requireFalse(truth, fields, label) {
    fields.forEach(function (field) {
      if (truth[field] !== false) throw new Error(label + '.' + field + ' must be false');
    });
  }

  function parseAssessment(value) {
    var parsed = parseObject(value, 'review assessment');
    if (parsed.schema !== REVIEW_SCHEMA || parsed.capability !== REVIEW_CAPABILITY || parsed.status !== 'REVIEW_GATE_ASSESSMENT') throw new Error('review assessment identity mismatch');
    if (parsed.verdict !== 'PASS' || parsed.recommendation !== 'ELIGIBLE_FOR_EXPLICIT_REVIEW_DECISION') throw new Error('review assessment must be a PASS eligible for decision');
    if (!parsed.source || !parsed.candidate || !HASH_PATTERN.test(String(parsed.source.sha256 || '')) || !HASH_PATTERN.test(String(parsed.candidate.sha256 || ''))) throw new Error('review assessment digests are incomplete');
    if (!Array.isArray(parsed.checks) || !parsed.checks.length || parsed.checks.some(function (check) { return check.verdict !== 'PASS'; })) throw new Error('review assessment checks must all pass');
    if (!Array.isArray(parsed.failedChecks) || parsed.failedChecks.length) throw new Error('review assessment cannot contain failed checks');
    var truth = parsed.truth || {};
    if (truth.fourArtifactsDigestBound !== true || truth.candidateChainValid !== true || truth.nonHashFieldsPreserved !== true) throw new Error('review assessment positive truth boundary mismatch');
    requireFalse(truth, ['payloadsEmitted', 'sourcesEmitted', 'rawLinesEmitted', 'filesWritten', 'originalModified', 'candidateModified', 'candidateApplied', 'liveStateWritten', 'contentAuthenticityProven', 'sourceHistoryRestored', 'sessionRecovered', 'serverStarted', 'authorityGranted', 'promoted', 'canon'], 'review assessment truth');
    return parsed;
  }

  function parseDecision(value) {
    var parsed = parseObject(value, 'review decision');
    if (parsed.schema !== DECISION_SCHEMA || parsed.capability !== REVIEW_CAPABILITY || parsed.status !== 'REVIEW_DECISION_RECORDED') throw new Error('review decision identity mismatch');
    if (!HASH_PATTERN.test(String(parsed.assessmentSha256 || '')) || !HASH_PATTERN.test(String(parsed.sourceSha256 || '')) || !HASH_PATTERN.test(String(parsed.candidateSha256 || ''))) throw new Error('review decision digests are incomplete');
    if (parsed.assessmentVerdict !== 'PASS' || parsed.decision !== ACCEPT_DECISION || parsed.reasonCode !== 'STRUCTURE_VERIFIED_AUTHENTICITY_UNKNOWN') throw new Error('review decision must be the fixed structural acceptance choice');
    if (!parsed.acknowledgement || parsed.acknowledgement.noApplicationAuthorityAccepted !== true || parsed.acknowledgement.authenticityUnknownAccepted !== true) throw new Error('review decision acknowledgements are incomplete');
    var truth = parsed.truth || {};
    if (truth.assessmentContentBound !== true || truth.structuralAcceptanceOnly !== true) throw new Error('review decision positive truth boundary mismatch');
    requireFalse(truth, ['humanIdentityVerified', 'approvedForApplication', 'applicationAuthorityGranted', 'contentAuthenticityProven', 'sourceHistoryRestored', 'originalModified', 'candidateModified', 'candidateApplied', 'liveStateWritten', 'sessionRecovered', 'serverStarted', 'authorityGranted', 'promoted', 'canon'], 'review decision truth');
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
    } catch (error) {
      return { ok: false, rows: [] };
    }
  }

  function nonHashEvent(item) {
    var value = clone(item);
    delete value.previousHash;
    delete value.eventHash;
    return value;
  }

  function phases() {
    return [
      { order: 1, code: 'REVERIFY_CURRENT_TARGET_DIGEST', evidenceRequired: 'fresh-target-sha256-equals-expected-source-sha256', stopIf: 'target-missing-or-digest-drift' },
      { order: 2, code: 'CREATE_IMMUTABLE_SAFETY_COPY', evidenceRequired: 'backup-receipt-bound-to-current-target-digest', stopIf: 'backup-not-created-or-not-verifiable' },
      { order: 3, code: 'STAGE_CANDIDATE_SEPARATELY', evidenceRequired: 'staging-receipt-bound-to-candidate-sha256', stopIf: 'staging-path-not-isolated-or-bytes-drift' },
      { order: 4, code: 'REINSPECT_STAGED_CANDIDATE', evidenceRequired: 'fresh-evidence-chain-inspection-pass', stopIf: 'chain-invalid-or-warning-present' },
      { order: 5, code: 'REQUEST_FRESH_PERMISSIONED_PREVIEW', evidenceRequired: 'current-state-bound-preview-and-recovery.apply-permission', stopIf: 'preview-stale-permission-denied-or-current-state-drift' },
      { order: 6, code: 'EXECUTE_THROUGH_TRUSTED_RECOVERY_SERVICE', evidenceRequired: 'trusted-service-application-receipt', stopIf: 'service-refuses-or-receipt-missing' },
      { order: 7, code: 'REINSPECT_APPLIED_RESULT', evidenceRequired: 'post-application-chain-pass-and-target-digest', stopIf: 'post-application-verification-fails' },
      { order: 8, code: 'RETAIN_ROLLBACK_LINEAGE', evidenceRequired: 'safety-copy-and-application-receipts-linked', stopIf: 'rollback-lineage-incomplete' }
    ];
  }

  function failCodes(checks) {
    return checks.filter(function (check) { return check.verdict === 'FAIL'; }).map(function (check) { return check.code; });
  }

  function add(checks, code, pass) { checks.push({ code: code, verdict: pass ? 'PASS' : 'FAIL' }); }

  async function build(source, candidate, assessment, decision, options, inspectorOverride) {
    var inspector = inspectorDependency(inspectorOverride);
    var settings = options || {};
    var posture = String(settings.posture || '');
    if (POSTURES.indexOf(posture) < 0) throw new Error('posture must be one of the fixed application planning choices');
    if (settings.acknowledgeCurrentDigestRecheck !== true) throw new Error('current target digest recheck acknowledgement is required');
    if (settings.acknowledgeSafetyCopyRequired !== true) throw new Error('immutable safety copy acknowledgement is required');
    if (settings.acknowledgeFreshPermissionRequired !== true) throw new Error('fresh permissioned preview acknowledgement is required');
    if (settings.acknowledgeNoAuthority !== true) throw new Error('no application authority acknowledgement is required');

    var parsedAssessment = parseAssessment(assessment);
    var parsedDecision = parseDecision(decision);
    var sourceInput = String(source == null ? '' : source);
    var candidateInput = String(candidate == null ? '' : candidate);
    var sourceSnapshot = sourceInput;
    var candidateSnapshot = candidateInput;
    var sourceInspection = await inspector.inspect(sourceInput, { label: 'application-plan-source' });
    var candidateInspection = await inspector.inspect(candidateInput, { label: 'application-plan-candidate' });
    var assessmentDigest = await inspector.sha256(inspector.canonical(parsedAssessment));
    var decisionDigest = await inspector.sha256(inspector.canonical(parsedDecision));
    var sourceParsed = parsedRows(sourceInput);
    var candidateParsed = parsedRows(candidateInput);
    var sourceSemantic = sourceParsed.ok ? await inspector.sha256(inspector.canonical(sourceParsed.rows.map(nonHashEvent))) : null;
    var candidateSemantic = candidateParsed.ok ? await inspector.sha256(inspector.canonical(candidateParsed.rows.map(nonHashEvent))) : null;
    var sourceErrors = sourceInspection.findings.filter(function (finding) { return finding.severity === 'ERROR'; });
    var sourceWarnings = sourceInspection.findings.filter(function (finding) { return finding.severity === 'WARNING'; });
    var sourceEligible = sourceInspection.verdict === 'FAIL' && sourceInspection.chainState === 'BROKEN' && sourceErrors.length > 0 && sourceErrors.every(function (finding) { return CORRECTABLE_ERRORS.indexOf(finding.code) >= 0; }) && sourceWarnings.length === 0;
    var checks = [];
    add(checks, 'SOURCE_DIGEST_MATCHES_REVIEW', parsedAssessment.source.sha256 === sourceInspection.source.sha256 && Number(parsedAssessment.source.bytes) === sourceInspection.source.bytes && Number(parsedAssessment.source.events) === sourceInspection.summary.parsedEvents);
    add(checks, 'SOURCE_REMAINS_ELIGIBLE_HASH_BREAK', sourceEligible);
    add(checks, 'CANDIDATE_DIGEST_MATCHES_REVIEW', parsedAssessment.candidate.sha256 === candidateInspection.source.sha256 && Number(parsedAssessment.candidate.bytes) === candidateInspection.source.bytes && Number(parsedAssessment.candidate.events) === candidateInspection.summary.parsedEvents);
    add(checks, 'CANDIDATE_CHAIN_VALID', candidateInspection.verdict === 'PASS' && candidateInspection.chainState === 'VALID' && candidateInspection.summary.warnings === 0);
    add(checks, 'NON_HASH_FIELDS_PRESERVED', sourceSemantic !== null && sourceSemantic === candidateSemantic && parsedAssessment.source.nonHashSemanticSha256 === sourceSemantic && parsedAssessment.candidate.nonHashSemanticSha256 === candidateSemantic);
    add(checks, 'DECISION_BINDS_ASSESSMENT', parsedDecision.assessmentSha256 === assessmentDigest && parsedDecision.sourceSha256 === parsedAssessment.source.sha256 && parsedDecision.candidateSha256 === parsedAssessment.candidate.sha256);
    add(checks, 'INPUTS_UNCHANGED_IN_MEMORY', sourceInput === sourceSnapshot && candidateInput === candidateSnapshot);
    var failed = failCodes(checks);
    if (failed.length) throw new Error('application plan refused: ' + failed.join(', '));

    var generated = validDate(settings.generatedAt);
    var expires = new Date(generated.getTime() + VALID_FOR_SECONDS * 1000);
    var identityMaterial = {
      capability: CAPABILITY,
      sourceSha256: sourceInspection.source.sha256,
      candidateSha256: candidateInspection.source.sha256,
      assessmentSha256: assessmentDigest,
      decisionSha256: decisionDigest,
      posture: posture,
      generatedAt: generated.toISOString()
    };
    var planId = await inspector.sha256(inspector.canonical(identityMaterial));
    return {
      schema: PLAN_SCHEMA,
      capability: CAPABILITY,
      status: 'READY_FOR_TRUSTED_OPERATOR_PLANNING_REVIEW',
      planId: planId,
      generatedAt: generated.toISOString(),
      expiresAt: expires.toISOString(),
      validForSeconds: VALID_FOR_SECONDS,
      target: {
        posture: posture,
        expectedCurrentSourceSha256: sourceInspection.source.sha256,
        pathIncluded: false,
        liveTargetObserved: false
      },
      candidate: {
        sha256: candidateInspection.source.sha256,
        events: candidateInspection.summary.parsedEvents,
        chainVerdict: candidateInspection.verdict
      },
      review: {
        assessmentSha256: assessmentDigest,
        decisionSha256: decisionDigest,
        decision: parsedDecision.decision,
        humanIdentityVerified: false
      },
      preconditions: checks,
      phases: phases(),
      rollback: {
        required: true,
        restoreDigest: sourceInspection.source.sha256,
        safetyCopyReceiptRequired: true,
        applicationReceiptRequired: true,
        trustedServiceRequired: true
      },
      handoff: {
        intendedService: 'recovery-center',
        requiredPermission: 'recovery.apply',
        targetServiceCompatibility: 'ADAPTER_REQUIRED',
        missingCapability: 'capability.apply.evidence-chain-reviewed-recovery/v1',
        directExecutionAvailable: false
      },
      acknowledgement: {
        currentDigestRecheckRequired: true,
        immutableSafetyCopyRequired: true,
        freshPermissionedPreviewRequired: true,
        noApplicationAuthorityAccepted: true
      },
      limitations: [
        'LIVE_TARGET_NOT_READ',
        'NO_PATH_OR_COMMAND_INCLUDED',
        'HUMAN_IDENTITY_NOT_VERIFIED',
        'RECOVERY_CENTER_ADAPTER_NOT_IMPLEMENTED',
        'CONTENT_AUTHENTICITY_NOT_PROVEN',
        'SOURCE_HISTORY_NOT_RESTORED'
      ],
      truth: {
        planOnly: true,
        nonExecutable: true,
        reviewBundleDigestBound: true,
        sourceInputInspected: true,
        candidateInputInspected: true,
        liveTargetRead: false,
        targetPathEmitted: false,
        commandsEmitted: false,
        filesWritten: false,
        backupCreated: false,
        candidateStaged: false,
        previewCreated: false,
        permissionChecked: false,
        permissionGranted: false,
        readyToApply: false,
        applicationAuthorized: false,
        candidateApplied: false,
        rollbackPerformed: false,
        humanIdentityVerified: false,
        reviewDecisionAuthenticityProven: false,
        contentAuthenticityProven: false,
        sourceHistoryRestored: false,
        sessionRecovered: false,
        serverStarted: false,
        authorityGranted: false,
        promoted: false,
        canon: false
      }
    };
  }

  async function example(options, overrides) {
    var settings = options || {};
    var dependencies = overrides || {};
    var review = reviewDependency(dependencies.review);
    var inspector = inspectorDependency(dependencies.inspector);
    var packet = await review.example({ recoveryGeneratedAt: settings.recoveryGeneratedAt }, dependencies.reviewDependencies);
    var assessment = await review.assess(packet.source, packet.inspection, packet.candidate, packet.recovery, { generatedAt: settings.assessmentGeneratedAt }, inspector);
    var decision = await review.decide(assessment, ACCEPT_DECISION, {
      acknowledgeNoAuthority: true,
      acknowledgeAuthenticityUnknown: true,
      generatedAt: settings.decisionGeneratedAt
    }, inspector);
    return { source: packet.source, candidate: packet.candidate, assessment: assessment, decision: decision };
  }

  function downloadName() { return 'evidence-chain-recovery-application-plan.json'; }

  return {
    PLAN_SCHEMA: PLAN_SCHEMA,
    CAPABILITY: CAPABILITY,
    POSTURES: clone(POSTURES),
    VALID_FOR_SECONDS: VALID_FOR_SECONDS,
    descriptor: {
      id: 'evidence-chain-application-plan-foundry',
      capability: CAPABILITY,
      version: '1.0.0',
      status: 'TEST',
      accepts: ['application/x-ndjson', REVIEW_SCHEMA, DECISION_SCHEMA],
      produces: [PLAN_SCHEMA],
      sideEffects: []
    },
    parseAssessment: parseAssessment,
    parseDecision: parseDecision,
    build: build,
    example: example,
    downloadName: downloadName
  };
});
