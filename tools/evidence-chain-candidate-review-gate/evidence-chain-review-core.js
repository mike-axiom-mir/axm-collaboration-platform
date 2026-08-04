(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMEvidenceChainReviewCore = api;
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';

  var INSPECTION_SCHEMA = 'axm.evidence-chain-inspection/v1';
  var INSPECTION_CAPABILITY = 'capability.inspect.evidence-chain/v1';
  var RECOVERY_SCHEMA = 'axm.evidence-chain-recovery-candidate/v1';
  var RECOVERY_CAPABILITY = 'capability.prepare.evidence-chain-recovery-candidate/v1';
  var REVIEW_SCHEMA = 'axm.evidence-chain-recovery-review/v1';
  var DECISION_SCHEMA = 'axm.evidence-chain-recovery-review-decision/v1';
  var CAPABILITY = 'capability.review.evidence-chain-recovery-candidate/v1';
  var CORRECTABLE_ERRORS = ['PREVIOUS_HASH_MISMATCH', 'EVENT_HASH_MISMATCH', 'EVENT_HASH_FORMAT_INVALID'];
  var DECISIONS = [
    'HOLD_FOR_MORE_EVIDENCE',
    'REJECT_CANDIDATE',
    'ACCEPT_STRUCTURE_FOR_SEPARATE_APPLICATION_REVIEW'
  ];
  var DECISION_REASONS = {
    HOLD_FOR_MORE_EVIDENCE: 'MORE_EVIDENCE_REQUIRED',
    REJECT_CANDIDATE: 'CANDIDATE_REJECTED',
    ACCEPT_STRUCTURE_FOR_SEPARATE_APPLICATION_REVIEW: 'STRUCTURE_VERIFIED_AUTHENTICITY_UNKNOWN'
  };
  var HASH_PATTERN = /^[a-f0-9]{64}$/i;

  function inspectorDependency(override) {
    var inspector = override || (root && root.AXMEvidenceChainCore);
    if (!inspector && typeof require === 'function') inspector = require('../evidence-chain-inspector/evidence-chain-core');
    if (!inspector || typeof inspector.inspect !== 'function' || typeof inspector.sha256 !== 'function' || typeof inspector.canonical !== 'function') {
      throw new Error('Evidence Chain Inspector dependency is unavailable');
    }
    return inspector;
  }

  function foundryDependency(override) {
    var foundry = override || (root && root.AXMEvidenceChainRecoveryCore);
    if (!foundry && typeof require === 'function') foundry = require('../evidence-chain-recovery-foundry/evidence-chain-recovery-core');
    if (!foundry || typeof foundry.build !== 'function') throw new Error('Evidence Chain Recovery Foundry dependency is unavailable');
    return foundry;
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function validDate(value) {
    var date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) throw new Error('generatedAt must be a valid date');
    return date.toISOString();
  }

  function parseJsonReceipt(value, label, maxBytes) {
    var parsed = value;
    if (typeof value === 'string') {
      if (value.length > maxBytes) throw new Error(label + ' exceeds the declared size limit');
      try { parsed = JSON.parse(value); }
      catch (error) { throw new Error(label + ' JSON is invalid: ' + error.message); }
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error(label + ' must be a JSON object');
    return clone(parsed);
  }

  function parseInspectionReceipt(value) {
    var parsed = parseJsonReceipt(value, 'inspection receipt', 2 * 1024 * 1024);
    if (parsed.schema !== INSPECTION_SCHEMA) throw new Error('inspection receipt schema must be ' + INSPECTION_SCHEMA);
    if (parsed.capability !== INSPECTION_CAPABILITY || parsed.status !== 'INSPECTION_ONLY') throw new Error('inspection receipt identity mismatch');
    if (!parsed.source || !HASH_PATTERN.test(String(parsed.source.sha256 || ''))) throw new Error('inspection receipt needs a valid source SHA-256');
    var truth = parsed.truth || {};
    if (truth.payloadsEmitted !== false || truth.sourcesEmitted !== false || truth.rawLinesEmitted !== false || truth.automaticRepair !== false) {
      throw new Error('inspection receipt truth boundary mismatch');
    }
    return parsed;
  }

  function parseRecoveryReceipt(value) {
    var parsed = parseJsonReceipt(value, 'recovery receipt', 2 * 1024 * 1024);
    if (parsed.schema !== RECOVERY_SCHEMA) throw new Error('recovery receipt schema must be ' + RECOVERY_SCHEMA);
    if (parsed.capability !== RECOVERY_CAPABILITY || parsed.status !== 'STRUCTURAL_RECHAIN_CANDIDATE') throw new Error('recovery receipt identity mismatch');
    if (!parsed.source || !parsed.candidate || !parsed.verification || !parsed.acknowledgement) throw new Error('recovery receipt structure is incomplete');
    ['sha256', 'inspectionReceiptSha256', 'nonHashSemanticSha256'].forEach(function (field) {
      if (!HASH_PATTERN.test(String(parsed.source[field] || ''))) throw new Error('recovery receipt source.' + field + ' must be SHA-256');
    });
    ['sha256', 'lastEventHash', 'nonHashSemanticSha256'].forEach(function (field) {
      if (!HASH_PATTERN.test(String(parsed.candidate[field] || ''))) throw new Error('recovery receipt candidate.' + field + ' must be SHA-256');
    });
    if (!HASH_PATTERN.test(String(parsed.verification.inspectionSha256 || ''))) throw new Error('recovery receipt verification.inspectionSha256 must be SHA-256');
    var truth = parsed.truth || {};
    ['candidateOnly', 'structuralChainValid', 'nonHashFieldsPreserved', 'payloadObjectsPreserved'].forEach(function (field) {
      if (truth[field] !== true) throw new Error('recovery receipt truth.' + field + ' must be true');
    });
    ['byteIdentityPreserved', 'formattingPreserved', 'contentAuthenticityProven', 'sourceHistoryRestored', 'originalModified', 'liveStateWritten', 'candidateApplied', 'sessionRecovered', 'serverStarted', 'authorityGranted', 'promoted', 'canon'].forEach(function (field) {
      if (truth[field] !== false) throw new Error('recovery receipt truth.' + field + ' must be false');
    });
    if (parsed.acknowledgement.authenticityUnknownAccepted !== true) throw new Error('recovery receipt lacks the authenticity-unknown acknowledgement');
    return parsed;
  }

  function parsedRows(source) {
    var rows = [];
    try {
      String(source).split(/\r?\n/).forEach(function (line, index) {
        if (line === '') return;
        var item = JSON.parse(line);
        if (!item || Array.isArray(item) || typeof item !== 'object') throw new Error('event is not an object');
        rows.push({ line: index + 1, item: item });
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

  function findingCodes(report) {
    return (report && Array.isArray(report.findings) ? report.findings : []).map(function (entry) { return entry.code + '@' + entry.line; });
  }

  function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

  function normalizeHash(value) {
    return typeof value === 'string' && HASH_PATTERN.test(value) ? value.toLowerCase() : null;
  }

  function transitionRows(sourceRows, candidateRows) {
    if (sourceRows.length !== candidateRows.length) return null;
    return sourceRows.map(function (sourceRow, index) {
      var candidateRow = candidateRows[index];
      var sourceHash = normalizeHash(sourceRow.item.eventHash);
      var candidateHash = normalizeHash(candidateRow.item.eventHash);
      var sourcePrevious = sourceRow.item.previousHash == null ? null : String(sourceRow.item.previousHash).toLowerCase();
      var candidatePrevious = candidateRow.item.previousHash == null ? null : String(candidateRow.item.previousHash).toLowerCase();
      return {
        line: sourceRow.line,
        originalEventHash: sourceHash,
        candidateEventHash: candidateHash,
        previousHashChanged: sourcePrevious !== candidatePrevious,
        eventHashChanged: sourceHash !== candidateHash
      };
    });
  }

  function addCheck(checks, code, pass) {
    checks.push({ code: code, verdict: pass ? 'PASS' : 'FAIL' });
    return pass;
  }

  async function assess(source, inspectionReceipt, candidate, recoveryReceipt, options, inspectorOverride) {
    var inspector = inspectorDependency(inspectorOverride);
    var settings = options || {};
    var sourceInput = String(source == null ? '' : source);
    var candidateInput = String(candidate == null ? '' : candidate);
    var providedInspection = parseInspectionReceipt(inspectionReceipt);
    var providedRecovery = parseRecoveryReceipt(recoveryReceipt);
    var sourceSnapshot = sourceInput;
    var candidateSnapshot = candidateInput;
    var currentSource = await inspector.inspect(sourceInput, { label: 'recovery-source-reinspection' });
    var currentCandidate = await inspector.inspect(candidateInput, { label: 'recovery-candidate' });
    var inspectionDigest = await inspector.sha256(inspector.canonical(providedInspection));
    var recoveryDigest = await inspector.sha256(inspector.canonical(providedRecovery));
    var candidateInspectionDigest = await inspector.sha256(inspector.canonical(currentCandidate));
    var sourceParsed = parsedRows(sourceInput);
    var candidateParsed = parsedRows(candidateInput);
    var sourceNonHashDigest = sourceParsed.ok ? await inspector.sha256(inspector.canonical(sourceParsed.rows.map(function (row) { return nonHashEvent(row.item); }))) : null;
    var candidateNonHashDigest = candidateParsed.ok ? await inspector.sha256(inspector.canonical(candidateParsed.rows.map(function (row) { return nonHashEvent(row.item); }))) : null;
    var transitions = sourceParsed.ok && candidateParsed.ok ? transitionRows(sourceParsed.rows, candidateParsed.rows) : null;
    var expectedChangedEvent = transitions ? transitions.filter(function (entry) { return entry.eventHashChanged; }).map(function (entry) { return entry.line; }) : [];
    var expectedChangedPrevious = transitions ? transitions.filter(function (entry) { return entry.previousHashChanged; }).map(function (entry) { return entry.line; }) : [];
    var sourceErrors = currentSource.findings.filter(function (entry) { return entry.severity === 'ERROR'; });
    var sourceWarnings = currentSource.findings.filter(function (entry) { return entry.severity === 'WARNING'; });
    var onlyCorrectable = sourceErrors.length > 0 && sourceErrors.every(function (entry) { return CORRECTABLE_ERRORS.indexOf(entry.code) >= 0; });
    var checks = [];

    addCheck(checks, 'SOURCE_INSPECTION_BOUND',
      String(providedInspection.source.sha256).toLowerCase() === currentSource.source.sha256 &&
      providedInspection.verdict === currentSource.verdict &&
      providedInspection.chainState === currentSource.chainState &&
      Number(providedInspection.source.bytes) === currentSource.source.bytes &&
      providedInspection.summary && Number(providedInspection.summary.parsedEvents) === currentSource.summary.parsedEvents &&
      same(findingCodes(providedInspection), findingCodes(currentSource)));
    addCheck(checks, 'SOURCE_ELIGIBLE_HASH_BREAK_ONLY', currentSource.verdict === 'FAIL' && currentSource.chainState === 'BROKEN' && onlyCorrectable && sourceWarnings.length === 0);
    addCheck(checks, 'RECOVERY_SOURCE_BINDINGS_MATCH',
      String(providedRecovery.source.sha256).toLowerCase() === currentSource.source.sha256 &&
      Number(providedRecovery.source.bytes) === currentSource.source.bytes &&
      Number(providedRecovery.source.events) === currentSource.summary.parsedEvents &&
      String(providedRecovery.source.inspectionReceiptSha256).toLowerCase() === inspectionDigest &&
      same(providedRecovery.source.findingCodes, findingCodes(currentSource)) &&
      sourceNonHashDigest !== null && String(providedRecovery.source.nonHashSemanticSha256).toLowerCase() === sourceNonHashDigest);
    addCheck(checks, 'CANDIDATE_CHAIN_VALID', currentCandidate.verdict === 'PASS' && currentCandidate.chainState === 'VALID' && currentCandidate.summary.warnings === 0);
    addCheck(checks, 'RECOVERY_CANDIDATE_BINDINGS_MATCH',
      String(providedRecovery.candidate.sha256).toLowerCase() === currentCandidate.source.sha256 &&
      Number(providedRecovery.candidate.bytes) === currentCandidate.source.bytes &&
      Number(providedRecovery.candidate.events) === currentCandidate.summary.parsedEvents &&
      String(providedRecovery.candidate.lastEventHash).toLowerCase() === String(currentCandidate.summary.lastStoredEventHash || '').toLowerCase() &&
      candidateNonHashDigest !== null && String(providedRecovery.candidate.nonHashSemanticSha256).toLowerCase() === candidateNonHashDigest);
    addCheck(checks, 'NON_HASH_FIELDS_PRESERVED', sourceNonHashDigest !== null && sourceNonHashDigest === candidateNonHashDigest);
    addCheck(checks, 'RECOVERY_TRANSITIONS_MATCH', transitions !== null && same(providedRecovery.transitions, transitions) && same(providedRecovery.candidate.changedEventHashLines, expectedChangedEvent) && same(providedRecovery.candidate.changedPreviousHashLines, expectedChangedPrevious));
    addCheck(checks, 'RECOVERY_VERIFICATION_MATCH',
      providedRecovery.verification.inspectorSchema === INSPECTION_SCHEMA &&
      providedRecovery.verification.verdict === 'PASS' &&
      providedRecovery.verification.chainState === 'VALID' &&
      String(providedRecovery.verification.inspectionSha256).toLowerCase() === candidateInspectionDigest);
    addCheck(checks, 'INPUTS_UNCHANGED_IN_MEMORY', sourceInput === sourceSnapshot && candidateInput === candidateSnapshot);

    var pass = checks.every(function (entry) { return entry.verdict === 'PASS'; });
    return {
      schema: REVIEW_SCHEMA,
      capability: CAPABILITY,
      status: 'REVIEW_GATE_ASSESSMENT',
      verdict: pass ? 'PASS' : 'FAIL',
      recommendation: pass ? 'ELIGIBLE_FOR_EXPLICIT_REVIEW_DECISION' : 'HOLD_OR_REJECT',
      source: {
        sha256: currentSource.source.sha256,
        bytes: currentSource.source.bytes,
        events: currentSource.summary.parsedEvents,
        inspectionReceiptSha256: inspectionDigest,
        nonHashSemanticSha256: sourceNonHashDigest
      },
      candidate: {
        sha256: currentCandidate.source.sha256,
        bytes: currentCandidate.source.bytes,
        events: currentCandidate.summary.parsedEvents,
        nonHashSemanticSha256: candidateNonHashDigest
      },
      recoveryReceipt: { sha256: recoveryDigest },
      checks: checks,
      failedChecks: checks.filter(function (entry) { return entry.verdict === 'FAIL'; }).map(function (entry) { return entry.code; }),
      provenance: {
        inspector: 'evidence-chain-inspector/v0.1',
        foundryContract: 'evidence-chain-recovery-foundry/v0.1',
        reviewGate: 'evidence-chain-candidate-review-gate/v0.1',
        generatedAt: validDate(settings.generatedAt)
      },
      truth: {
        fourArtifactsDigestBound: pass,
        candidateChainValid: currentCandidate.verdict === 'PASS' && currentCandidate.chainState === 'VALID',
        nonHashFieldsPreserved: sourceNonHashDigest !== null && sourceNonHashDigest === candidateNonHashDigest,
        payloadsEmitted: false,
        sourcesEmitted: false,
        rawLinesEmitted: false,
        filesWritten: false,
        originalModified: false,
        candidateModified: false,
        candidateApplied: false,
        liveStateWritten: false,
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

  function parseAssessment(value) {
    var parsed = parseJsonReceipt(value, 'review assessment', 2 * 1024 * 1024);
    if (parsed.schema !== REVIEW_SCHEMA || parsed.capability !== CAPABILITY || parsed.status !== 'REVIEW_GATE_ASSESSMENT') throw new Error('review assessment identity mismatch');
    if (parsed.verdict !== 'PASS' && parsed.verdict !== 'FAIL') throw new Error('review assessment verdict is invalid');
    if (!parsed.source || !parsed.candidate || !HASH_PATTERN.test(String(parsed.source.sha256 || '')) || !HASH_PATTERN.test(String(parsed.candidate.sha256 || ''))) throw new Error('review assessment digests are incomplete');
    var truth = parsed.truth || {};
    ['payloadsEmitted', 'sourcesEmitted', 'rawLinesEmitted', 'filesWritten', 'originalModified', 'candidateModified', 'candidateApplied', 'liveStateWritten', 'contentAuthenticityProven', 'sourceHistoryRestored', 'sessionRecovered', 'serverStarted', 'authorityGranted', 'promoted', 'canon'].forEach(function (field) {
      if (truth[field] !== false) throw new Error('review assessment truth.' + field + ' must be false');
    });
    return parsed;
  }

  async function decide(assessment, decision, options, inspectorOverride) {
    var inspector = inspectorDependency(inspectorOverride);
    var parsed = parseAssessment(assessment);
    var selected = String(decision || '');
    var settings = options || {};
    if (DECISIONS.indexOf(selected) < 0) throw new Error('decision must be one of the fixed review choices');
    var accepting = selected === 'ACCEPT_STRUCTURE_FOR_SEPARATE_APPLICATION_REVIEW';
    if (accepting && parsed.verdict !== 'PASS') throw new Error('a failing assessment cannot be accepted');
    if (accepting && settings.acknowledgeNoAuthority !== true) throw new Error('acceptance requires explicit acknowledgement that this decision grants no application authority');
    if (accepting && settings.acknowledgeAuthenticityUnknown !== true) throw new Error('acceptance requires explicit acknowledgement that content authenticity remains unknown');
    var assessmentDigest = await inspector.sha256(inspector.canonical(parsed));
    return {
      schema: DECISION_SCHEMA,
      capability: CAPABILITY,
      status: 'REVIEW_DECISION_RECORDED',
      assessmentSha256: assessmentDigest,
      sourceSha256: parsed.source.sha256,
      candidateSha256: parsed.candidate.sha256,
      assessmentVerdict: parsed.verdict,
      decision: selected,
      reasonCode: DECISION_REASONS[selected],
      acknowledgement: {
        noApplicationAuthorityAccepted: accepting ? true : null,
        authenticityUnknownAccepted: accepting ? true : null
      },
      provenance: {
        decisionSeat: 'explicit-local-review-input',
        generatedAt: validDate(settings.generatedAt)
      },
      truth: {
        assessmentContentBound: true,
        humanIdentityVerified: false,
        structuralAcceptanceOnly: accepting,
        approvedForApplication: false,
        applicationAuthorityGranted: false,
        contentAuthenticityProven: false,
        sourceHistoryRestored: false,
        originalModified: false,
        candidateModified: false,
        candidateApplied: false,
        liveStateWritten: false,
        sessionRecovered: false,
        serverStarted: false,
        authorityGranted: false,
        promoted: false,
        canon: false
      }
    };
  }

  async function example(options, overrides) {
    var dependencies = overrides || {};
    var inspector = inspectorDependency(dependencies.inspector);
    var foundry = foundryDependency(dependencies.foundry);
    var valid = await inspector.example();
    var rows = valid.trimEnd().split(/\r?\n/).map(function (line) { return JSON.parse(line); });
    rows[0].payload.syntheticTamperForReviewDemo = true;
    var source = rows.map(function (row) { return JSON.stringify(row); }).join('\n') + '\n';
    var inspection = await inspector.inspect(source, { label: 'synthetic-review-source' });
    var recovery = await foundry.build(source, inspection, {
      acknowledgeAuthenticityUnknown: true,
      generatedAt: options && options.recoveryGeneratedAt
    }, inspector);
    return { source: source, inspection: inspection, candidate: recovery.candidateJsonl, recovery: recovery.receipt };
  }

  function downloadNames() {
    return {
      assessment: 'evidence-chain-recovery-review-assessment.json',
      decision: 'evidence-chain-recovery-review-decision.json'
    };
  }

  return {
    REVIEW_SCHEMA: REVIEW_SCHEMA,
    DECISION_SCHEMA: DECISION_SCHEMA,
    CAPABILITY: CAPABILITY,
    DECISIONS: clone(DECISIONS),
    descriptor: {
      id: 'evidence-chain-candidate-review-gate',
      capability: CAPABILITY,
      version: '1.0.0',
      status: 'TEST',
      accepts: ['application/x-ndjson', INSPECTION_SCHEMA, RECOVERY_SCHEMA],
      produces: [REVIEW_SCHEMA, DECISION_SCHEMA],
      sideEffects: []
    },
    parseInspectionReceipt: parseInspectionReceipt,
    parseRecoveryReceipt: parseRecoveryReceipt,
    assess: assess,
    decide: decide,
    example: example,
    downloadNames: downloadNames
  };
});
