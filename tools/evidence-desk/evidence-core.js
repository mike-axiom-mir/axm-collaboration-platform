(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMEvidenceCore = api;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var CHECK = ['PASS', 'FAIL', 'NOT_RUN'];

  function text(v) { return v == null ? '' : String(v).trim(); }
  function list(v) { return Array.isArray(v) ? v : []; }
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) {
      return JSON.stringify(k) + ':' + stable(v[k]);
    }).join(',') + '}';
    return JSON.stringify(v);
  }
  function fingerprint(v) {
    var s = stable(v), h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }
  function normalizeObservation(v) {
    if (typeof v === 'string') return { claim: text(v), source_kind: '', source: '' };
    v = v || {};
    return { claim: text(v.claim || v.text), source_kind: text(v.source_kind || v.sourceKind), source: text(v.source) };
  }
  function normalizeAction(v) {
    v = v || {};
    return {
      action: text(v.action), target: text(v.target), effect: text(v.effect || 'bounded-local'),
      result: text(v.result), evidence: text(v.evidence)
    };
  }
  function normalizeCheck(v) {
    v = v || {};
    var status = text(v.status).toUpperCase();
    return { name: text(v.name), status: CHECK.indexOf(status) >= 0 ? status : 'NOT_RUN', evidence: text(v.evidence) };
  }
  function normalizeChange(v) {
    v = v || {};
    return { path: text(v.path), kind: text(v.kind || 'modified'), summary: text(v.summary) };
  }
  function normalize(input) {
    input = input || {};
    return {
      format: 'axm-evidence-input', v: 1,
      title: text(input.title), goal: text(input.goal),
      actor: { id: text(input.actor && input.actor.id || input.actor || 'unknown'), type: text(input.actor && input.actor.type || input.actorType || 'unknown') },
      source_checkpoint: text(input.source_checkpoint || input.sourceCheckpoint),
      observations: list(input.observations).map(normalizeObservation).filter(function (x) { return x.claim; }),
      actions: list(input.actions).map(normalizeAction).filter(function (x) { return x.action; }),
      checks: list(input.checks).map(normalizeCheck).filter(function (x) { return x.name; }),
      changes: list(input.changes).map(normalizeChange).filter(function (x) { return x.path || x.summary; }),
      limitations: list(input.limitations).map(text).filter(Boolean),
      next_actions: list(input.next_actions || input.nextActions).map(text).filter(Boolean)
    };
  }
  function validate(input) {
    var n = normalize(input), errors = [], warnings = [];
    if (!n.title) errors.push('title is required');
    if (!n.goal) errors.push('goal is required');
    if (!n.source_checkpoint) warnings.push('source checkpoint is not named');
    n.observations.forEach(function (o, i) {
      if (!o.source_kind || !o.source) warnings.push('observation ' + (i + 1) + ' is unsourced');
    });
    n.actions.forEach(function (a, i) {
      if (!a.result) warnings.push('action ' + (i + 1) + ' has no result');
      if (!a.evidence) warnings.push('action ' + (i + 1) + ' has no evidence');
    });
    if (n.actions.length && !n.checks.length) warnings.push('actions exist but no verification checks were supplied');
    if (!n.limitations.length) warnings.push('no limitations/not-tested scope recorded');
    return { ok: errors.length === 0, errors: errors, warnings: warnings, normalized: n };
  }
  function deriveStatus(n) {
    var failed = n.checks.some(function (c) { return c.status === 'FAIL'; });
    var notRun = n.checks.some(function (c) { return c.status === 'NOT_RUN'; });
    if (failed) return 'CHECKS_FAILED';
    if (n.actions.length && n.checks.length && !notRun) return 'VERIFIED_WITH_RECORDED_SCOPE';
    if (n.actions.length) return 'EXECUTED_NOT_FULLY_VERIFIED';
    if (n.observations.length) return 'OBSERVED_ONLY';
    return 'DRAFT';
  }
  function build(input, opts) {
    opts = opts || {};
    var v = validate(input), n = v.normalized;
    var counts = {
      observations: n.observations.length,
      actions_executed: n.actions.length,
      checks_passed: n.checks.filter(function (c) { return c.status === 'PASS'; }).length,
      checks_failed: n.checks.filter(function (c) { return c.status === 'FAIL'; }).length,
      checks_not_run: n.checks.filter(function (c) { return c.status === 'NOT_RUN'; }).length,
      changes: n.changes.length
    };
    var truth = {
      claimed_done: false,
      execution_is_verification: false,
      fully_verified: n.actions.length > 0 && n.checks.length > 0 && counts.checks_failed === 0 && counts.checks_not_run === 0
    };
    var body = {
      format: 'axm-evidence-receipt', v: 1,
      title: n.title, goal: n.goal, actor: n.actor, source_checkpoint: n.source_checkpoint,
      status: deriveStatus(n), counts: counts, truth: truth,
      observations: n.observations, actions: n.actions, checks: n.checks, changes: n.changes,
      limitations: n.limitations, next_actions: n.next_actions,
      warnings: v.warnings, validation_errors: v.errors
    };
    var receipt = Object.assign({ generated: opts.now || new Date().toISOString() }, body);
    receipt.fingerprint = { algorithm: 'fnv1a32-portable-not-security', value: fingerprint(body) };
    return receipt;
  }
  function linesFor(items, fn, empty) {
    return items.length ? items.map(fn) : [empty];
  }
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
      'Fingerprint: ' + r.fingerprint.value + ' (' + r.fingerprint.algorithm + ')',
      '', 'COUNTS',
      '- observations: ' + r.counts.observations,
      '- actions executed: ' + r.counts.actions_executed,
      '- checks passed: ' + r.counts.checks_passed,
      '- checks failed: ' + r.counts.checks_failed,
      '- checks not run: ' + r.counts.checks_not_run,
      '- changed paths: ' + r.counts.changes,
      '', 'OBSERVATIONS'
    ];
    out = out.concat(linesFor(r.observations, function (o) { return '- ' + o.claim + ' | source: ' + (o.source_kind || 'UNSOURCED') + ' / ' + (o.source || 'UNSOURCED'); }, '- none recorded'));
    out.push('', 'ACTIONS');
    out = out.concat(linesFor(r.actions, function (a) { return '- ' + a.action + ' -> ' + (a.target || '(no target)') + ' | result: ' + (a.result || '(not recorded)') + ' | evidence: ' + (a.evidence || '(none)'); }, '- none recorded'));
    out.push('', 'CHECKS');
    out = out.concat(linesFor(r.checks, function (c) { return '- [' + c.status + '] ' + c.name + (c.evidence ? ' | ' + c.evidence : ''); }, '- none recorded'));
    out.push('', 'CHANGES');
    out = out.concat(linesFor(r.changes, function (c) { return '- ' + (c.path || '(unnamed)') + ' [' + c.kind + '] ' + c.summary; }, '- none recorded'));
    out.push('', 'LIMITATIONS / NOT TESTED');
    out = out.concat(linesFor(r.limitations, function (x) { return '- ' + x; }, '- none recorded (WARNING)'));
    out.push('', 'NEXT ACTIONS');
    out = out.concat(linesFor(r.next_actions, function (x) { return '- ' + x; }, '- none recorded'));
    out.push('', 'WARNINGS');
    out = out.concat(linesFor(r.warnings, function (x) { return '- ' + x; }, '- none'));
    out.push('', 'NO FAKE DONE', '- Receipt generation records supplied evidence; it does not independently inspect or verify the world.', '- CANON is never assigned by this module.');
    return out.join('\n');
  }

  return { VERSION: '1.0.0', normalize: normalize, validate: validate, build: build, report: report, fingerprint: fingerprint };
});
