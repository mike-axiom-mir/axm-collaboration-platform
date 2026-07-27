(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') root.AXMVerificationSpine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RECEIPT_SCHEMA = 'axm.verification-receipt/v2';
  const FAILURE_SCHEMA = 'axm.verifier-failure-memory/v1';
  const REPORT_SCHEMA = 'axm.verification-spine-report/v2';
  const CLAIM_STATUSES = ['PASS', 'FAIL', 'WARNING', 'UNKNOWN', 'MISSING_VALIDATOR', 'HUMAN_REVIEW', 'NOT_APPLICABLE'];
  const LIFECYCLES = ['candidate', 'active', 'monitor', 'manual-review', 'retired'];
  const RISKS = ['low', 'medium', 'high'];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function text(value, maximum) {
    const compact = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    return maximum && compact.length > maximum ? compact.slice(0, maximum - 1) + '…' : compact;
  }
  function slug(value) {
    return text(value, 120).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed';
  }
  function now(value) { return String(value || new Date().toISOString()); }

  function validateReceipt(receipt, knownCategories) {
    const errors = [];
    if (!receipt || typeof receipt !== 'object') return { pass: false, errors: ['receipt is not an object'] };
    if (receipt.schema !== RECEIPT_SCHEMA) errors.push('receipt schema must be ' + RECEIPT_SCHEMA);
    if (!text(receipt.id)) errors.push('receipt id is required');
    if (!receipt.verifier || !text(receipt.verifier.id) || !text(receipt.verifier.version) || !text(receipt.verifier.category)) errors.push('verifier id, version and category are required');
    if (knownCategories && receipt.verifier && knownCategories.indexOf(receipt.verifier.category) < 0) errors.push('unknown verifier category: ' + receipt.verifier.category);
    if (!receipt.subject || !text(receipt.subject.id) || !text(receipt.subject.kind)) errors.push('subject id and kind are required');
    if (!text(receipt.target_profile)) errors.push('target_profile is required');
    if (!Array.isArray(receipt.claims) || !receipt.claims.length) errors.push('at least one atomic claim is required');
    (receipt.claims || []).forEach(function (claim, index) {
      if (!text(claim.id)) errors.push('claim ' + index + ' id is required');
      if (CLAIM_STATUSES.indexOf(claim.status) < 0) errors.push('claim ' + index + ' has unsupported status');
      if (typeof claim.required !== 'boolean') errors.push('claim ' + index + ' required must be boolean');
      if (RISKS.indexOf(claim.risk) < 0) errors.push('claim ' + index + ' risk is unsupported');
      if (!Array.isArray(claim.evidence)) errors.push('claim ' + index + ' evidence must be an array');
    });
    if (!text(receipt.created_at)) errors.push('created_at is required');
    return { pass: errors.length === 0, errors: errors };
  }

  function createReceipt(input) {
    input = input || {};
    return {
      schema: RECEIPT_SCHEMA,
      id: text(input.id) || 'receipt-' + slug((input.verifier && input.verifier.id) || 'unknown') + '-' + slug((input.subject && input.subject.id) || 'subject'),
      verifier: {
        id: text(input.verifier && input.verifier.id) || 'unknown-verifier',
        version: text(input.verifier && input.verifier.version) || '0',
        category: text(input.verifier && input.verifier.category) || 'foundation'
      },
      subject: {
        id: text(input.subject && input.subject.id) || 'unknown-subject',
        kind: text(input.subject && input.subject.kind) || 'unknown',
        version: text(input.subject && input.subject.version),
        digest: text(input.subject && input.subject.digest)
      },
      target_profile: text(input.target_profile) || 'workshop-full',
      claims: clone(input.claims || []),
      limitations: clone(input.limitations || []),
      created_at: now(input.created_at)
    };
  }

  function claimKey(receipt, claim) {
    return receipt.subject.id + '|' + receipt.target_profile + '|' + claim.id;
  }

  function resolveReceipts(receipts, profile, registry) {
    receipts = Array.isArray(receipts) ? receipts : [];
    profile = profile || { id: 'workshop-full', required_categories: [], conflict_rules: [] };
    const knownCategories = registry && registry.categories ? registry.categories.map(function (entry) { return entry.id; }) : null;
    const invalid = [];
    const claims = [];
    const categories = {};
    receipts.forEach(function (receipt) {
      const checked = validateReceipt(receipt, knownCategories);
      if (!checked.pass) { invalid.push({ receipt_id: receipt && receipt.id || 'unknown', errors: checked.errors }); return; }
      categories[receipt.verifier.category] = categories[receipt.verifier.category] || { id: receipt.verifier.category, receipts: 0, claims: 0, statuses: {} };
      categories[receipt.verifier.category].receipts++;
      receipt.claims.forEach(function (claim) {
        const row = { receipt: receipt, claim: claim, key: claimKey(receipt, claim) };
        claims.push(row);
        categories[receipt.verifier.category].claims++;
        categories[receipt.verifier.category].statuses[claim.status] = (categories[receipt.verifier.category].statuses[claim.status] || 0) + 1;
      });
    });

    const missingCategories = (profile.required_categories || []).filter(function (id) { return !categories[id]; });
    const conflicts = [];
    const conflictingKeys = {};
    const byKey = {};
    claims.forEach(function (row) { (byKey[row.key] = byKey[row.key] || []).push(row); });
    Object.keys(byKey).forEach(function (key) {
      const rows = byKey[key];
      const statuses = rows.map(function (row) { return row.claim.status; });
      if (statuses.indexOf('PASS') >= 0 && statuses.indexOf('FAIL') >= 0) {
        conflictingKeys[key] = true;
        conflicts.push({ id: 'claim-contradiction', claim_key: key, reason: 'Independent verifiers disagree on the same claim, subject, target profile and version context.', receipts: rows.map(function (row) { return row.receipt.id; }) });
      }
    });
    (profile.conflict_rules || []).forEach(function (rule) {
      const matched = (rule.when_all || []).every(function (condition) {
        return claims.some(function (row) { return row.claim.id === condition.claim_id && row.claim.status === condition.status; });
      });
      if (matched) conflicts.push({ id: rule.id, reason: rule.reason, conditions: clone(rule.when_all || []) });
    });

    const failures = [], holds = [], reviews = [], warnings = [];
    invalid.forEach(function (entry) { holds.push({ kind: 'invalid-receipt', detail: entry }); });
    missingCategories.forEach(function (id) { holds.push({ kind: 'missing-category', category: id }); });
    claims.forEach(function (row) {
      const claim = row.claim;
      if (conflictingKeys[row.key]) return;
      const item = { receipt_id: row.receipt.id, category: row.receipt.verifier.category, claim_id: claim.id, summary: claim.summary || '' };
      if (claim.status === 'FAIL') (claim.required ? failures : warnings).push(item);
      else if (claim.status === 'MISSING_VALIDATOR' || claim.status === 'UNKNOWN') (claim.required ? holds : warnings).push(item);
      else if (claim.status === 'HUMAN_REVIEW') reviews.push(item);
      else if (claim.status === 'WARNING') warnings.push(item);
    });
    conflicts.forEach(function (conflict) { holds.push({ kind: 'conflict', detail: conflict }); });

    let verdict = 'VERIFIED';
    if (failures.length) verdict = 'FAILED';
    else if (holds.length) verdict = 'HELD';
    else if (reviews.length) verdict = 'HUMAN_REVIEW';
    else if (warnings.length) verdict = 'VERIFIED_WITH_LIMITS';
    return {
      schema: REPORT_SCHEMA,
      version: '2.0.0',
      profile: { id: profile.id, name: profile.name || profile.id },
      verdict: verdict,
      categories: Object.keys(categories).sort().map(function (id) { return categories[id]; }),
      missing_categories: missingCategories,
      conflicts: conflicts,
      failures: failures,
      holds: holds,
      human_reviews: reviews,
      warnings: warnings,
      invalid_receipts: invalid,
      receipt_count: receipts.length,
      claim_count: claims.length
    };
  }

  function validateFailure(lesson, knownCategories, knownProfiles) {
    const errors = [];
    if (!lesson || typeof lesson !== 'object') return { pass: false, errors: ['failure lesson is not an object'] };
    if (lesson.schema !== FAILURE_SCHEMA) errors.push('failure schema must be ' + FAILURE_SCHEMA);
    ['id', 'category', 'title', 'claim_id', 'target_profile', 'created_at', 'updated_at'].forEach(function (field) { if (!text(lesson[field])) errors.push(field + ' is required'); });
    if (knownCategories && knownCategories.indexOf(lesson.category) < 0) errors.push('unknown failure category: ' + lesson.category);
    if (knownProfiles && knownProfiles.indexOf(lesson.target_profile) < 0) errors.push('unknown failure target profile: ' + lesson.target_profile);
    if (RISKS.indexOf(lesson.risk) < 0) errors.push('failure risk is unsupported');
    if (LIFECYCLES.indexOf(lesson.lifecycle) < 0) errors.push('failure lifecycle is unsupported');
    if (!lesson.source || !text(lesson.source.summary) || !text(lesson.source.observed_at)) errors.push('compact source summary and observed_at are required');
    if (lesson.source && text(lesson.source.summary).length > 500) errors.push('source summary exceeds compact memory budget');
    if (!lesson.evidence_route || !text(lesson.evidence_route.kind) || !text(lesson.evidence_route.pass_condition) || !text(lesson.evidence_route.primary_surface)) errors.push('evidence route kind, pass condition and primary surface are required');
    if (!Array.isArray(lesson.revisions)) errors.push('revisions must be an array');
    return { pass: errors.length === 0, errors: errors };
  }

  function createFailureCandidate(input) {
    input = input || {};
    const at = now(input.at);
    const title = text(input.title, 160) || 'Unclassified verifier failure';
    return {
      schema: FAILURE_SCHEMA,
      id: text(input.id) || 'failure-' + slug(input.category || 'foundation') + '-' + slug(input.claim_id || title) + '-' + at.replace(/[^0-9]/g, '').slice(0, 14),
      category: text(input.category) || 'foundation',
      title: title,
      claim_id: text(input.claim_id) || 'failure.' + slug(title),
      target_profile: text(input.target_profile) || 'workshop-full',
      risk: RISKS.indexOf(input.risk) >= 0 ? input.risk : 'medium',
      lifecycle: 'candidate',
      source: {
        summary: text(input.source_summary || input.summary || title, 500),
        observed_at: now(input.observed_at || at),
        receipt_id: text(input.receipt_id, 120),
        digest: text(input.digest, 128)
      },
      evidence_route: {
        kind: text(input.evidence_kind) || 'deterministic-behavior',
        pass_condition: text(input.pass_condition, 500) || 'A bounded reproduction no longer produces the observed failure.',
        primary_surface: text(input.primary_surface, 240) || 'focused regression check',
        counterevidence: text(input.counterevidence, 500)
      },
      check: input.check ? clone(input.check) : null,
      revisions: [],
      created_at: at,
      updated_at: at
    };
  }

  function reviseFailure(lesson, changes, meta) {
    const next = clone(lesson);
    changes = changes || {}; meta = meta || {};
    const allowed = ['category', 'title', 'claim_id', 'target_profile', 'risk', 'lifecycle', 'evidence_route', 'check'];
    const before = {};
    allowed.forEach(function (field) {
      if (Object.prototype.hasOwnProperty.call(changes, field)) {
        before[field] = clone(next[field]);
        next[field] = clone(changes[field]);
      }
    });
    const at = now(meta.at);
    next.revisions = Array.isArray(next.revisions) ? next.revisions : [];
    next.revisions.push({ at: at, by: text(meta.by) || 'steward', reason: text(meta.reason, 500) || 'failure lesson revised', before: before, after: clone(changes) });
    next.updated_at = at;
    return next;
  }

  function evaluateFailureMemory(memory, evaluator, context) {
    memory = Array.isArray(memory) ? memory : [];
    context = context || {};
    const knownCategories = context.categories || null;
    const knownProfiles = context.profiles || null;
    return memory.map(function (lesson) {
      const checked = validateFailure(lesson, knownCategories, knownProfiles);
      if (!checked.pass) return { lesson_id: lesson && lesson.id || 'unknown', category: lesson && lesson.category || 'foundation', lifecycle: lesson && lesson.lifecycle || 'candidate', status: 'UNKNOWN', blocking: true, errors: checked.errors, detail: 'invalid failure-memory record' };
      if (lesson.lifecycle === 'candidate') return { lesson_id: lesson.id, category: lesson.category, lifecycle: lesson.lifecycle, status: 'CANDIDATE', blocking: false, detail: 'awaiting reproduction and steward promotion' };
      if (lesson.lifecycle === 'retired') return { lesson_id: lesson.id, category: lesson.category, lifecycle: lesson.lifecycle, status: 'NOT_APPLICABLE', blocking: false, detail: 'retired with history preserved' };
      if (lesson.lifecycle === 'manual-review') return { lesson_id: lesson.id, category: lesson.category, lifecycle: lesson.lifecycle, status: 'HUMAN_REVIEW', blocking: false, detail: lesson.evidence_route.pass_condition };
      if (!lesson.check || typeof evaluator !== 'function') return { lesson_id: lesson.id, category: lesson.category, lifecycle: lesson.lifecycle, status: 'MISSING_VALIDATOR', blocking: lesson.lifecycle === 'active', detail: 'active lesson has no executable bounded check' };
      let result;
      try { result = evaluator(lesson.check); }
      catch (error) { result = { ok: false, detail: 'check error: ' + error.message }; }
      return {
        lesson_id: lesson.id,
        category: lesson.category,
        lifecycle: lesson.lifecycle,
        status: result.ok ? 'PASS' : 'FAIL',
        blocking: !result.ok && lesson.lifecycle === 'active',
        detail: text(result.detail || result.label || '', 500),
        check_id: lesson.check.id || ''
      };
    });
  }

  function failureResultsToReceipts(results, memory, targetProfile, at) {
    const lessons = {};
    (memory || []).forEach(function (lesson) { lessons[lesson.id] = lesson; });
    const grouped = {};
    (results || []).forEach(function (result) { (grouped[result.category] = grouped[result.category] || []).push(result); });
    return Object.keys(grouped).sort().map(function (category) {
      return createReceipt({
        id: 'failure-memory-' + category,
        verifier: { id: 'axm-failure-memory', version: '1.0.0', category: category },
        subject: { id: 'workshop-regression-memory', kind: 'failure-memory' },
        target_profile: targetProfile || 'workshop-full',
        claims: grouped[category].map(function (result) {
          const lesson = lessons[result.lesson_id] || {};
          let status = result.status;
          if (status === 'CANDIDATE') status = 'NOT_APPLICABLE';
          if (lesson.lifecycle === 'monitor' && status === 'FAIL') status = 'WARNING';
          return {
            id: 'regression.' + (lesson.claim_id || result.lesson_id),
            status: status,
            required: result.blocking === true,
            risk: RISKS.indexOf(lesson.risk) >= 0 ? lesson.risk : 'medium',
            summary: lesson.title || result.detail,
            evidence: [{ kind: lesson.evidence_route && lesson.evidence_route.kind || 'unknown', detail: result.detail }],
            limitations: result.errors || []
          };
        }),
        created_at: at
      });
    });
  }

  return {
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    FAILURE_SCHEMA: FAILURE_SCHEMA,
    REPORT_SCHEMA: REPORT_SCHEMA,
    CLAIM_STATUSES: CLAIM_STATUSES.slice(),
    LIFECYCLES: LIFECYCLES.slice(),
    RISKS: RISKS.slice(),
    validateReceipt: validateReceipt,
    createReceipt: createReceipt,
    resolveReceipts: resolveReceipts,
    validateFailure: validateFailure,
    createFailureCandidate: createFailureCandidate,
    reviseFailure: reviseFailure,
    evaluateFailureMemory: evaluateFailureMemory,
    failureResultsToReceipts: failureResultsToReceipts,
    compactText: text
  };
});
