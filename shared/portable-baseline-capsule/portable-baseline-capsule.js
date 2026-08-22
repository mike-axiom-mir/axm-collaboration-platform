'use strict';

const crypto = require('crypto');
const DeterministicJson = require('../../tools/deterministic-json-core');

const CAPSULE_SCHEMA = 'axm.portable-baseline-capsule/v1';
const COMPARISON_SCHEMA = 'axm.portable-baseline-comparison/v1';
const VERSION = '0.1.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SUBJECT_KINDS = ['SOFTWARE_REPOSITORY', 'MIRROR_STATE', 'SPECIALIST_MASK'];
const VIEW_STATES = ['CURRENT', 'STALE', 'UNKNOWN'];
const EVIDENCE_CEILINGS = [
  'OPERATOR_DECLARATION',
  'STATIC_ONLY',
  'SYNTHETIC_ONLY',
  'MIXED',
  'INDEPENDENT_RUNTIME'
];

function clone(value) {
  return JSON.parse(DeterministicJson.canonicalJson(value));
}

function stableStringify(value) {
  return DeterministicJson.canonicalJson(value);
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  return value;
}

function exactKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length) throw new Error(label + ' has unsupported fields: ' + unknown.join(', '));
}

function text(value, label, maximum) {
  const result = String(value == null ? '' : value).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!result) throw new Error(label + ' is required');
  if (result.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' characters');
  return result;
}

function portableId(value, label, maximum) {
  const result = text(value, label, maximum);
  if (/^[a-z]:[\\/]/i.test(result) || /^[/\\]{1,2}/.test(result) || /^file:/i.test(result) || result.includes('\\')) {
    throw new Error(label + ' must be a portable logical identifier, not a machine path');
  }
  return result;
}

function timestamp(value, label) {
  if (!value) throw new Error(label + ' is required');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(label + ' must be a valid timestamp');
  return date.toISOString();
}

function digest(value, label) {
  const result = String(value || '').toLowerCase();
  if (!DIGEST.test(result)) throw new Error(label + ' must be a SHA-256 digest');
  return result;
}

function reference(value, input) {
  input = input || {};
  return {
    id: portableId(input.id || 'evidence', 'reference id', 180),
    schema: text(input.schema || 'application/octet-stream', 'reference schema', 180),
    sha256: sha256(value)
  };
}

function normalizeReference(input, label) {
  input = object(input, label + ' reference');
  exactKeys(input, ['id', 'schema', 'sha256'], label + ' reference');
  return {
    id: portableId(input.id, label + ' id', 180),
    schema: text(input.schema, label + ' schema', 180),
    sha256: digest(input.sha256, label + ' sha256')
  };
}

function normalizeReferences(values, label, minimum, maximum) {
  if (!Array.isArray(values)) throw new Error(label + ' must be an array');
  if (values.length < minimum) throw new Error(label + ' needs at least ' + minimum + ' reference(s)');
  if (values.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' references');
  const result = values.map((value, index) => normalizeReference(value, label + '[' + index + ']'));
  const keys = result.map(value => value.id + '|' + value.sha256);
  if (new Set(keys).size !== keys.length) throw new Error(label + ' contains duplicate references');
  return result;
}

function normalizeStrings(values, label, minimum, maximum, itemMaximum) {
  if (!Array.isArray(values)) throw new Error(label + ' must be an array');
  if (values.length < minimum) throw new Error(label + ' needs at least ' + minimum + ' item(s)');
  if (values.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' items');
  const result = values.map((value, index) => text(value, label + '[' + index + ']', itemMaximum));
  if (new Set(result).size !== result.length) throw new Error(label + ' contains duplicate items');
  return result;
}

function normalizeSubject(input) {
  input = object(input, 'subject');
  exactKeys(input, ['kind', 'id', 'version'], 'subject');
  const kind = String(input.kind || '').toUpperCase();
  if (!SUBJECT_KINDS.includes(kind)) throw new Error('subject kind is unsupported');
  return {
    kind,
    id: portableId(input.id, 'subject id', 180),
    version: text(input.version, 'subject version', 180)
  };
}

