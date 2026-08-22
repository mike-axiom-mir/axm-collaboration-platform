(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMEvidenceChainRecoveryCore = api;
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';

  var INSPECTION_SCHEMA = 'axm.evidence-chain-inspection/v1';
  var INSPECTION_CAPABILITY = 'capability.inspect.evidence-chain/v1';
  var RECEIPT_SCHEMA = 'axm.evidence-chain-recovery-candidate/v1';
  var CAPABILITY = 'capability.prepare.evidence-chain-recovery-candidate/v1';
  var CORRECTABLE_ERRORS = ['PREVIOUS_HASH_MISMATCH', 'EVENT_HASH_MISMATCH', 'EVENT_HASH_FORMAT_INVALID'];
  var HASH_PATTERN = /^[a-f0-9]{64}$/i;

  function dependency(override) {
    var inspector = override || (root && root.AXMEvidenceChainCore);
    if (!inspector && typeof require === 'function') inspector = require('../evidence-chain-inspector/evidence-chain-core');
    if (!inspector || typeof inspector.inspect !== 'function' || typeof inspector.sha256 !== 'function') {
      throw new Error('Evidence Chain Inspector dependency is unavailable');
    }
    return inspector;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validDate(value) {
    var date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) throw new Error('generatedAt must be a valid date');
    return date.toISOString();
  }

  function parseReceipt(value) {
    var parsed = value;
    if (typeof value === 'string') {
      if (value.length > 2 * 1024 * 1024) throw new Error('inspection receipt exceeds the 2 MiB limit');
      try { parsed = JSON.parse(value); }
      catch (error) { throw new Error('inspection receipt JSON is invalid: ' + error.message); }
    }
    if (!parsed || parsed.schema !== INSPECTION_SCHEMA) throw new Error('inspection receipt schema must be ' + INSPECTION_SCHEMA);
    if (parsed.capability !== INSPECTION_CAPABILITY) throw new Error('inspection receipt capability mismatch');
    if (parsed.status !== 'INSPECTION_ONLY') throw new Error('inspection receipt status must remain INSPECTION_ONLY');
    if (!parsed.source || !HASH_PATTERN.test(String(parsed.source.sha256 || ''))) throw new Error('inspection receipt needs a valid source SHA-256');
    var truth = parsed.truth || {};
    if (truth.payloadsEmitted !== false || truth.sourcesEmitted !== false || truth.rawLinesEmitted !== false || truth.automaticRepair !== false) {
      throw new Error('inspection receipt truth boundary mismatch');
    }
    return clone(parsed);
  }

  function nonHashEvent(item) {
    var value = clone(item);
    delete value.previousHash;
    delete value.eventHash;
    return value;
  }

  function parsedEventRows(source) {
    var rows = [];
    String(source).split(/\r?\n/).forEach(function (line, index) {
      if (line === '') return;
      rows.push({ line: index + 1, item: JSON.parse(line) });
    });
    return rows;
  }

  async function eligibility(source, receipt, inspectorOverride) {
    var inspector = dependency(inspectorOverride);
    var boundReceipt = parseReceipt(receipt);
    var input = String(source == null ? '' : source);
    var sourceDigest = await inspector.sha256(input);
    if (sourceDigest !== String(boundReceipt.source.sha256).toLowerCase()) {
      throw new Error('inspection receipt is not bound to this exact source digest');
    }
    var current = await inspector.inspect(input, { label: 'recovery-source-reinspection' });
    if (current.verdict !== 'FAIL' || current.chainState !== 'BROKEN') {
      throw new Error('source is not an eligible broken chain; a recovery candidate is unnecessary or evidence is insufficient');
    }
    var errorFindings = current.findings.filter(function (entry) { return entry.severity === 'ERROR'; });
    var warningFindings = current.findings.filter(function (entry) { return entry.severity === 'WARNING'; });
    var uncorrectable = errorFindings.filter(function (entry) { return CORRECTABLE_ERRORS.indexOf(entry.code) < 0; });
    if (uncorrectable.length) {
      throw new Error('source has uncorrectable findings: ' + uncorrectable.map(function (entry) { return entry.code + '@' + entry.line; }).join(', '));
    }
    if (warningFindings.length) {
      throw new Error('source has metadata warnings requiring separate review: ' + warningFindings.map(function (entry) { return entry.code + '@' + entry.line; }).join(', '));
    }
    if (!errorFindings.length) throw new Error('source has no correctable hash-chain findings');
    return { source: input, providedReceipt: boundReceipt, currentInspection: current, inspector: inspector };
  }

  async function build(source, receipt, options, inspectorOverride) {
    var settings = options || {};
    if (settings.acknowledgeAuthenticityUnknown !== true) {
      throw new Error('explicit acknowledgement is required: structural rehashing does not prove content authenticity or restore history');
    }
    var eligible = await eligibility(source, receipt, inspectorOverride);
    var inspector = eligible.inspector;
    var rows = parsedEventRows(eligible.source);
    var sourceNonHash = rows.map(function (row) { return nonHashEvent(row.item); });
    var previous = null;
    var transitions = [];
    var candidateLines = [];

    for (var index = 0; index < rows.length; index += 1) {
      var row = rows[index];
      var candidate = clone(row.item);
      var originalHash = typeof candidate.eventHash === 'string' && HASH_PATTERN.test(candidate.eventHash) ? candidate.eventHash.toLowerCase() : null;
      var originalPrevious = candidate.previousHash == null ? null : String(candidate.previousHash).toLowerCase();
      candidate.previousHash = previous;
      delete candidate.eventHash;
      candidate.eventHash = await inspector.sha256(inspector.canonical(candidate));
      previous = candidate.eventHash;
      candidateLines.push(JSON.stringify(candidate));
      transitions.push({
        line: row.line,
        originalEventHash: originalHash,
        candidateEventHash: candidate.eventHash,
        previousHashChanged: originalPrevious !== candidate.previousHash,
        eventHashChanged: originalHash !== candidate.eventHash
      });
    }

    var candidateJsonl = candidateLines.join('\n') + (candidateLines.length ? '\n' : '');
    var candidateInspection = await inspector.inspect(candidateJsonl, { label: 'recovery-candidate' });
    if (candidateInspection.verdict !== 'PASS' || candidateInspection.chainState !== 'VALID') {
      throw new Error('candidate independent reinspection did not pass');
    }
    var candidateRows = parsedEventRows(candidateJsonl);
    var candidateNonHash = candidateRows.map(function (row) { return nonHashEvent(row.item); });
    var sourceNonHashDigest = await inspector.sha256(inspector.canonical(sourceNonHash));
    var candidateNonHashDigest = await inspector.sha256(inspector.canonical(candidateNonHash));
    if (sourceNonHashDigest !== candidateNonHashDigest) throw new Error('candidate changed a non-hash field');

    var at = validDate(settings.generatedAt);
    var receiptDigest = await inspector.sha256(inspector.canonical(eligible.providedReceipt));
    var candidateInspectionDigest = await inspector.sha256(inspector.canonical(candidateInspection));
    var outputReceipt = {
      schema: RECEIPT_SCHEMA,
      capability: CAPABILITY,
      status: 'STRUCTURAL_RECHAIN_CANDIDATE',
      source: {
        sha256: eligible.currentInspection.source.sha256,
        bytes: eligible.currentInspection.source.bytes,
        events: eligible.currentInspection.summary.parsedEvents,
        inspectionReceiptSha256: receiptDigest,
        findingCodes: eligible.currentInspection.findings.map(function (entry) { return entry.code + '@' + entry.line; }),
        nonHashSemanticSha256: sourceNonHashDigest
      },
      candidate: {
        sha256: candidateInspection.source.sha256,
        bytes: candidateInspection.source.bytes,
        events: candidateInspection.summary.parsedEvents,
        lastEventHash: candidateInspection.summary.lastStoredEventHash,
        nonHashSemanticSha256: candidateNonHashDigest,
        changedEventHashLines: transitions.filter(function (entry) { return entry.eventHashChanged; }).map(function (entry) { return entry.line; }),
        changedPreviousHashLines: transitions.filter(function (entry) { return entry.previousHashChanged; }).map(function (entry) { return entry.line; }),
        outputName: 'evidence-segment-STRUCTURAL-CANDIDATE.jsonl'
      },
      transitions: transitions,
      verification: {
        inspectorSchema: candidateInspection.schema,
        verdict: candidateInspection.verdict,
        chainState: candidateInspection.chainState,
        inspectionSha256: candidateInspectionDigest
      },
      acknowledgement: {
        authenticityUnknownAccepted: true,
        statement: 'Structural rehashing does not prove payload authenticity or restore source history.'
      },
      provenance: {
        inspector: 'evidence-chain-inspector/v0.1',
        foundry: 'evidence-chain-recovery-foundry/v0.1',
        generatedAt: at
      },
      truth: {
        candidateOnly: true,
        structuralChainValid: true,
        nonHashFieldsPreserved: true,
        payloadObjectsPreserved: true,
        byteIdentityPreserved: false,
        formattingPreserved: false,
        contentAuthenticityProven: false,
        sourceHistoryRestored: false,
        originalModified: false,
        liveStateWritten: false,
        candidateApplied: false,
        sessionRecovered: false,
        serverStarted: false,
        authorityGranted: false,
        promoted: false,
        canon: false
      }
    };
    return { candidateJsonl: candidateJsonl, receipt: outputReceipt };
  }

  async function example(inspectorOverride) {
    var inspector = dependency(inspectorOverride);
    var valid = await inspector.example();
    var rows = valid.trimEnd().split(/\r?\n/).map(function (line) { return JSON.parse(line); });
    rows[0].payload.syntheticTamperForRecoveryDemo = true;
    var broken = rows.map(function (row) { return JSON.stringify(row); }).join('\n') + '\n';
    return { source: broken, inspection: await inspector.inspect(broken, { label: 'synthetic-broken-example' }) };
  }

  function downloadNames(result) {
    return {
      candidate: result && result.receipt && result.receipt.candidate.outputName || 'evidence-segment-STRUCTURAL-CANDIDATE.jsonl',
      receipt: 'evidence-chain-recovery-candidate-receipt.json'
    };
  }

  return {
    INSPECTION_SCHEMA: INSPECTION_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    CAPABILITY: CAPABILITY,
    CORRECTABLE_ERRORS: clone(CORRECTABLE_ERRORS),
    descriptor: {
      id: 'evidence-chain-recovery-foundry',
      capability: CAPABILITY,
      version: '1.0.0',
      status: 'TEST',
      accepts: ['application/x-ndjson', INSPECTION_SCHEMA],
      produces: ['application/x-ndjson', RECEIPT_SCHEMA],
      sideEffects: []
    },
    parseReceipt: parseReceipt,
    eligibility: eligibility,
    build: build,
    example: example,
    downloadNames: downloadNames
  };
});
