(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMEvidenceChainCore = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var EVENT_SCHEMA = 'axm.evidence-retention/v1';
  var REPORT_SCHEMA = 'axm.evidence-chain-inspection/v1';
  var CAPABILITY = 'capability.inspect.evidence-chain/v1';
  var MAX_BYTES = 10 * 1024 * 1024;
  var MAX_EVENTS = 5000;
  var HASH_PATTERN = /^[a-f0-9]{64}$/i;
  var EVIDENCE_CLASSES = ['PERMANENT_EXACT', 'SESSION_EXACT'];
  var REQUIRED_FIELDS = ['schema', 'id', 'at', 'sessionId', 'source', 'evidenceClass', 'type', 'payload', 'previousHash', 'eventHash'];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (key) {
        return JSON.stringify(key) + ':' + canonical(value[key]);
      }).join(',') + '}';
    }
    return JSON.stringify(value);
  }

  function bytesToHex(bytes) {
    return Array.prototype.map.call(new Uint8Array(bytes), function (value) {
      return value.toString(16).padStart(2, '0');
    }).join('');
  }

  async function sha256(value) {
    var source = String(value == null ? '' : value);
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle && typeof TextEncoder !== 'undefined') {
      return bytesToHex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)));
    }
    if (typeof require === 'function') {
      return require('crypto').createHash('sha256').update(source, 'utf8').digest('hex');
    }
    throw new Error('SHA-256 runtime unavailable');
  }

  function byteLength(value) {
    var source = String(value == null ? '' : value);
    if (typeof Buffer !== 'undefined') return Buffer.byteLength(source, 'utf8');
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(source).length;
    return unescape(encodeURIComponent(source)).length;
  }

  function safeLabel(value) {
    var label = String(value == null ? '' : value).trim().replace(/[\r\n\t]+/g, ' ');
    return (label || 'explicit-input').slice(0, 80);
  }

  function anomaly(line, code, severity, detail, hashes) {
    var row = { line: line, code: code, severity: severity, detail: detail };
    if (hashes) row.hashes = hashes;
    return row;
  }

  function recommendations(verdict) {
    if (verdict === 'PASS') return [
      { code: 'PRESERVE_ORIGINAL', action: 'Keep the original segment unchanged.' },
      { code: 'RETRY_ONLY_IN_REVIEWED_CONTEXT', action: 'Retry recovery only through the existing reviewed retention service or an isolated copy.' }
    ];
    if (verdict === 'FAIL') return [
      { code: 'PRESERVE_ORIGINAL', action: 'Keep the failing segment unchanged as evidence.' },
      { code: 'DO_NOT_REWRITE_OR_DELETE', action: 'Do not rewrite hashes, truncate lines or delete the segment automatically.' },
      { code: 'USE_ISOLATED_SERVER_STATE', action: 'Use an explicit isolated production-session state root when a server route must be tested.' },
      { code: 'HUMAN_REVIEW_REQUIRED', action: 'Route the digest-only receipt and preserved original to a human recovery review.' }
    ];
    return [
      { code: 'INSUFFICIENT_EVIDENCE', action: 'Provide a non-empty complete segment within the declared resource limits.' }
    ];
  }

  async function inspect(source, options) {
    var input = String(source == null ? '' : source);
    var inputBytes = byteLength(input);
    if (inputBytes > MAX_BYTES) throw new Error('input exceeds the 10 MiB inspection limit');
    var rawLines = input.split(/\r?\n/);
    var eventLines = [];
    var ignoredBlankLines = 0;
    rawLines.forEach(function (line, index) {
      if (line === '') ignoredBlankLines += 1;
      else eventLines.push({ lineNumber: index + 1, text: line });
    });
    if (eventLines.length > MAX_EVENTS) throw new Error('input exceeds the 5,000 event inspection limit');

    var findings = [];
    var previousStoredHash = null;
    var firstSessionId = null;
    var firstAt = null;
    var lastAt = null;
    var previousTime = null;
    var parsedEvents = 0;
    var classCounts = { PERMANENT_EXACT: 0, SESSION_EXACT: 0, OTHER: 0 };

    for (var index = 0; index < eventLines.length; index += 1) {
      var row = eventLines[index];
      var item;
      try {
        item = JSON.parse(row.text);
      } catch (error) {
        findings.push(anomaly(row.lineNumber, 'JSON_PARSE_ERROR', 'ERROR', 'Line is not valid JSON; raw content was not retained.'));
        continue;
      }
      if (!item || Array.isArray(item) || typeof item !== 'object') {
        findings.push(anomaly(row.lineNumber, 'EVENT_NOT_OBJECT', 'ERROR', 'Event must be a JSON object.'));
        continue;
      }
      parsedEvents += 1;
      var missing = REQUIRED_FIELDS.filter(function (field) { return !Object.prototype.hasOwnProperty.call(item, field); });
      if (missing.length) findings.push(anomaly(row.lineNumber, 'STRUCTURE_MISSING_FIELDS', 'ERROR', 'Missing required fields: ' + missing.join(', ') + '.'));
      if (item.schema !== EVENT_SCHEMA) findings.push(anomaly(row.lineNumber, 'SCHEMA_MISMATCH', 'ERROR', 'Event schema must be ' + EVENT_SCHEMA + '.'));

      var storedHash = typeof item.eventHash === 'string' ? item.eventHash.toLowerCase() : '';
      var expectedPrevious = previousStoredHash;
      var observedPrevious = item.previousHash == null ? null : String(item.previousHash).toLowerCase();
      if (observedPrevious !== expectedPrevious) {
        findings.push(anomaly(row.lineNumber, 'PREVIOUS_HASH_MISMATCH', 'ERROR', 'previousHash does not link to the prior stored eventHash.', {
          expectedPreviousHash: expectedPrevious,
          observedPreviousHash: observedPrevious
        }));
      }
      if (!HASH_PATTERN.test(storedHash)) {
        findings.push(anomaly(row.lineNumber, 'EVENT_HASH_FORMAT_INVALID', 'ERROR', 'eventHash must be a 64-character hexadecimal SHA-256 digest.'));
      }
      var hashMaterial = clone(item);
      delete hashMaterial.eventHash;
      var computedHash = await sha256(canonical(hashMaterial));
      if (computedHash !== storedHash) {
        findings.push(anomaly(row.lineNumber, 'EVENT_HASH_MISMATCH', 'ERROR', 'Canonical event content does not match the stored eventHash.', {
          computedEventHash: computedHash,
          storedEventHash: storedHash || null
        }));
      }
      previousStoredHash = HASH_PATTERN.test(storedHash) ? storedHash : null;

      if (firstSessionId == null && typeof item.sessionId === 'string') firstSessionId = item.sessionId;
      else if (firstSessionId != null && item.sessionId !== firstSessionId) {
        findings.push(anomaly(row.lineNumber, 'SESSION_ID_MISMATCH', 'WARNING', 'Event sessionId differs from the first parsed event; identifiers were not emitted.'));
      }
      var timestamp = new Date(item.at);
      if (!Number.isFinite(timestamp.getTime())) {
        findings.push(anomaly(row.lineNumber, 'TIMESTAMP_INVALID', 'WARNING', 'Event timestamp is invalid.'));
      } else {
        if (previousTime != null && timestamp.getTime() < previousTime) findings.push(anomaly(row.lineNumber, 'TIMESTAMP_REGRESSION', 'WARNING', 'Event time moves backward within the segment.'));
        previousTime = timestamp.getTime();
        firstAt = firstAt || timestamp.toISOString();
        lastAt = timestamp.toISOString();
      }
      if (EVIDENCE_CLASSES.indexOf(item.evidenceClass) >= 0) classCounts[item.evidenceClass] += 1;
      else {
        classCounts.OTHER += 1;
        findings.push(anomaly(row.lineNumber, 'EVIDENCE_CLASS_UNEXPECTED', 'WARNING', 'Segment event has an unexpected evidence class.'));
      }
    }

    var errors = findings.filter(function (entry) { return entry.severity === 'ERROR'; }).length;
    var warnings = findings.filter(function (entry) { return entry.severity === 'WARNING'; }).length;
    var verdict = eventLines.length === 0 ? 'UNKNOWN' : (errors ? 'FAIL' : (warnings ? 'UNKNOWN' : 'PASS'));
    var firstBroken = findings.find(function (entry) { return entry.severity === 'ERROR'; });
    return {
      schema: REPORT_SCHEMA,
      capability: CAPABILITY,
      status: 'INSPECTION_ONLY',
      verdict: verdict,
      chainState: eventLines.length === 0 ? 'EMPTY' : (errors ? 'BROKEN' : 'VALID'),
      source: {
        label: safeLabel(options && options.label),
        sha256: await sha256(input),
        bytes: inputBytes,
        rawLines: rawLines.length,
        eventLines: eventLines.length,
        ignoredBlankLines: ignoredBlankLines
      },
      summary: {
        parsedEvents: parsedEvents,
        errors: errors,
        warnings: warnings,
        firstBrokenLine: firstBroken ? firstBroken.line : null,
        firstAt: firstAt,
        lastAt: lastAt,
        lastStoredEventHash: previousStoredHash,
        sessionIdDigest: firstSessionId == null ? null : await sha256(firstSessionId),
        evidenceClasses: classCounts
      },
      findings: findings,
      recommendations: recommendations(verdict),
      compatibility: {
        eventSchema: EVENT_SCHEMA,
        canonicalization: 'recursive-key-sort-json/v1',
        hash: 'SHA-256',
        previousHashOrigin: null
      },
      truth: {
        completeInputInspected: true,
        payloadFieldsReadForHash: true,
        payloadsEmitted: false,
        sourcesEmitted: false,
        rawLinesEmitted: false,
        fullPathsEmitted: false,
        filesWritten: false,
        automaticRepair: false,
        automaticRecovery: false,
        serverStarted: false,
        authorityGranted: false,
        promoted: false,
        canon: false
      }
    };
  }

  async function example() {
    var sessionId = 'synthetic-session';
    var first = {
      schema: EVENT_SCHEMA,
      id: 'synthetic-event-1',
      at: '2026-07-28T19:30:00.000Z',
      sessionId: sessionId,
      source: 'synthetic/example.jsonl',
      evidenceClass: 'SESSION_EXACT',
      type: 'synthetic-check',
      payload: { synthetic: true, sequence: 1 },
      previousHash: null
    };
    first.eventHash = await sha256(canonical(first));
    var second = {
      schema: EVENT_SCHEMA,
      id: 'synthetic-event-2',
      at: '2026-07-28T19:30:01.000Z',
      sessionId: sessionId,
      source: 'synthetic/example.jsonl',
      evidenceClass: 'PERMANENT_EXACT',
      type: 'synthetic-repair-check',
      payload: { synthetic: true, sequence: 2 },
      previousHash: first.eventHash
    };
    second.eventHash = await sha256(canonical(second));
    return JSON.stringify(first) + '\n' + JSON.stringify(second) + '\n';
  }

  return {
    EVENT_SCHEMA: EVENT_SCHEMA,
    REPORT_SCHEMA: REPORT_SCHEMA,
    CAPABILITY: CAPABILITY,
    MAX_BYTES: MAX_BYTES,
    MAX_EVENTS: MAX_EVENTS,
    descriptor: {
      id: 'evidence-chain-inspector',
      capability: CAPABILITY,
      version: '1.0.0',
      status: 'TEST',
      accepts: ['application/x-ndjson', EVENT_SCHEMA],
      produces: [REPORT_SCHEMA],
      sideEffects: []
    },
    canonical: canonical,
    sha256: sha256,
    inspect: inspect,
    example: example
  };
});