function normalizeGeneratedViews(values) {
  if (!Array.isArray(values)) throw new Error('generatedViews must be an array');
  if (values.length > 32) throw new Error('generatedViews exceeds 32 entries');
  const result = values.map((value, index) => {
    value = object(value, 'generatedViews[' + index + ']');
    exactKeys(value, ['viewId', 'viewRef', 'state', 'checkedAt', 'reason'], 'generatedViews[' + index + ']');
    const state = String(value.state || '').toUpperCase();
    if (!VIEW_STATES.includes(state)) throw new Error('generatedViews[' + index + '] state is unsupported');
    return {
      viewId: portableId(value.viewId, 'generatedViews[' + index + '] viewId', 180),
      viewRef: normalizeReference(value.viewRef, 'generatedViews[' + index + '] view'),
      state,
      checkedAt: timestamp(value.checkedAt, 'generatedViews[' + index + '] checkedAt'),
      reason: text(value.reason, 'generatedViews[' + index + '] reason', 800)
    };
  });
  const ids = result.map(value => value.viewId);
  if (new Set(ids).size !== ids.length) throw new Error('generatedViews contains duplicate viewId values');
  return result.sort((a, b) => a.viewId.localeCompare(b.viewId));
}

function normalizePreservedFields(values) {
  if (!Array.isArray(values)) throw new Error('preservedSourceFields must be an array');
  if (values.length > 64) throw new Error('preservedSourceFields exceeds 64 entries');
  const result = values.map((value, index) => {
    value = object(value, 'preservedSourceFields[' + index + ']');
    exactKeys(value, ['field', 'sourceRef', 'reason'], 'preservedSourceFields[' + index + ']');
    return {
      field: portableId(value.field, 'preservedSourceFields[' + index + '] field', 180),
      sourceRef: normalizeReference(value.sourceRef, 'preservedSourceFields[' + index + '] source'),
      reason: text(value.reason, 'preservedSourceFields[' + index + '] reason', 500)
    };
  });
  const fields = result.map(value => value.field);
  if (new Set(fields).size !== fields.length) throw new Error('preservedSourceFields contains duplicate fields');
  return result.sort((a, b) => a.field.localeCompare(b.field));
}

function normalizeExtensions(values) {
  if (!Array.isArray(values)) throw new Error('extensions must be an array');
  if (values.length > 32) throw new Error('extensions exceeds 32 entries');
  const result = values.map((value, index) => {
    value = object(value, 'extensions[' + index + ']');
    exactKeys(value, ['namespace', 'extensionRef', 'note'], 'extensions[' + index + ']');
    return {
      namespace: portableId(value.namespace, 'extensions[' + index + '] namespace', 180),
      extensionRef: normalizeReference(value.extensionRef, 'extensions[' + index + '] extension'),
      note: text(value.note, 'extensions[' + index + '] note', 500)
    };
  });
  const namespaces = result.map(value => value.namespace);
  if (new Set(namespaces).size !== namespaces.length) throw new Error('extensions contains duplicate namespaces');
  return result.sort((a, b) => a.namespace.localeCompare(b.namespace));
}

function normalizeSoftware(input) {
  input = object(input, 'software adapter');
  exactKeys(input, ['repositoryId', 'versionOrCommit', 'workingTree'], 'software adapter');
  const workingTree = object(input.workingTree, 'software workingTree');
  exactKeys(workingTree, ['state', 'statusRef'], 'software workingTree');
  const state = String(workingTree.state || '').toUpperCase();
  if (!['CLEAN', 'DIRTY', 'UNKNOWN'].includes(state)) throw new Error('software workingTree state is unsupported');
  return {
    repositoryId: portableId(input.repositoryId, 'software repositoryId', 180),
    versionOrCommit: text(input.versionOrCommit, 'software versionOrCommit', 220),
    workingTree: {
      state,
      statusRef: normalizeReference(workingTree.statusRef, 'software workingTree status')
    }
  };
}

