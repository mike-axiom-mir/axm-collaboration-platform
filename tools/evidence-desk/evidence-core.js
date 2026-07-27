(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMEvidenceCore = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var RECEIPT_SCHEMA = 'axm.evidence-receipt/v2';
  var INPUT_SCHEMA = 'axm.evidence-fields/v2';
  var KNOWLEDGE_SCHEMA = 'axm.knowledge.research/v1';
  var HANDOFF_SCHEMA = 'axm.evidence-handoff-receipt/v1';
  var CHECK = ['PASS', 'FAIL', 'NOT_RUN'];
  var VERDICTS = ['PASS', 'FAIL', 'UNKNOWN'];
  var RISKS = ['LOW', 'MEDIUM', 'HIGH'];
  var CLAIM_ROUTES = {
    'existence': { label: 'Existence', surface: 'file-inspection', evidence: 'Inspect the exact file, record, route, or package.' },
    'static-structure': { label: 'Static structure', surface: 'schema-validation', evidence: 'Parse the structure and validate it against its declared contract.' },
    'deterministic-behavior': { label: 'Deterministic behavior', surface: 'focused-execution', evidence: 'Run known inputs and assert the exact outputs.' },
    'visual-appearance': { label: 'Visual appearance', surface: 'live-visual-observation', evidence: 'Inspect the rendered state at a declared viewport.' },
    'motion-timing': { label: 'Motion or timing', surface: 'frame-sequence', evidence: 'Observe a timestamped sequence or recording.' },
    'interaction-journey': { label: 'Interaction journey', surface: 'live-interaction', evidence: 'Perform the complete relevant journey with real inputs.' },
    'persistence': { label: 'Persistence', surface: 'restart-reload', evidence: 'Save, restart or reload, and compare the restored state.' },
    'transport': { label: 'Transport', surface: 'sender-and-receiver-receipts', evidence: 'Bind sender and receiver receipts to the same payload identifier.' },
    'authorization': { label: 'Authorization', surface: 'allowed-and-denied-attempts', evidence: 'Exercise both an allowed and a denied identity.' },
    'performance': { label: 'Performance', surface: 'measured-telemetry', evidence: 'Measure a named workload and duration.' },
    'resource-safety': { label: 'Resource safety', surface: 'hardware-telemetry', evidence: 'Observe bounded hardware telemetry under load and recovery.' },
    'learning-improvement': { label: 'Learning improvement', surface: 'held-out-evaluation', evidence: 'Use held-out evaluation that was not used for training.' },
    'quality': { label: 'Quality', surface: 'acceptance-review', evidence: 'Inspect the artifact against declared acceptance criteria.' },
    'taste-meaning': { label: 'Taste or meaning', surface: 'human-steward-judgment', evidence: 'Record an explicit human or appointed-steward judgment.' },
    'other': { label: 'Other declared claim', surface: 'declared-evidence', evidence: 'Name a falsifiable condition and an evidence surface that can answer it.' }
  };
  var CLAIM_KINDS = Object.keys(CLAIM_ROUTES);

  function text(v, max) {
    var out = v == null ? '' : String(v).trim();
    return max && out.length > max ? out.slice(0, max) : out;
  }
  function list(v) { return Array.isArray(v) ? v : []; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) {
      return JSON.stringify(k) + ':' + stable(v[k]);
    }).join(',') + '}';
    return JSON.stringify(v);
  }
  function bytesToHex(bytes) {
    return Array.prototype.map.call(new Uint8Array(bytes), function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }
  async function sha256(value) {
    var source = typeof value === 'string' ? value : stable(value);
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle && typeof TextEncoder !== 'undefined') {
      return bytesToHex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)));
    }
    if (typeof require === 'function') return require('crypto').createHash('sha256').update(source, 'utf8').digest('hex');
    throw new Error('SHA-256 runtime unavailable');
  }
  function canonicalKind(v) {
    var kind = text(v, 60).toLowerCase().replace(/[_\s]+/g, '-');
    return CLAIM_ROUTES[kind] ? kind : 'other';
  }
  function canonicalEnum(value, allowed, fallback) {
    var candidate = text(value, 40).toUpperCase();
    return allowed.indexOf(candidate) >= 0 ? candidate : fallback;
  }
  function claimIssues(claim) {
    var issues = [];
    if (!claim.pass_condition) issues.push('pass condition is missing');
    if (!claim.counterevidence) issues.push('what would disprove the claim is missing');
    if (claim.primary_surface !== claim.required_surface) issues.push('evidence surface does not match the claim kind');
    if (claim.verdict !== 'UNKNOWN' && !claim.observed_evidence) issues.push('observed evidence is missing');
    if (claim.verdict !== 'UNKNOWN' && claim.risk === 'HIGH' && !claim.source) issues.push('high-risk verdict needs a source pointer');
    return issues;
  }
  function normalizeObservation(v, index) {
    if (typeof v === 'string') v = { claim: v };
    v = v || {};
    var kind = canonicalKind(v.kind || v.claim_kind || v.claimKind);
    var route = CLAIM_ROUTES[kind];
    var verdict = canonicalEnum(v.verdict, VERDICTS, 'UNKNOWN');
    var claim = {
      id: text(v.id, 100) || ('claim-' + (index + 1)),
      claim: text(v.claim || v.text, 8000),
      kind: kind,
      risk: canonicalEnum(v.risk, RISKS, 'MEDIUM'),
      verdict: verdict,
      pass_condition: text(v.pass_condition || v.passCondition, 4000),
      primary_surface: text(v.primary_surface || v.primarySurface, 120) || route.surface,
      required_surface: route.surface,
      route_guidance: route.evidence,
      observed_evidence: text(v.observed_evidence || v.observedEvidence, 8000),
      counterevidence: text(v.counterevidence || v.counterEvidence, 4000),
      source_kind: text(v.source_kind || v.sourceKind, 120),
      source: text(v.source, 2000),
      named_seam: text(v.named_seam || v.namedSeam, 1000)
    };
    claim.route_issues = claimIssues(claim);
    claim.evidence_state = verdict === 'UNKNOWN' ? 'OPEN' : (claim.route_issues.length ? 'INCOMPLETE' : 'COMPLETE');
    claim.effective_verdict = claim.evidence_state === 'COMPLETE' ? verdict : 'UNKNOWN';
    return claim;
  }
  function normalizeAction(v) {
    v = v || {};
    return {
      action: text(v.action, 500), target: text(v.target, 2000), effect: text(v.effect || 'bounded-local', 120),
      result: text(v.result, 4000), evidence: text(v.evidence, 4000)
    };
  }
  function normalizeCheck(v) {
    v = v || {};
    var status = canonicalEnum(v.status, CHECK, 'NOT_RUN');
    var evidence = text(v.evidence, 4000);
    var evidenceState = status === 'NOT_RUN' ? 'OPEN' : (evidence ? 'COMPLETE' : 'INCOMPLETE');
    return {
      name: text(v.name, 500), status: status, evidence: evidence, evidence_state: evidenceState,
      effective_status: status === 'PASS' && evidenceState !== 'COMPLETE' ? 'NOT_RUN' : status
    };
  }
  function normalizeChange(v) {
    v = v || {};
    return { path: text(v.path, 2000), kind: text(v.kind || 'modified', 80), summary: text(v.summary, 4000) };
  }
  function normalize(input) {
    input = input || {};
    return {
      schema: INPUT_SCHEMA,
      format: 'axm-evidence-input', v: 2,
      title: text(input.title, 300), goal: text(input.goal, 4000),
      actor: {
        id: text(input.actor && input.actor.id || input.actor || 'unknown', 200),
        type: text(input.actor && input.actor.type || input.actorType || 'unknown', 80)
      },
      source_checkpoint: text(input.source_checkpoint || input.sourceCheckpoint, 2000),
      observations: list(input.observations || input.claims).map(normalizeObservation).filter(function (x) { return x.claim; }),
      actions: list(input.actions).map(normalizeAction).filter(function (x) { return x.action; }),
      checks: list(input.checks).map(normalizeCheck).filter(function (x) { return x.name; }),
      changes: list(input.changes).map(normalizeChange).filter(function (x) { return x.path || x.summary; }),
      limitations: list(input.limitations).map(function (x) { return text(x, 4000); }).filter(Boolean),
      next_actions: list(input.next_actions || input.nextActions).map(function (x) { return text(x, 4000); }).filter(Boolean)
    };
  }
  function validate(input) {
    var n = normalize(input), errors = [], warnings = [], ids = {};
    if (!n.title) errors.push('title is required');
    if (!n.goal) errors.push('goal is required');
    if (!n.source_checkpoint) warnings.push('source checkpoint is not named');
    n.observations.forEach(function (claim, i) {
      if (ids[claim.id]) errors.push('claim id is duplicated: ' + claim.id);
      ids[claim.id] = true;
      if (!claim.source_kind || !claim.source) warnings.push('claim ' + (i + 1) + ' has no complete source pointer');
      claim.route_issues.forEach(function (issue) { warnings.push('claim ' + (i + 1) + ': ' + issue); });
      if (claim.verdict !== 'UNKNOWN' && claim.effective_verdict === 'UNKNOWN') {
        warnings.push('claim ' + (i + 1) + ' declared ' + claim.verdict + ' but remains UNKNOWN until its evidence route is complete');
      }
    });
    n.actions.forEach(function (action, i) {
      if (!action.result) warnings.push('action ' + (i + 1) + ' has no result');
      if (!action.evidence) warnings.push('action ' + (i + 1) + ' has no evidence');
    });
    n.checks.forEach(function (check, i) {
      if (check.status === 'PASS' && check.evidence_state !== 'COMPLETE') {
        warnings.push('check ' + (i + 1) + ' declared PASS but remains NOT_RUN until evidence is supplied');
      }
      if (check.status === 'FAIL' && check.evidence_state !== 'COMPLETE') warnings.push('check ' + (i + 1) + ' declared FAIL without evidence');
    });
    if (n.actions.length && !n.checks.length) warnings.push('actions exist but no verification checks were supplied');
    if (!n.limitations.length) warnings.push('no limitations or not-tested scope recorded');
    return { ok: errors.length === 0, errors: errors, warnings: warnings, normalized: n };
  }
  function deriveStatus(n, validation) {
    var checkFail = n.checks.some(function (c) { return c.effective_status === 'FAIL' && c.evidence_state === 'COMPLETE'; });
    var claimFail = n.observations.some(function (c) { return c.effective_verdict === 'FAIL'; });
    var checkOpen = n.checks.some(function (c) { return c.effective_status === 'NOT_RUN' || c.evidence_state !== 'COMPLETE'; });
    var claimOpen = n.observations.some(function (c) { return c.effective_verdict === 'UNKNOWN'; });
    var actionOpen = n.actions.some(function (a) { return !a.result || !a.evidence; });
    if (!validation.ok) return 'INVALID_DRAFT';
    if (checkFail || claimFail) return 'EVIDENCE_CONTRADICTED';
    if (checkOpen || claimOpen || actionOpen) return 'EVIDENCE_INCOMPLETE';
    if (n.actions.length && n.checks.length) return 'VERIFIED_WITH_RECORDED_SCOPE';
    if (n.observations.length) return 'OBSERVED_WITH_RECORDED_SCOPE';
    if (n.actions.length) return 'EXECUTED_NOT_FULLY_VERIFIED';
    return 'DRAFT';
  }
  function build(input, opts) {
    opts = opts || {};
    var validation = validate(input), n = validation.normalized;
    var counts = {
      claims: n.observations.length,
      claims_passed: n.observations.filter(function (c) { return c.effective_verdict === 'PASS'; }).length,
      claims_failed: n.observations.filter(function (c) { return c.effective_verdict === 'FAIL'; }).length,
      claims_unknown: n.observations.filter(function (c) { return c.effective_verdict === 'UNKNOWN'; }).length,
      actions_executed: n.actions.length,
      checks_passed: n.checks.filter(function (c) { return c.effective_status === 'PASS'; }).length,
      checks_failed: n.checks.filter(function (c) { return c.effective_status === 'FAIL' && c.evidence_state === 'COMPLETE'; }).length,
      checks_not_run: n.checks.filter(function (c) { return c.effective_status === 'NOT_RUN' || c.evidence_state !== 'COMPLETE'; }).length,
      changes: n.changes.length
    };
    var status = deriveStatus(n, validation);
    var body = {
      schema: RECEIPT_SCHEMA,
      format: 'axm-evidence-receipt', v: 2,
      title: n.title, goal: n.goal, actor: n.actor, source_checkpoint: n.source_checkpoint,
      status: status, counts: counts,
      truth: {
        claimed_done: false,
        execution_is_verification: false,
        receipt_generation_is_independent_verification: false,
        all_claims_resolved: n.observations.length > 0 && counts.claims_unknown === 0,
        all_checks_evidenced: n.checks.length > 0 && counts.checks_not_run === 0,
        fully_verified: status === 'VERIFIED_WITH_RECORDED_SCOPE' || status === 'OBSERVED_WITH_RECORDED_SCOPE',
        receiver_acceptance_proven: false,
        canon_assigned: false
      },
      observations: n.observations, actions: n.actions, checks: n.checks, changes: n.changes,
      limitations: n.limitations, next_actions: n.next_actions,
      warnings: validation.warnings, validation_errors: validation.errors
    };
    return Object.assign({
      generated: opts.now || new Date().toISOString(),
      integrity: { state: 'UNSEALED', algorithm: 'sha256', scope: 'canonical-receipt-content-without-generated-or-integrity', digest: null }
    }, body);
  }
  function digestContent(receipt) {
    var copy = clone(receipt);
    delete copy.generated;
    delete copy.integrity;
    return copy;
  }
  async function seal(input, opts) {
    var receipt = input && input.schema === RECEIPT_SCHEMA ? clone(input) : build(input, opts);
    receipt.generated = opts && opts.now || receipt.generated || new Date().toISOString();
    receipt.integrity = {
      state: 'SEALED', algorithm: 'sha256', scope: 'canonical-receipt-content-without-generated-or-integrity',
      digest: 'sha256:' + await sha256(stable(digestContent(receipt)))
    };
    return receipt;
  }
  async function verify(receipt) {
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA || !receipt.integrity || receipt.integrity.algorithm !== 'sha256') {
      return { ok: false, state: 'INVALID', reason: 'not an AXM Evidence Desk v2 sealed receipt', expected: null, actual: null };
    }
    var expected = text(receipt.integrity.digest);
    var actual = 'sha256:' + await sha256(stable(digestContent(receipt)));
    var formatOk = /^sha256:[a-f0-9]{64}$/.test(expected) && receipt.integrity.state === 'SEALED';
    return { ok: formatOk && expected === actual, state: formatOk && expected === actual ? 'MATCH' : 'MISMATCH', expected: expected, actual: actual };
  }
  function linesFor(items, fn, empty) { return items.length ? items.map(fn) : [empty]; }
  function report(receipt) {
    var r = receipt && receipt.format === 'axm-evidence-receipt' ? receipt : build(receipt || {});
    var out = [
      'AXM EVIDENCE DESK — ACTION REPORT',
      'Generated: ' + r.generated,
      'Title: ' + (r.title || '(missing)'),
      'Goal: ' + (r.goal || '(missing)'),
      'Actor: ' + r.actor.id + ' [' + r.actor.type + ']',
      'Source checkpoint: ' + (r.source_checkpoint || '(not named)'),
      'Truth status: ' + r.status,
      'Integrity: ' + (r.integrity && r.integrity.state || 'UNSEALED') + ' · ' + (r.integrity && r.integrity.digest || 'no digest'),
      '', 'COUNTS',
      '- claims passed: ' + r.counts.claims_passed,
      '- claims failed: ' + r.counts.claims_failed,
      '- claims open: ' + r.counts.claims_unknown,
      '- actions executed: ' + r.counts.actions_executed,
      '- checks passed with evidence: ' + r.counts.checks_passed,
      '- checks failed with evidence: ' + r.counts.checks_failed,
      '- checks open or missing evidence: ' + r.counts.checks_not_run,
      '- changed paths: ' + r.counts.changes,
      '', 'CLAIMS AND EVIDENCE ROUTES'
    ];
    out = out.concat(linesFor(r.observations, function (claim) {
      return '- [' + claim.effective_verdict + '] ' + claim.claim + '\n  kind: ' + claim.kind + ' · risk: ' + claim.risk + '\n  pass condition: ' + (claim.pass_condition || '(open)') + '\n  evidence surface: ' + claim.primary_surface + '\n  observed evidence: ' + (claim.observed_evidence || '(not observed)') + '\n  what would show this is wrong: ' + (claim.counterevidence || '(open)') + '\n  source: ' + (claim.source_kind || 'UNSOURCED') + ' / ' + (claim.source || 'UNSOURCED') + (claim.named_seam ? '\n  named seam: ' + claim.named_seam : '');
    }, '- none recorded'));
    out.push('', 'ACTIONS');
    out = out.concat(linesFor(r.actions, function (a) { return '- ' + a.action + ' -> ' + (a.target || '(no target)') + ' | result: ' + (a.result || '(not recorded)') + ' | evidence: ' + (a.evidence || '(none)'); }, '- none recorded'));
    out.push('', 'CHECKS');
    out = out.concat(linesFor(r.checks, function (c) { return '- [' + c.effective_status + '] ' + c.name + ' | declared: ' + c.status + ' | evidence: ' + (c.evidence || '(not supplied)'); }, '- none recorded'));
    out.push('', 'CHANGES');
    out = out.concat(linesFor(r.changes, function (c) { return '- ' + (c.path || '(unnamed)') + ' [' + c.kind + '] ' + c.summary; }, '- none recorded'));
    out.push('', 'LIMITATIONS / NOT TESTED');
    out = out.concat(linesFor(r.limitations, function (x) { return '- ' + x; }, '- none recorded (WARNING)'));
    out.push('', 'NEXT ACTIONS');
    out = out.concat(linesFor(r.next_actions, function (x) { return '- ' + x; }, '- none recorded'));
    out.push('', 'WARNINGS');
    out = out.concat(linesFor(r.warnings, function (x) { return '- ' + x; }, '- none'));
    out.push('', 'TRUTH BOUNDARY', '- Receipt generation records supplied evidence; it does not independently inspect or verify the world.', '- An UNKNOWN claim remains open. A PASS check without evidence remains NOT_RUN.', '- A SHA-256 seal detects changed receipt content; it does not prove that the supplied evidence is true.', '- Knowledge Canvas inbox placement is not receiver acceptance.', '- CANON is never assigned by this module.');
    return out.join('\n');
  }
  function packetDigestContent(packet) {
    var copy = clone(packet);
    delete copy.digest;
    return copy;
  }
  async function knowledgePacket(receipt, opts) {
    opts = opts || {};
    var integrity = await verify(receipt);
    if (!integrity.ok) throw new Error('A valid sealed receipt is required before handoff preview.');
    var digest = receipt.integrity.digest;
    var items = receipt.observations.map(function (claim, index) {
      return {
        title: receipt.title + ' · claim ' + (index + 1),
        claim: claim.claim,
        source: claim.source || receipt.source_checkpoint,
        citation: [claim.kind, claim.primary_surface, claim.source_kind].filter(Boolean).join(' · '),
        kind: 'evidence',
        status: claim.effective_verdict === 'FAIL' ? 'disputed' : (claim.effective_verdict === 'PASS' && (claim.source || receipt.source_checkpoint) ? 'sourced' : 'draft'),
        evidenceVerdict: claim.effective_verdict,
        evidenceRoute: claim.primary_surface
      };
    });
    if (!items.length) items.push({
      title: receipt.title || 'Evidence Desk receipt', claim: receipt.goal || 'Receipt created without claims',
      source: receipt.source_checkpoint, citation: digest, kind: 'evidence', status: 'draft',
      evidenceVerdict: 'UNKNOWN', evidenceRoute: 'declared-evidence'
    });
    var packet = {
      schema: KNOWLEDGE_SCHEMA,
      handoffId: 'evidence-' + digest.slice(7, 23),
      origin: 'Evidence Desk', createdAt: opts.now || new Date().toISOString(),
      sourceReceipt: { schema: RECEIPT_SCHEMA, digest: digest, status: receipt.status },
      deliveryState: 'PREVIEWED', receiverAcceptance: 'PENDING', items: items
    };
    packet.digest = 'sha256:' + await sha256(stable(packetDigestContent(packet)));
    return packet;
  }
  async function verifyKnowledgePacket(packet) {
    if (!packet || packet.schema !== KNOWLEDGE_SCHEMA || !/^sha256:[a-f0-9]{64}$/.test(text(packet.digest))) {
      return { ok: false, state: 'INVALID', expected: packet && packet.digest || null, actual: null };
    }
    var actual = 'sha256:' + await sha256(stable(packetDigestContent(packet)));
    return { ok: packet.digest === actual, state: packet.digest === actual ? 'MATCH' : 'MISMATCH', expected: packet.digest, actual: actual };
  }
  function handoffReceipt(packet, deliveryState, opts) {
    opts = opts || {};
    return {
      schema: HANDOFF_SCHEMA,
      handoffId: packet && packet.handoffId || null,
      packetDigest: packet && packet.digest || null,
      deliveryState: deliveryState,
      receiverAcceptance: 'PENDING',
      proof: opts.proof || null,
      recordedAt: opts.now || new Date().toISOString(),
      truth: {
        inboxWriteProven: deliveryState === 'INBOX_WRITTEN',
        receiverAcceptanceProven: false,
        knowledgeImportedProven: false
      }
    };
  }

  return {
    VERSION: '2.0.0', RECEIPT_SCHEMA: RECEIPT_SCHEMA, INPUT_SCHEMA: INPUT_SCHEMA,
    KNOWLEDGE_SCHEMA: KNOWLEDGE_SCHEMA, HANDOFF_SCHEMA: HANDOFF_SCHEMA,
    CLAIM_KINDS: CLAIM_KINDS.slice(), CLAIM_ROUTES: clone(CLAIM_ROUTES),
    normalize: normalize, validate: validate, build: build, seal: seal, verify: verify,
    report: report, stable: stable, sha256: sha256,
    knowledgePacket: knowledgePacket, verifyKnowledgePacket: verifyKnowledgePacket, handoffReceipt: handoffReceipt
  };
});
