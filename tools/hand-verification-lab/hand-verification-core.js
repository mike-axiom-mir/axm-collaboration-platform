(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHandVerificationCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SPEC_SCHEMA = 'axm.missing-hand-specification/v1';
  var SPEC_CAPABILITY = 'capability.specify.missing-hand/v1';
  var PLAN_SCHEMA = 'axm.hand-verification-plan/v1';
  var RECEIPT_SCHEMA = 'axm.hand-verification-receipt/v1';
  var CAPABILITY = 'capability.verify.missing-hand/v1';
  var MAX_SOURCE_LENGTH = 250000;
  var VERDICTS = ['PASS', 'FAIL', 'UNKNOWN', 'NOT_RUN'];
  var REQUIRED_TEXT = [
    'purpose', 'resourceBudget', 'failureAndRecovery',
    'compatibilityVersionContract', 'verificationContract', 'promotionGate'
  ];
  var REQUIRED_LISTS = [
    'inputsAndSchemas', 'outputsAndSchemas', 'sideEffects', 'permissionsAndConsent'
  ];

  var EXAMPLE_SPECIFICATION = {
    schema: SPEC_SCHEMA,
    capability: SPEC_CAPABILITY,
    capabilityId: 'evidence.archive.persist/v1',
    gapType: 'AUTHORITY',
    status: 'DRAFT',
    purpose: 'Define a bounded archive hand that preserves selected evidence receipts without inheriting release or deletion authority.',
    inputsAndSchemas: [
      'axm.evidence-receipt/v1 selected by the human operator',
      'explicit archive target descriptor with owner and retention policy'
    ],
    outputsAndSchemas: [
      'axm.evidence-archive-receipt/v1 with source digest and target identifier',
      'typed refusal when target authority or retention policy is absent'
    ],
    sideEffects: [
      'append one digest-bound receipt to the explicitly selected archive target',
      'never rewrite or delete an existing archive entry'
    ],
    permissionsAndConsent: [
      'human selects the exact archive target for each operation',
      'write authority is limited to that target and does not transfer to callers'
    ],
    resourceBudget: 'At most 10 MB per operation, 1,000 receipt records, and 5 seconds of local processing before a visible timeout refusal.',
    failureAndRecovery: 'Write to a temporary candidate, verify its digest, then append atomically; on failure preserve the source and return a recovery receipt without retry loops.',
    compatibilityVersionContract: 'Accept axm.evidence-receipt/v1 and emit axm.evidence-archive-receipt/v1; reject unknown major versions while preserving the original input.',
    verificationContract: 'Positive append, duplicate refusal, permission refusal, size-limit refusal, interrupted-write recovery, digest readback, and restart verification against a temporary archive.',
    promotionGate: 'Mike or an explicitly appointed human steward reviews the contract, recovery evidence, retention policy, and one real restore drill before promotion.',
    provenance: {
      sourceSchema: 'axm.capability-gap-report/v1',
      sourceRequirementIds: ['durable-evidence-archive'],
      foundry: 'hand-specification-foundry/v0.1',
      generatedAt: '2026-07-28T19:00:00.000Z'
    },
    truth: {
      implementationNeutral: true,
      installed: false,
      executed: false,
      authorityGranted: false,
      promoted: false,
      canon: false,
      prototypeOrMockClosesGap: false
    }
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function boundedText(value, label, minimum, maximum) {
    var text = String(value == null ? '' : value).trim();
    if (text.length < minimum) throw new Error(label + ' must contain at least ' + minimum + ' characters');
    if (text.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
    return text;
  }

  function boundedOptionalText(value, label, maximum) {
    var text = String(value == null ? '' : value).trim();
    if (text.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
    return text;
  }

  function validDate(value, label) {
    var date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) throw new Error(label + ' must be a valid date');
    return date.toISOString();
  }

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ':' + stableStringify(value[key]);
    }).join(',') + '}';
  }

  function fingerprint(value) {
    var source = stableStringify(value);
    var hash = 2166136261;
    for (var index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return 'fnv1a32:' + ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function normalizeList(value, label) {
    if (!Array.isArray(value) || !value.length) throw new Error(label + ' must be a non-empty array');
    if (value.length > 32) throw new Error(label + ' exceeds 32 entries');
    return value.map(function (entry, index) {
      return boundedText(entry, label + '[' + index + ']', 1, 500);
    });
  }

  function parseSpecification(source) {
    var parsed = source;
    if (typeof source === 'string') {
      var text = source.trim();
      if (!text) throw new Error('hand specification JSON is empty');
      if (text.length > MAX_SOURCE_LENGTH) throw new Error('hand specification JSON exceeds the 250,000 character limit');
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        throw new Error('hand specification JSON is invalid: ' + error.message);
      }
    }
    var errors = [];
    if (!parsed || parsed.schema !== SPEC_SCHEMA) errors.push('schema must be ' + SPEC_SCHEMA);
    if (!parsed || parsed.capability !== SPEC_CAPABILITY) errors.push('capability must be ' + SPEC_CAPABILITY);
    if (!parsed || parsed.status !== 'DRAFT') errors.push('status must remain DRAFT');
    try { boundedText(parsed && parsed.capabilityId, 'capabilityId', 1, 160); }
    catch (error) { errors.push(error.message); }
    REQUIRED_TEXT.forEach(function (field) {
      try { boundedText(parsed && parsed[field], field, 12, 2000); }
      catch (error) { errors.push(error.message); }
    });
    REQUIRED_LISTS.forEach(function (field) {
      try { normalizeList(parsed && parsed[field], field); }
      catch (error) { errors.push(error.message); }
    });
    var truth = parsed && parsed.truth || {};
    if (truth.implementationNeutral !== true) errors.push('truth.implementationNeutral must be true');
    ['installed', 'executed', 'authorityGranted', 'promoted', 'canon', 'prototypeOrMockClosesGap'].forEach(function (field) {
      if (truth[field] !== false) errors.push('truth.' + field + ' must be false');
    });
    if (errors.length) throw new Error('invalid hand specification: ' + errors.join('; '));
    return clone(parsed);
  }

  function caseDefinition(number, family, title, claim, passCondition, counterevidence, evidenceRequired) {
    return {
      id: 'verify-' + String(number).padStart(2, '0'),
      family: family,
      title: title,
      required: true,
      claim: claim,
      passCondition: passCondition,
      counterevidence: counterevidence,
      evidenceRequired: evidenceRequired,
      verdict: 'NOT_RUN'
    };
  }

  function buildPlan(specification, generatedAt) {
    var spec = parseSpecification(specification);
    var id = spec.capabilityId;
    var cases = [
      caseDefinition(1, 'CONTRACT_SCHEMA_IDENTITY', 'Contract and schema identity',
        id + ' accepts and emits only the named schemas in its specification.',
        'A verifier exercises every declared input and checks every produced result against the declared output schema.',
        'An undeclared schema is accepted, a declared schema is refused, or an output fails schema validation.',
        ['verifier transcript', 'input and output schema validation results']),
      caseDefinition(2, 'POSITIVE_HAPPY_PATH', 'Positive path',
        id + ' completes its stated purpose for one valid bounded input.',
        spec.verificationContract,
        'The valid operation fails, produces an incomplete output, or performs an undeclared effect.',
        ['reproducible test command or procedure', 'captured result matched to expected output']),
      caseDefinition(3, 'MALFORMED_INPUT_REFUSAL', 'Malformed and missing input refusal',
        id + ' rejects missing, malformed, oversized and wrong-version inputs without partial success.',
        'Each invalid-input class returns a typed refusal and leaves the source and target state unchanged.',
        'Any invalid input is treated as success, crashes without a bounded receipt, or mutates state.',
        ['negative fixture list', 'refusal results', 'before-and-after state comparison']),
      caseDefinition(4, 'PERMISSION_CONSENT_REFUSAL', 'Permission and consent refusal',
        id + ' operates only inside the declared permission and consent boundary.',
        spec.permissionsAndConsent.join('; '),
        'The hand acts without required consent, inherits broader authority, or treats missing authority as success.',
        ['denied-authority test', 'consent-boundary observation', 'typed refusal result']),
      caseDefinition(5, 'SIDE_EFFECT_CONFINEMENT', 'Side-effect confinement',
        id + ' creates only the declared side effects.',
        spec.sideEffects.join('; '),
        'A filesystem, network, process, persistence, publication or deletion effect occurs outside the specification.',
        ['isolated environment trace', 'before-and-after inventory', 'unexpected-effect scan']),
      caseDefinition(6, 'RESOURCE_BUDGET_BOUNDARY', 'Resource-budget boundary',
        id + ' stays inside its time, size and work budget and refuses excess safely.',
        spec.resourceBudget,
        'The budget is exceeded without refusal, work continues unbounded, or partial effects survive a limit breach.',
        ['boundary fixture measurements', 'over-budget refusal', 'cleanup observation']),
      caseDefinition(7, 'FAILURE_RECOVERY', 'Failure and recovery',
        id + ' fails and recovers according to its declared contract.',
        spec.failureAndRecovery,
        'An interrupted operation corrupts source or target state, loops indefinitely, or lacks a usable recovery receipt.',
        ['fault-injection procedure', 'post-failure state evidence', 'recovery or rollback result']),
      caseDefinition(8, 'COMPATIBILITY_MAJOR_VERSION', 'Compatibility and major-version refusal',
        id + ' honors its version contract and refuses unknown major versions.',
        spec.compatibilityVersionContract,
        'An incompatible major version is silently accepted or a supported version changes behavior without a typed notice.',
        ['supported-version fixture', 'unknown-major fixture', 'compatibility results']),
      caseDefinition(9, 'EVIDENCE_COMPLETENESS', 'Evidence completeness',
        id + ' produces sufficient evidence to inspect the claimed outcome and its boundaries.',
        'Every required verification case has a stable evidence pointer, a concrete observation and a reproducible procedure.',
        'A pass depends on absent, inaccessible, stale, circular or purely asserted evidence.',
        ['evidence manifest', 'freshness and accessibility check', 'claim-to-evidence mapping']),
      caseDefinition(10, 'PROMOTION_CANON_AUTHORITY_HOLD', 'Promotion and CANON authority hold',
        id + ' cannot promote, release, grant authority or change CANON through a test result.',
        spec.promotionGate,
        'Automation changes promotion, release, authority or CANON state, or bypasses the named human gate.',
        ['promotion-state comparison', 'authority-state comparison', 'human gate record when applicable'])
    ];
    return {
      schema: PLAN_SCHEMA,
      capability: CAPABILITY,
      status: 'DRAFT_VERIFICATION_PLAN',
      target: {
        capabilityId: id,
        specificationSchema: SPEC_SCHEMA,
        specificationFingerprint: fingerprint(spec)
      },
      basis: {
        purpose: spec.purpose,
        inputsAndSchemas: clone(spec.inputsAndSchemas),
        outputsAndSchemas: clone(spec.outputsAndSchemas),
        verificationContract: spec.verificationContract
      },
      cases: cases,
      provenance: {
        sourceSpecificationGeneratedAt: spec.provenance && spec.provenance.generatedAt || null,
        lab: 'hand-verification-lab/v0.1',
        generatedAt: validDate(generatedAt, 'generatedAt')
      },
      truth: {
        executesTests: false,
        evidenceRecorded: false,
        runtimeProven: false,
        installed: false,
        authorityGranted: false,
        promoted: false,
        released: false,
        canon: false
      }
    };
  }

  function validatePlan(plan) {
    var errors = [];
    if (!plan || plan.schema !== PLAN_SCHEMA) errors.push('plan schema mismatch');
    if (!plan || plan.capability !== CAPABILITY) errors.push('plan capability mismatch');
    if (!plan || plan.status !== 'DRAFT_VERIFICATION_PLAN') errors.push('plan status must remain DRAFT_VERIFICATION_PLAN');
    if (!plan || !Array.isArray(plan.cases) || plan.cases.length !== 10) errors.push('plan must contain exactly ten verification cases');
    var ids = {};
    (plan && Array.isArray(plan.cases) ? plan.cases : []).forEach(function (testCase, index) {
      if (!testCase || testCase.id !== 'verify-' + String(index + 1).padStart(2, '0')) errors.push('case ' + index + ' id or order mismatch');
      if (!testCase || !testCase.family) errors.push('case ' + index + ' family is missing');
      if (!testCase || testCase.required !== true) errors.push('case ' + index + ' must remain required');
      if (!testCase || testCase.verdict !== 'NOT_RUN') errors.push('case ' + index + ' draft verdict must be NOT_RUN');
      if (testCase && ids[testCase.id]) errors.push('duplicate case id ' + testCase.id);
      if (testCase) ids[testCase.id] = true;
    });
    var truth = plan && plan.truth || {};
    ['executesTests', 'evidenceRecorded', 'runtimeProven', 'installed', 'authorityGranted', 'promoted', 'released', 'canon'].forEach(function (field) {
      if (truth[field] !== false) errors.push('truth.' + field + ' must be false');
    });
    return { pass: errors.length === 0, errors: errors };
  }

  function buildReceipt(plan, observations, generatedAt) {
    var checked = validatePlan(plan);
    if (!checked.pass) throw new Error('invalid verification plan: ' + checked.errors.join('; '));
    if (observations != null && !Array.isArray(observations)) throw new Error('observations must be an array');
    if ((observations || []).length > 100) throw new Error('observations exceed 100 entries');
    var byId = {};
    (observations || []).forEach(function (entry, index) {
      var caseId = boundedText(entry && entry.caseId, 'observation ' + index + ' caseId', 1, 40);
      if (byId[caseId]) throw new Error('duplicate observation for ' + caseId);
      var requested = String(entry && entry.verdict || 'NOT_RUN').toUpperCase();
      if (VERDICTS.indexOf(requested) < 0) throw new Error('invalid verdict for ' + caseId);
      byId[caseId] = {
        requestedVerdict: requested,
        evidencePointer: boundedOptionalText(entry && entry.evidencePointer, caseId + ' evidencePointer', 1000),
        observation: boundedOptionalText(entry && entry.observation, caseId + ' observation', 2000)
      };
    });
    Object.keys(byId).forEach(function (caseId) {
      if (!plan.cases.some(function (testCase) { return testCase.id === caseId; })) {
        throw new Error('observation references unknown case ' + caseId);
      }
    });
    var records = plan.cases.map(function (testCase) {
      var supplied = byId[testCase.id] || { requestedVerdict: 'NOT_RUN', evidencePointer: '', observation: '' };
      var effective = supplied.requestedVerdict;
      var downgradeReason = null;
      if (effective === 'PASS' && (!supplied.evidencePointer || !supplied.observation)) {
        effective = 'UNKNOWN';
        downgradeReason = 'PASS requires both an evidence pointer and a concrete observation';
      }
      return {
        caseId: testCase.id,
        family: testCase.family,
        required: testCase.required,
        requestedVerdict: supplied.requestedVerdict,
        effectiveVerdict: effective,
        evidencePointer: supplied.evidencePointer || null,
        observation: supplied.observation || null,
        downgradeReason: downgradeReason
      };
    });
    var counts = { PASS: 0, FAIL: 0, UNKNOWN: 0, NOT_RUN: 0 };
    records.forEach(function (record) { counts[record.effectiveVerdict] += 1; });
    var overall = counts.FAIL > 0 ? 'FAIL' : (counts.PASS === records.length ? 'PASS' : 'UNKNOWN');
    return {
      schema: RECEIPT_SCHEMA,
      capability: CAPABILITY,
      status: 'OPERATOR_EVIDENCE_RECORDED',
      target: clone(plan.target),
      planFingerprint: fingerprint(plan),
      evidenceAuthority: 'DECLARED_BY_OPERATOR',
      records: records,
      summary: {
        overall: overall,
        counts: counts,
        requiredCases: records.length,
        evidencedPasses: counts.PASS
      },
      provenance: {
        planGeneratedAt: plan.provenance && plan.provenance.generatedAt || null,
        lab: 'hand-verification-lab/v0.1',
        generatedAt: validDate(generatedAt, 'generatedAt')
      },
      truth: {
        operatorDeclarationOnly: true,
        independentVerification: false,
        testsExecutedByLab: false,
        runtimeProven: false,
        installed: false,
        authorityGranted: false,
        promoted: false,
        released: false,
        canon: false
      }
    };
  }

  function downloadName(value, kind) {
    var id = boundedText(value && value.target && value.target.capabilityId, 'target capabilityId', 1, 160)
      .toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return 'axm-hand-verification-' + (kind === 'receipt' ? 'receipt-' : 'plan-') + (id || 'capability') + '.json';
  }

  function example() {
    return clone(EXAMPLE_SPECIFICATION);
  }

  return {
    SPEC_SCHEMA: SPEC_SCHEMA,
    PLAN_SCHEMA: PLAN_SCHEMA,
    RECEIPT_SCHEMA: RECEIPT_SCHEMA,
    CAPABILITY: CAPABILITY,
    VERDICTS: clone(VERDICTS),
    descriptor: {
      id: 'hand-verification-lab',
      capability: CAPABILITY,
      version: '1.0.0',
      status: 'TEST',
      accepts: [SPEC_SCHEMA],
      produces: [PLAN_SCHEMA, RECEIPT_SCHEMA],
      sideEffects: []
    },
    fingerprint: fingerprint,
    parseSpecification: parseSpecification,
    buildPlan: buildPlan,
    validatePlan: validatePlan,
    buildReceipt: buildReceipt,
    downloadName: downloadName,
    example: example
  };
});