function normalizeMirror(input) {
  input = object(input, 'Mirror adapter');
  exactKeys(input, ['originalBaselineRef', 'privateLessons', 'challenger'], 'Mirror adapter');
  const privateLessons = input.privateLessons == null ? null : object(input.privateLessons, 'Mirror privateLessons');
  const challenger = input.challenger == null ? null : object(input.challenger, 'Mirror challenger');
  if (privateLessons) exactKeys(privateLessons, ['stateRef', 'visibility'], 'Mirror privateLessons');
  if (challenger) exactKeys(challenger, ['stateRef', 'disposable'], 'Mirror challenger');
  const visibility = privateLessons ? String(privateLessons.visibility || '').toUpperCase() : null;
  if (privateLessons && !['PRIVATE', 'RESTRICTED'].includes(visibility)) throw new Error('Mirror privateLessons visibility is unsupported');
  if (challenger && challenger.disposable !== true) throw new Error('Mirror challenger must be explicitly disposable');
  const result = {
    originalBaselineRef: normalizeReference(input.originalBaselineRef, 'Mirror original baseline'),
    privateLessons: privateLessons ? {
      stateRef: normalizeReference(privateLessons.stateRef, 'Mirror private lessons state'),
      visibility
    } : null,
    challenger: challenger ? {
      stateRef: normalizeReference(challenger.stateRef, 'Mirror challenger state'),
      disposable: true
    } : null
  };
  const refs = [result.originalBaselineRef];
  if (result.privateLessons) refs.push(result.privateLessons.stateRef);
  if (result.challenger) refs.push(result.challenger.stateRef);
  const identities = refs.map(value => value.id + '|' + value.sha256);
  if (new Set(identities).size !== identities.length) throw new Error('Mirror original, private lessons, and challenger references must remain distinct');
  return result;
}

function normalizeSpecialist(input) {
  input = object(input, 'specialist adapter');
  exactKeys(input, ['hostModel', 'mask', 'allowedCapabilities', 'evidenceCeiling', 'permissionGrant', 'identityEffect'], 'specialist adapter');
  const hostModel = object(input.hostModel, 'specialist hostModel');
  exactKeys(hostModel, ['providerFamily', 'modelId', 'version', 'receiptRef'], 'specialist hostModel');
  const mask = object(input.mask, 'specialist mask');
  exactKeys(mask, ['id', 'schema', 'version', 'packageRef'], 'specialist mask');
  const evidenceCeiling = String(input.evidenceCeiling || '').toUpperCase();
  if (!EVIDENCE_CEILINGS.includes(evidenceCeiling)) throw new Error('specialist evidenceCeiling is unsupported');
  if (input.permissionGrant !== 'NONE') throw new Error('specialist permissionGrant must be NONE');
  if (input.identityEffect !== 'OVERLAY_ONLY') throw new Error('specialist identityEffect must be OVERLAY_ONLY');
  return {
    hostModel: {
      providerFamily: text(hostModel.providerFamily, 'specialist hostModel providerFamily', 120),
      modelId: portableId(hostModel.modelId, 'specialist hostModel modelId', 180),
      version: text(hostModel.version, 'specialist hostModel version', 180),
      receiptRef: normalizeReference(hostModel.receiptRef, 'specialist hostModel receipt')
    },
    mask: {
      id: portableId(mask.id, 'specialist mask id', 180),
      schema: text(mask.schema, 'specialist mask schema', 180),
      version: text(mask.version, 'specialist mask version', 180),
      packageRef: normalizeReference(mask.packageRef, 'specialist mask package')
    },
    allowedCapabilities: normalizeStrings(input.allowedCapabilities, 'specialist allowedCapabilities', 0, 64, 180).sort(),
    evidenceCeiling,
    permissionGrant: 'NONE',
    identityEffect: 'OVERLAY_ONLY'
  };
}

function normalizeAdapter(kind, input) {
  if (kind === 'SOFTWARE_REPOSITORY') return normalizeSoftware(input);
  if (kind === 'MIRROR_STATE') return normalizeMirror(input);
  return normalizeSpecialist(input);
}

