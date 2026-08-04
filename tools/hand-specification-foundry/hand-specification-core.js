(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AXMHandSpecificationCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var REPORT_SCHEMA = 'axm.capability-gap-report/v1';
  var SPEC_SCHEMA = 'axm.missing-hand-specification/v1';
  var CAPABILITY = 'capability.specify.missing-hand/v1';
  var GAP_TYPES = ['HAND', 'SKILL', 'AUTHORITY', 'SUBSTRATE', 'EVIDENCE', 'CONTRACT', 'UNKNOWN'];
  var MAX_SOURCE_LENGTH = 250000;
  var LIST_FIELDS = ['inputsAndSchemas', 'outputsAndSchemas', 'sideEffects', 'permissionsAndConsent'];
  var TEXT_FIELDS = ['purpose', 'resourceBudget', 'failureAndRecovery', 'compatibilityVersionContract', 'verificationContract', 'promotionGate'];

  var EXAMPLE_REPORT = {
    schema: REPORT_SCHEMA,
    overall: 'DEGRADED',
    missingCapabilities: ['evidence.archive.persist/v1'],
    proposedContracts: [
      {
        capabilityId: 'evidence.archive.persist/v1',
        gapType: 'AUTHORITY',
        requiredBy: ['durable-evidence-archive'],
        contractState: 'SPEC_REQUIRED',
        requiredFields: ['inputs', 'outputs', 'sideEffects', 'permissions', 'resourceBudget', 'failureRecovery', 'compatibility', 'verification']
      }
    ],
    automaticInstall: false,
    automaticPermission: false,
    automaticQualityReduction: false
  };

  var EXAMPLE_DRAFT = {
    capabilityId: 'evidence.archive.persist/v1',
    gapType: 'AUTHORITY',
    sourceRequirementIds: ['durable-evidence-archive'],
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
    promotionGate: 'Mike or an explicitly appointed human steward reviews the contract, recovery evidence, retention policy, and one real restore drill before promotion.'
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

  function normalizeLines(value, label, required) {
    var rows = Array.isArray(value) ? value : String(value == null ? '' : value).split(/\r?\n/);
    var seen = {};
    var normalized = [];
    rows.forEach(function (row) {
      var text = String(row == null ? '' : row).trim();
      if (!text || seen[text]) return;
      if (text.length > 500) throw new Error(label + ' entries must not exceed 500 characters');
      seen[text] = true;
      normalized.push(text);
    });
    if (required && !normalized.length) throw new Error(label + ' needs at least one explicit entry');
    if (normalized.length > 32) throw new Error(label + ' exceeds 32 entries');
    return normalized;
  }

  function parseGapReport(source) {
    var parsed = source;
    if (typeof source === 'string') {
      var text = source.trim();
      if (!text) throw new Error('gap report JSON is empty');
      if (text.length > MAX_SOURCE_LENGTH) throw new Error('gap report JSON exceeds the 250,000 character limit');
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        throw new Error('gap report JSON is invalid: ' + error.message);
      }
    }
    if (!parsed || parsed.schema !== REPORT_SCHEMA) throw new Error('gap report schema must be ' + REPORT_SCHEMA);
    if (!Array.isArray(parsed.proposedContracts)) throw new Error('gap report needs a proposedContracts array');
    if (parsed.proposedContracts.length > 200) throw new Error('gap report exceeds 200 proposed contracts');
    parsed.proposedContracts.forEach(function (contract, index) {
      boundedText(contract && contract.capabilityId, 'proposed contract ' + index + ' capabilityId', 1, 160);
      if (GAP_TYPES.indexOf(String(contract.gapType || 'UNKNOWN').toUpperCase()) < 0) {
        throw new Error('proposed contract ' + index + ' has an invalid gapType');
      }
    });
    return clone(parsed);
  }

  function listCandidates(report) {
    return parseGapReport(report).proposedContracts.map(function (contract) {
      return {
        capabilityId: String(contract.capabilityId).trim(),
        gapType: String(contract.gapType || 'UNKNOWN').toUpperCase(),
        requiredBy: normalizeLines(contract.requiredBy || [], 'requiredBy', false),
        contractState: String(contract.contractState || 'SPEC_REQUIRED')
      };
    });
  }

  function seedFromGapReport(report, capabilityId) {
    var candidates = listCandidates(report);
    var selected = candidates.find(function (candidate) { return candidate.capabilityId === capabilityId; });
    if (!selected) throw new Error('selected capability is not present in the gap report');
    return {
      capabilityId: selected.capabilityId,
      gapType: selected.gapType,
      sourceRequirementIds: selected.requiredBy,
      purpose: '',
      inputsAndSchemas: [],
      outputsAndSchemas: [],
      sideEffects: [],
      permissionsAndConsent: [],
      resourceBudget: '',
      failureAndRecovery: '',
      compatibilityVersionContract: '',
      verificationContract: '',
      promotionGate: ''
    };
  }

  function validateDraft(draft) {
    var errors = [];
    var normalized = {};
    try { normalized.capabilityId = boundedText(draft && draft.capabilityId, 'capabilityId', 1, 160); }
    catch (error) { errors.push(error.message); }
    normalized.gapType = String(draft && draft.gapType || 'UNKNOWN').toUpperCase();
    if (GAP_TYPES.indexOf(normalized.gapType) < 0) errors.push('gapType must be one of ' + GAP_TYPES.join(', '));
    try { normalized.sourceRequirementIds = normalizeLines(draft && draft.sourceRequirementIds || [], 'sourceRequirementIds', false); }
    catch (error) { errors.push(error.message); }
    LIST_FIELDS.forEach(function (field) {
      try { normalized[field] = normalizeLines(draft && draft[field], field, true); }
      catch (error) { errors.push(error.message); }
    });
    TEXT_FIELDS.forEach(function (field) {
      try { normalized[field] = boundedText(draft && draft[field], field, 12, 2000); }
      catch (error) { errors.push(error.message); }
    });
    return { pass: errors.length === 0, errors: errors, normalized: normalized };
  }

  function buildSpecification(draft, generatedAt) {
    var checked = validateDraft(draft);
    if (!checked.pass) throw new Error('invalid hand draft: ' + checked.errors.join('; '));
    var at = generatedAt ? new Date(generatedAt) : new Date();
    if (Number.isNaN(at.getTime())) throw new Error('generatedAt must be a valid date');
    var value = checked.normalized;
    return {
      schema: SPEC_SCHEMA,
      capability: CAPABILITY,
      capabilityId: value.capabilityId,
      gapType: value.gapType,
      status: 'DRAFT',
      purpose: value.purpose,
      inputsAndSchemas: value.inputsAndSchemas,
      outputsAndSchemas: value.outputsAndSchemas,
      sideEffects: value.sideEffects,
      permissionsAndConsent: value.permissionsAndConsent,
      resourceBudget: value.resourceBudget,
      failureAndRecovery: value.failureAndRecovery,
      compatibilityVersionContract: value.compatibilityVersionContract,
      verificationContract: value.verificationContract,
      promotionGate: value.promotionGate,
      provenance: {
        sourceSchema: REPORT_SCHEMA,
        sourceRequirementIds: value.sourceRequirementIds,
        foundry: 'hand-specification-foundry/v0.1',
        generatedAt: at.toISOString()
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
  }

  function validateSpecification(specification) {
    var errors = [];
    if (!specification || specification.schema !== SPEC_SCHEMA) errors.push('specification schema mismatch');
    if (!specification || specification.capability !== CAPABILITY) errors.push('specification capability mismatch');
    if (!specification || specification.status !== 'DRAFT') errors.push('specification status must remain DRAFT');
    var draft = specification ? {
      capabilityId: specification.capabilityId,
      gapType: specification.gapType,
      sourceRequirementIds: specification.provenance && specification.provenance.sourceRequirementIds,
      purpose: specification.purpose,
      inputsAndSchemas: specification.inputsAndSchemas,
      outputsAndSchemas: specification.outputsAndSchemas,
      sideEffects: specification.sideEffects,
      permissionsAndConsent: specification.permissionsAndConsent,
      resourceBudget: specification.resourceBudget,
      failureAndRecovery: specification.failureAndRecovery,
      compatibilityVersionContract: specification.compatibilityVersionContract,
      verificationContract: specification.verificationContract,
      promotionGate: specification.promotionGate
    } : {};
    errors = errors.concat(validateDraft(draft).errors);
    var truth = specification && specification.truth || {};
    ['installed', 'executed', 'authorityGranted', 'promoted', 'canon', 'prototypeOrMockClosesGap'].forEach(function (field) {
      if (truth[field] !== false) errors.push('truth.' + field + ' must be false');
    });
    if (truth.implementationNeutral !== true) errors.push('truth.implementationNeutral must be true');
    return { pass: errors.length === 0, errors: errors };
  }

  function downloadName(specification) {
    var id = boundedText(specification && specification.capabilityId, 'capabilityId', 1, 160)
      .toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return 'axm-missing-hand-' + (id || 'specification') + '.json';
  }

  function example() {
    return { report: clone(EXAMPLE_REPORT), draft: clone(EXAMPLE_DRAFT) };
  }

  return {
    REPORT_SCHEMA: REPORT_SCHEMA,
    SPEC_SCHEMA: SPEC_SCHEMA,
    CAPABILITY: CAPABILITY,
    descriptor: {
      id: 'hand-specification-foundry',
      capability: CAPABILITY,
      version: '1.0.0',
      status: 'TEST',
      accepts: [REPORT_SCHEMA],
      produces: [SPEC_SCHEMA],
      sideEffects: []
    },
    parseGapReport: parseGapReport,
    listCandidates: listCandidates,
    seedFromGapReport: seedFromGapReport,
    validateDraft: validateDraft,
    buildSpecification: buildSpecification,
    validateSpecification: validateSpecification,
    downloadName: downloadName,
    example: example
  };
});