function deriveFreshness(generatedViews) {
  if (!generatedViews.length) return { state: 'NOT_APPLICABLE', refreshRequired: false, reasonCodes: [] };
  const reasons = [];
  generatedViews.forEach(view => {
    if (view.state !== 'CURRENT') reasons.push('GENERATED_VIEW_' + view.state + ':' + view.viewId);
  });
  return {
    state: reasons.length ? 'REFRESH_REQUIRED' : 'CURRENT',
    refreshRequired: reasons.length > 0,
    reasonCodes: reasons
  };
}

function build(input) {
  input = object(input, 'capsule input');
  exactKeys(input, [
    'capsuleId', 'capturedAt', 'subject', 'contentRef', 'configRef', 'sourceRefs',
    'newInformationRefs', 'generatedViews', 'limitations', 'preservedSourceFields',
    'extensions', 'adapter'
  ], 'capsule input');
  const subject = normalizeSubject(input.subject);
  const generatedViews = normalizeGeneratedViews(input.generatedViews || []);
  const capsule = {
    schema: CAPSULE_SCHEMA,
    version: VERSION,
    capsuleId: portableId(input.capsuleId, 'capsuleId', 180),
    capturedAt: timestamp(input.capturedAt, 'capturedAt'),
    subject,
    contentRef: normalizeReference(input.contentRef, 'content'),
    configRef: normalizeReference(input.configRef, 'config'),
    sourceRefs: normalizeReferences(input.sourceRefs || [], 'sourceRefs', 1, 64),
    newInformationRefs: normalizeReferences(input.newInformationRefs || [], 'newInformationRefs', 0, 64),
    generatedViews,
    freshness: deriveFreshness(generatedViews),
    limitations: normalizeStrings(input.limitations || [], 'limitations', 1, 32, 500),
    preservedSourceFields: normalizePreservedFields(input.preservedSourceFields || []),
    extensions: normalizeExtensions(input.extensions || []),
    adapter: normalizeAdapter(subject.kind, input.adapter),
    truth: {
      authority: 'IDENTITY_AND_EVIDENCE_LINKING_ONLY',
      sourceBytesEmbedded: false,
      sourceExecuted: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false,
      modelWeightTrainingClaimed: false,
      humanMergeGateRequired: true
    },
    capsuleDigest: null
  };
  const payload = clone(capsule);
  delete payload.capsuleDigest;
  capsule.capsuleDigest = sha256(payload);
  return capsule;
}

function verify(capsule) {
  const errors = [];
  if (!capsule || capsule.schema !== CAPSULE_SCHEMA) return { pass: false, errors: ['capsule schema mismatch'] };
  if (capsule.version !== VERSION) errors.push('capsule version mismatch');
  let rebuilt = null;
  try {
    rebuilt = build({
      capsuleId: capsule.capsuleId,
      capturedAt: capsule.capturedAt,
      subject: capsule.subject,
      contentRef: capsule.contentRef,
      configRef: capsule.configRef,
      sourceRefs: capsule.sourceRefs,
      newInformationRefs: capsule.newInformationRefs,
      generatedViews: capsule.generatedViews,
      limitations: capsule.limitations,
      preservedSourceFields: capsule.preservedSourceFields,
      extensions: capsule.extensions,
      adapter: capsule.adapter
    });
  } catch (error) {
    errors.push('capsule content invalid: ' + error.message);
  }
  if (rebuilt) {
    if (stableStringify(rebuilt) !== stableStringify(capsule)) errors.push('capsule content or derived fields mismatch');
    if (rebuilt.capsuleDigest !== capsule.capsuleDigest) errors.push('capsule digest mismatch');
  }
  return { pass: errors.length === 0, errors };
}

function capsuleReference(capsule) {
  const checked = verify(capsule);
  if (!checked.pass) throw new Error('cannot reference an invalid capsule: ' + checked.errors.join('; '));
  return {
    id: capsule.capsuleId,
    schema: CAPSULE_SCHEMA,
    sha256: capsule.capsuleDigest
  };
}

function toVerifiedCapabilityBaseline(capsule) {
  const ref = capsuleReference(capsule);
  return {
    kind: capsule.subject.kind,
    identity: capsule.subject.id + '@' + capsule.subject.version + ' [' + capsule.capsuleDigest + ']',
    receiptRef: ref
  };
}

function comparisonBasis(capsule) {
  return {
    subject: capsule.subject,
    contentRef: capsule.contentRef,
    configRef: capsule.configRef,
    sourceRefs: capsule.sourceRefs,
    newInformationRefs: capsule.newInformationRefs,
    generatedViews: capsule.generatedViews,
    limitations: capsule.limitations,
    preservedSourceFields: capsule.preservedSourceFields,
    extensions: capsule.extensions,
    adapter: capsule.adapter
  };
}

function compare(prior, current, options) {
  options = object(options || {}, 'comparison options');
  exactKeys(options, ['comparisonId', 'comparedAt'], 'comparison options');
  const priorCheck = verify(prior);
  const currentCheck = verify(current);
  if (!priorCheck.pass) throw new Error('prior capsule is invalid: ' + priorCheck.errors.join('; '));
  if (!currentCheck.pass) throw new Error('current capsule is invalid: ' + currentCheck.errors.join('; '));

  const sameSubject = prior.subject.kind === current.subject.kind && prior.subject.id === current.subject.id;
  let state;
  const reasonCodes = [];
  if (!sameSubject) {
    state = 'INCOMPARABLE';
    reasonCodes.push('SUBJECT_IDENTITY_CHANGED');
  } else if (stableStringify(comparisonBasis(prior)) === stableStringify(comparisonBasis(current))) {
    state = 'NO_NEW_INFORMATION';
    reasonCodes.push('BASELINE_AND_INFORMATION_UNCHANGED');
  } else {
    const baselineFields = ['subject', 'contentRef', 'configRef', 'adapter'];
    baselineFields.forEach(field => {
      if (stableStringify(prior[field]) !== stableStringify(current[field])) reasonCodes.push(field.toUpperCase() + '_CHANGED');
    });
    const informationFields = ['sourceRefs', 'newInformationRefs', 'generatedViews', 'limitations', 'preservedSourceFields', 'extensions'];
    informationFields.forEach(field => {
      if (stableStringify(prior[field]) !== stableStringify(current[field])) reasonCodes.push(field.replace(/([A-Z])/g, '_$1').toUpperCase() + '_CHANGED');
    });
    state = reasonCodes.some(code => baselineFields.some(field => code === field.toUpperCase() + '_CHANGED'))
      ? 'BASELINE_CHANGED'
      : 'NEW_INFORMATION';
  }
  if (current.freshness.refreshRequired) reasonCodes.push('CURRENT_CAPSULE_REFRESH_REQUIRED');

  const receipt = {
    schema: COMPARISON_SCHEMA,
    version: VERSION,
    comparisonId: portableId(options.comparisonId, 'comparisonId', 180),
    comparedAt: timestamp(options.comparedAt, 'comparedAt'),
    priorRef: capsuleReference(prior),
    currentRef: capsuleReference(current),
    sameSubject,
    state,
    reasonCodes: Array.from(new Set(reasonCodes)),
    refreshRequired: state !== 'NO_NEW_INFORMATION' || current.freshness.refreshRequired,
    automaticAction: false,
    receiptDigest: null
  };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  receipt.receiptDigest = sha256(payload);
  return receipt;
}

function verifyComparison(receipt, prior, current) {
  const errors = [];
  if (!receipt || receipt.schema !== COMPARISON_SCHEMA) return { pass: false, errors: ['comparison schema mismatch'] };
  let rebuilt = null;
  try {
    rebuilt = compare(prior, current, { comparisonId: receipt.comparisonId, comparedAt: receipt.comparedAt });
  } catch (error) {
    errors.push('comparison content invalid: ' + error.message);
  }
  if (rebuilt && stableStringify(rebuilt) !== stableStringify(receipt)) errors.push('comparison content, state, or digest mismatch');
  return { pass: errors.length === 0, errors };
}

module.exports = {
  CAPSULE_SCHEMA,
  COMPARISON_SCHEMA,
  VERSION,
  SUBJECT_KINDS,
  EVIDENCE_CEILINGS,
  stableStringify,
  sha256,
  reference,
  build,
  verify,
  capsuleReference,
  toVerifiedCapabilityBaseline,
  compare,
  verifyComparison
};
