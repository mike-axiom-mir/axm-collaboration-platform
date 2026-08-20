'use strict';

const crypto = require('crypto');
const Capsule = require('../portable-baseline-capsule/portable-baseline-capsule');
const Loop = require('../verified-capability-loop/verified-capability-loop');
const Evidence = require('../../tools/evidence-desk/evidence-core');

const RUN_SCHEMA = 'axm.baseline-simulation-lab-run/v1';
const VERSION = '0.1.0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SUBJECT_KINDS = Capsule.SUBJECT_KINDS;
const SEAT_KINDS = ['HUMAN', 'MODEL', 'TOOL'];
const DISCLOSURE_STATES = ['EXACT', 'PARTIAL', 'UNDISCLOSED'];
const EXPOSURES = ['NONE', 'PARTIAL', 'FULL', 'UNKNOWN'];
const SIGNAL_STAGES = ['OBSERVED', 'SIMULATED', 'INFERENCE', 'UNKNOWN'];
const CLOSURE_STATES = ['CURRENT', 'MISSING', 'CHANGED', 'SUMMARY_SUBSTITUTED', 'UNVERIFIED'];
const IDEA_RELATIONS = ['MOTIVATED_BY', 'DERIVED_FROM', 'REUSES', 'CONTRADICTS', 'FALSIFIES', 'POSSIBLE_DUPLICATE'];
const AUTHORITY_ACTIONS = [
  'EXECUTE', 'INSTALL', 'GRANT_PERMISSION', 'PROMOTE', 'CANON', 'ROOT_MUTATION',
  'FOUNDATION_MUTATION', 'MODEL_WEIGHT_TRAINING', 'PUBLISH', 'PUSH'
];
const METHOD_SURFACES = {
  FILE_INSPECTION: 'file-inspection',
  SCHEMA_VALIDATION: 'schema-validation',
  FOCUSED_EXECUTION: 'focused-execution',
  LIVE_VISUAL_OBSERVATION: 'live-visual-observation',
  FRAME_SEQUENCE: 'frame-sequence',
  LIVE_INTERACTION: 'live-interaction',
  RESTART_RELOAD: 'restart-reload',
  SENDER_RECEIVER_RECEIPTS: 'sender-and-receiver-receipts',
  ALLOWED_DENIED_ATTEMPTS: 'allowed-and-denied-attempts',
  MEASURED_TELEMETRY: 'measured-telemetry',
  HARDWARE_TELEMETRY: 'hardware-telemetry',
  HELD_OUT_EVALUATION: 'held-out-evaluation',
  ACCEPTANCE_REVIEW: 'acceptance-review',
  HUMAN_STEWARD_JUDGMENT: 'human-steward-judgment',
  DECLARED_EVIDENCE: 'declared-evidence'
};
const HOLD_STATES = [
  ['AUTHORITY_', 'AUTHORITY_HOLD'],
  ['CONTRACT_', 'CONTRACT_HOLD'],
  ['BASELINE_', 'BASELINE_HOLD'],
  ['ANCESTRY_', 'ANCESTRY_HOLD'],
  ['OUTPUT_', 'OUTPUT_HOLD'],
  ['BUDGET_', 'BUDGET_HOLD'],
  ['TRANSPORT_', 'TRANSPORT_HOLD'],
  ['PERMISSION_', 'PERMISSION_HOLD'],
  ['HANDOFF_', 'HANDOFF_HOLD'],
  ['PROOF_', 'EVIDENCE_HOLD'],
  ['EVIDENCE_', 'EVIDENCE_HOLD'],
  ['HUMAN_', 'HUMAN_REVIEW_HOLD'],
  ['CYCLE_', 'CYCLE_HOLD'],
  ['NO_NEW_', 'CONTRACT_HOLD']
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableStringify(value[key])).join(',') + '}';
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

function integer(value, label, minimum, maximum) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum || result > maximum) {
    throw new Error(label + ' must be an integer from ' + minimum + ' through ' + maximum);
  }
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

function refKey(ref) {
  return ref.id + '|' + ref.schema + '|' + ref.sha256;
}

function normalizeReferences(values, label, minimum, maximum) {
  if (!Array.isArray(values)) throw new Error(label + ' must be an array');
  if (values.length < minimum) throw new Error(label + ' needs at least ' + minimum + ' reference(s)');
  if (values.length > maximum) throw new Error(label + ' exceeds ' + maximum + ' references');
  const result = values.map((value, index) => normalizeReference(value, label + '[' + index + ']'));
  const keys = result.map(refKey);
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

function normalizeNeed(input) {
  input = object(input, 'need');
  exactKeys(input, ['id', 'statement', 'sourceRef', 'directionRef'], 'need');
  return {
    id: portableId(input.id, 'need id', 180),
    statement: text(input.statement, 'need statement', 1200),
    sourceRef: normalizeReference(input.sourceRef, 'need source'),
    directionRef: input.directionRef ? normalizeReference(input.directionRef, 'need direction') : null
  };
}

function normalizeSeats(values) {
  if (!Array.isArray(values) || !values.length) throw new Error('seats needs at least one seat');
  if (values.length > 32) throw new Error('seats exceeds 32 entries');
  const result = values.map((value, index) => {
    value = object(value, 'seats[' + index + ']');
    exactKeys(value, ['id', 'kind', 'role', 'providerFamily', 'modelId', 'identityDisclosure', 'priorOutputExposure', 'provenanceRef', 'proofAuthority'], 'seats[' + index + ']');
    const kind = String(value.kind || '').toUpperCase();
    const disclosure = String(value.identityDisclosure || '').toUpperCase();
    const exposure = String(value.priorOutputExposure || '').toUpperCase();
    if (!SEAT_KINDS.includes(kind)) throw new Error('seats[' + index + '] kind is unsupported');
    if (!DISCLOSURE_STATES.includes(disclosure)) throw new Error('seats[' + index + '] identityDisclosure is unsupported');
    if (!EXPOSURES.includes(exposure)) throw new Error('seats[' + index + '] priorOutputExposure is unsupported');
    if (value.proofAuthority !== 'NONE') throw new Error('seats[' + index + '] proofAuthority must be NONE');
    return {
      id: portableId(value.id, 'seats[' + index + '] id', 180),
      kind,
      role: text(value.role, 'seats[' + index + '] role', 240),
      providerFamily: value.providerFamily == null ? null : text(value.providerFamily, 'seats[' + index + '] providerFamily', 120),
      modelId: value.modelId == null ? null : portableId(value.modelId, 'seats[' + index + '] modelId', 180),
      identityDisclosure: disclosure,
      priorOutputExposure: exposure,
      provenanceRef: normalizeReference(value.provenanceRef, 'seats[' + index + '] provenance'),
      proofAuthority: 'NONE'
    };
  });
  const ids = result.map(value => value.id);
  if (new Set(ids).size !== ids.length) throw new Error('seats contains duplicate ids');
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeAdapters(values, subjectKind) {
  if (!Array.isArray(values) || !values.length) throw new Error('adapters needs at least one adapter');
  if (values.length > 16) throw new Error('adapters exceeds 16 entries');
  const result = values.map((value, index) => {
    value = object(value, 'adapters[' + index + ']');
    exactKeys(value, ['id', 'subjectKind', 'inputSchemaRef', 'outputSchemaRef', 'translationReceiptRef', 'unsupportedFieldRefs', 'nativeSchemaIdentityClaimed'], 'adapters[' + index + ']');
    const kind = String(value.subjectKind || '').toUpperCase();
    if (!SUBJECT_KINDS.includes(kind)) throw new Error('adapters[' + index + '] subjectKind is unsupported');
    if (value.nativeSchemaIdentityClaimed !== false) throw new Error('adapters[' + index + '] nativeSchemaIdentityClaimed must be false');
    return {
      id: portableId(value.id, 'adapters[' + index + '] id', 180),
      subjectKind: kind,
      inputSchemaRef: normalizeReference(value.inputSchemaRef, 'adapters[' + index + '] input schema'),
      outputSchemaRef: normalizeReference(value.outputSchemaRef, 'adapters[' + index + '] output schema'),
      translationReceiptRef: normalizeReference(value.translationReceiptRef, 'adapters[' + index + '] translation receipt'),
      unsupportedFieldRefs: normalizeReferences(value.unsupportedFieldRefs || [], 'adapters[' + index + '] unsupportedFieldRefs', 0, 32),
      nativeSchemaIdentityClaimed: false
    };
  });
  const ids = result.map(value => value.id);
  if (new Set(ids).size !== ids.length) throw new Error('adapters contains duplicate ids');
  if (!result.some(value => value.subjectKind === subjectKind)) throw new Error('adapters must include the current baseline subject kind');
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeBudget(input) {
  input = object(input, 'budget');
  exactKeys(input, ['limits', 'usage'], 'budget');
  const limits = object(input.limits, 'budget limits');
  const usage = object(input.usage, 'budget usage');
  exactKeys(limits, ['timeMs', 'storageBytes', 'maxConcurrency', 'maxRetries'], 'budget limits');
  exactKeys(usage, ['timeMs', 'storageBytes', 'peakConcurrency', 'retries', 'executionPerformed', 'usageRef'], 'budget usage');
  return {
    limits: {
      timeMs: integer(limits.timeMs, 'budget limits timeMs', 1, 604800000),
      storageBytes: integer(limits.storageBytes, 'budget limits storageBytes', 1, 1099511627776),
      maxConcurrency: integer(limits.maxConcurrency, 'budget limits maxConcurrency', 1, 1024),
      maxRetries: integer(limits.maxRetries, 'budget limits maxRetries', 0, 1000)
    },
    usage: {
      timeMs: integer(usage.timeMs, 'budget usage timeMs', 0, 604800000),
      storageBytes: integer(usage.storageBytes, 'budget usage storageBytes', 0, 1099511627776),
      peakConcurrency: integer(usage.peakConcurrency, 'budget usage peakConcurrency', 0, 1024),
      retries: integer(usage.retries, 'budget usage retries', 0, 1000),
      executionPerformed: usage.executionPerformed === true,
      usageRef: normalizeReference(usage.usageRef, 'budget usage')
    }
  };
}

function evaluateBudget(budget, holds) {
  const checks = [
    ['TIME', budget.usage.timeMs, budget.limits.timeMs],
    ['STORAGE', budget.usage.storageBytes, budget.limits.storageBytes],
    ['CONCURRENCY', budget.usage.peakConcurrency, budget.limits.maxConcurrency],
    ['RETRIES', budget.usage.retries, budget.limits.maxRetries]
  ];
  const exceeded = [];
  checks.forEach(([name, used, limit]) => {
    if (used > limit) {
      exceeded.push(name);
      addHold(holds, 'BUDGET_' + name + '_EXCEEDED', name.toLowerCase() + ' usage ' + used + ' exceeds limit ' + limit);
    }
  });
  return { state: exceeded.length ? 'EXCEEDED' : 'WITHIN_LIMITS', exceeded };
}

function normalizeClosures(values) {
  if (!Array.isArray(values)) throw new Error('outputClosures must be an array');
  if (values.length > 256) throw new Error('outputClosures exceeds 256 entries');
  const result = values.map((value, index) => {
    value = object(value, 'outputClosures[' + index + ']');
    exactKeys(value, ['dependencyRef', 'state', 'receiptRef', 'observedRef', 'summarySubstituted', 'authority'], 'outputClosures[' + index + ']');
    const state = String(value.state || '').toUpperCase();
    if (!CLOSURE_STATES.includes(state)) throw new Error('outputClosures[' + index + '] state is unsupported');
    if (value.authority !== 'LOCAL_IDENTITY_ONLY') throw new Error('outputClosures[' + index + '] authority must be LOCAL_IDENTITY_ONLY');
    return {
      dependencyRef: normalizeReference(value.dependencyRef, 'outputClosures[' + index + '] dependency'),
      state,
      receiptRef: normalizeReference(value.receiptRef, 'outputClosures[' + index + '] receipt'),
      observedRef: value.observedRef ? normalizeReference(value.observedRef, 'outputClosures[' + index + '] observed') : null,
      summarySubstituted: value.summarySubstituted === true,
      authority: 'LOCAL_IDENTITY_ONLY'
    };
  });
  const keys = result.map(value => refKey(value.dependencyRef));
  if (new Set(keys).size !== keys.length) throw new Error('outputClosures contains duplicate dependencies');
  return result.sort((a, b) => refKey(a.dependencyRef).localeCompare(refKey(b.dependencyRef)));
}

function normalizeArtifactAncestry(input) {
  input = object(input, 'artifactAncestry');
  exactKeys(input, ['maxDepth', 'nodes'], 'artifactAncestry');
  const maxDepth = integer(input.maxDepth, 'artifactAncestry maxDepth', 0, 256);
  if (!Array.isArray(input.nodes) || !input.nodes.length) throw new Error('artifactAncestry needs at least one node');
  if (input.nodes.length > 257) throw new Error('artifactAncestry exceeds 257 nodes');
  const nodes = input.nodes.map((value, index) => {
    value = object(value, 'artifactAncestry nodes[' + index + ']');
    exactKeys(value, ['artifactRef', 'parentRef', 'depth', 'assumptionRefs'], 'artifactAncestry nodes[' + index + ']');
    return {
      artifactRef: normalizeReference(value.artifactRef, 'artifactAncestry nodes[' + index + '] artifact'),
      parentRef: value.parentRef ? normalizeReference(value.parentRef, 'artifactAncestry nodes[' + index + '] parent') : null,
      depth: integer(value.depth, 'artifactAncestry nodes[' + index + '] depth', 0, 256),
      assumptionRefs: normalizeReferences(value.assumptionRefs || [], 'artifactAncestry nodes[' + index + '] assumptionRefs', 0, 32)
    };
  });
  const keys = nodes.map(value => refKey(value.artifactRef));
  if (new Set(keys).size !== keys.length) throw new Error('artifactAncestry contains duplicate artifacts');
  return { maxDepth, nodes: nodes.sort((a, b) => b.depth - a.depth || refKey(a.artifactRef).localeCompare(refKey(b.artifactRef))) };
}

function evaluateArtifactAncestry(ancestry, currentRef, priorRef, comparison, holds) {
  const byKey = new Map(ancestry.nodes.map(node => [refKey(node.artifactRef), node]));
  let current = byKey.get(refKey(currentRef));
  if (!current) {
    addHold(holds, 'ANCESTRY_HEAD_MISSING', 'current baseline capsule is absent from artifact ancestry');
    return { state: 'HELD', visited: 0, rootRef: null };
  }
  if (current.depth > ancestry.maxDepth) addHold(holds, 'ANCESTRY_DEPTH_EXCEEDED', 'head depth exceeds declared maxDepth');
  if (priorRef && comparison && comparison.state === 'BASELINE_CHANGED' && (!current.parentRef || refKey(current.parentRef) !== refKey(priorRef))) {
    addHold(holds, 'ANCESTRY_CHANGED_BASELINE_PARENT_MISSING', 'changed baseline does not name the prior capsule as its exact parent');
  }
  const visited = new Set();
  let expectedDepth = current.depth;
  while (current) {
    const key = refKey(current.artifactRef);
    if (visited.has(key)) {
      addHold(holds, 'ANCESTRY_CYCLE', 'artifact ancestry contains a cycle at ' + current.artifactRef.id);
      break;
    }
    visited.add(key);
    if (current.depth !== expectedDepth) addHold(holds, 'ANCESTRY_DEPTH_MISMATCH', current.artifactRef.id + ' depth is not contiguous');
    if (!current.parentRef) {
      if (current.depth !== 0) addHold(holds, 'ANCESTRY_ROOT_DEPTH_MISMATCH', 'root artifact depth must be zero');
      break;
    }
    const parent = byKey.get(refKey(current.parentRef));
    if (!parent) {
      addHold(holds, 'ANCESTRY_PARENT_MISSING', 'parent artifact is missing for ' + current.artifactRef.id);
      break;
    }
    if (parent.depth !== current.depth - 1) addHold(holds, 'ANCESTRY_PARENT_DEPTH_MISMATCH', 'parent depth mismatch for ' + current.artifactRef.id);
    expectedDepth = current.depth - 1;
    current = parent;
  }
  if (visited.size !== ancestry.nodes.length) addHold(holds, 'ANCESTRY_DISCONNECTED_NODE', 'artifact ancestry contains an unreachable node');
  return { state: holds.some(item => item.code.startsWith('ANCESTRY_')) ? 'HELD' : 'CLOSED', visited: visited.size, rootRef: current && !current.parentRef ? current.artifactRef : null };
}

function normalizeIdeaEvidenceAncestry(input) {
  input = object(input, 'ideaEvidenceAncestry');
  exactKeys(input, ['items', 'links'], 'ideaEvidenceAncestry');
  const items = normalizeReferences(input.items || [], 'ideaEvidenceAncestry items', 1, 256);
  if (!Array.isArray(input.links)) throw new Error('ideaEvidenceAncestry links must be an array');
  if (input.links.length > 512) throw new Error('ideaEvidenceAncestry links exceeds 512 entries');
  const links = input.links.map((value, index) => {
    value = object(value, 'ideaEvidenceAncestry links[' + index + ']');
    exactKeys(value, ['fromRef', 'toRef', 'relation'], 'ideaEvidenceAncestry links[' + index + ']');
    const relation = String(value.relation || '').toUpperCase();
    if (!IDEA_RELATIONS.includes(relation)) throw new Error('ideaEvidenceAncestry links[' + index + '] relation is unsupported');
    return {
      fromRef: normalizeReference(value.fromRef, 'ideaEvidenceAncestry links[' + index + '] from'),
      toRef: normalizeReference(value.toRef, 'ideaEvidenceAncestry links[' + index + '] to'),
      relation
    };
  });
  const linkKeys = links.map(value => refKey(value.fromRef) + '>' + refKey(value.toRef) + '|' + value.relation);
  if (new Set(linkKeys).size !== linkKeys.length) throw new Error('ideaEvidenceAncestry contains duplicate links');
  return { items, links };
}

function evaluateIdeaEvidenceAncestry(ancestry, artifactAncestry, need, newInformationRefs, holds) {
  const itemKeys = new Set(ancestry.items.map(refKey));
  const artifactKeys = new Set(artifactAncestry.nodes.map(node => refKey(node.artifactRef)));
  if (!itemKeys.has(refKey(need.sourceRef))) addHold(holds, 'ANCESTRY_NEED_SOURCE_MISSING', 'need source is absent from idea/evidence ancestry');
  newInformationRefs.forEach(ref => {
    if (!itemKeys.has(refKey(ref))) addHold(holds, 'ANCESTRY_NEW_INFORMATION_MISSING', 'new information is absent from idea/evidence ancestry: ' + ref.id);
  });
  ancestry.items.forEach(ref => {
    if (artifactKeys.has(refKey(ref))) addHold(holds, 'ANCESTRY_ARTIFACT_IDEA_FUSION', 'artifact and idea/evidence ancestry overlap at ' + ref.id);
  });
  const graph = new Map();
  ancestry.links.forEach(link => {
    const from = refKey(link.fromRef), to = refKey(link.toRef);
    if (!itemKeys.has(from) || !itemKeys.has(to)) addHold(holds, 'ANCESTRY_IDEA_LINK_TARGET_MISSING', 'idea/evidence link references an undeclared item');
    if (['DERIVED_FROM', 'REUSES'].includes(link.relation)) {
      if (!graph.has(from)) graph.set(from, []);
      graph.get(from).push(to);
    }
  });
  const visiting = new Set(), visited = new Set();
  function walk(key) {
    if (visiting.has(key)) return true;
    if (visited.has(key)) return false;
    visiting.add(key);
    for (const next of graph.get(key) || []) if (walk(next)) return true;
    visiting.delete(key);
    visited.add(key);
    return false;
  }
  for (const key of graph.keys()) {
    if (walk(key)) {
      addHold(holds, 'ANCESTRY_IDEA_CYCLE', 'derived/reused idea ancestry contains a cycle');
      break;
    }
  }
  return { state: holds.some(item => item.code.startsWith('ANCESTRY_')) ? 'HELD' : 'SEPARATE_AND_LINKED', itemCount: ancestry.items.length, linkCount: ancestry.links.length };
}

function normalizeProofRefs(values) {
  if (!Array.isArray(values)) throw new Error('proofRefs must be an array');
  if (values.length > 256) throw new Error('proofRefs exceeds 256 entries');
  const result = values.map((value, index) => {
    value = object(value, 'proofRefs[' + index + ']');
    exactKeys(value, ['claimId', 'evidenceRef', 'method', 'observedAt'], 'proofRefs[' + index + ']');
    const method = String(value.method || '').toUpperCase();
    if (!METHOD_SURFACES[method]) throw new Error('proofRefs[' + index + '] method is unsupported');
    return {
      claimId: portableId(value.claimId, 'proofRefs[' + index + '] claimId', 100),
      evidenceRef: normalizeReference(value.evidenceRef, 'proofRefs[' + index + '] evidence'),
      method,
      observedAt: timestamp(value.observedAt, 'proofRefs[' + index + '] observedAt')
    };
  });
  const ids = result.map(value => value.claimId);
  if (new Set(ids).size !== ids.length) throw new Error('proofRefs contains duplicate claimId values');
  return result.sort((a, b) => a.claimId.localeCompare(b.claimId));
}

function evaluateEvidence(evidenceReceipt, proofRefs, integrity, holds) {
  if (!integrity.ok) addHold(holds, 'EVIDENCE_RECEIPT_INTEGRITY', 'Evidence Desk receipt integrity does not match');
  if (!Array.isArray(evidenceReceipt.observations) || !evidenceReceipt.observations.length) addHold(holds, 'EVIDENCE_CLAIMS_MISSING', 'run needs at least one claim-specific proof route');
  const proofs = new Map(proofRefs.map(value => [value.claimId, value]));
  (evidenceReceipt.observations || []).forEach(claim => {
    if (claim.effective_verdict === 'UNKNOWN') addHold(holds, 'EVIDENCE_CLAIM_OPEN', claim.id + ' remains UNKNOWN');
    if (claim.verdict !== 'UNKNOWN' && claim.effective_verdict === 'UNKNOWN') addHold(holds, 'EVIDENCE_DECLARED_VERDICT_UNSUPPORTED', claim.id + ' declared ' + claim.verdict + ' without a complete native route');
    if (claim.effective_verdict === 'PASS' || claim.effective_verdict === 'FAIL') {
      const proof = proofs.get(claim.id);
      if (!proof) {
        addHold(holds, 'PROOF_REFERENCE_MISSING', 'effective claim lacks a digest-bound proof reference: ' + claim.id);
      } else {
        if (METHOD_SURFACES[proof.method] !== claim.required_surface) addHold(holds, 'PROOF_SURFACE_MISMATCH', claim.id + ' requires ' + claim.required_surface + ' but proof method maps to ' + METHOD_SURFACES[proof.method]);
        if (claim.source !== proof.evidenceRef.id) addHold(holds, 'PROOF_SOURCE_REFERENCE_MISMATCH', claim.id + ' source pointer does not match its proof reference id');
      }
    }
  });
  proofRefs.forEach(proof => {
    if (!(evidenceReceipt.observations || []).some(claim => claim.id === proof.claimId)) addHold(holds, 'PROOF_ORPHAN_REFERENCE', 'proof reference has no matching claim: ' + proof.claimId);
  });
  return {
    integrity: integrity.ok ? 'MATCH' : 'MISMATCH',
    status: evidenceReceipt.status,
    claims: evidenceReceipt.counts && evidenceReceipt.counts.claims || 0,
    pass: evidenceReceipt.counts && evidenceReceipt.counts.claims_passed || 0,
    fail: evidenceReceipt.counts && evidenceReceipt.counts.claims_failed || 0,
    unknown: evidenceReceipt.counts && evidenceReceipt.counts.claims_unknown || 0,
    routeState: holds.some(item => item.code.startsWith('EVIDENCE_') || item.code.startsWith('PROOF_')) ? 'HELD' : 'ROUTED'
  };
}

function normalizeSignals(values, seats, knownRefs) {
  if (!Array.isArray(values)) throw new Error('signals must be an array');
  if (values.length > 128) throw new Error('signals exceeds 128 entries');
  const seatIds = new Set(seats.map(value => value.id));
  const result = values.map((value, index) => {
    value = object(value, 'signals[' + index + ']');
    exactKeys(value, ['id', 'statement', 'evidenceStage', 'sourceRefs', 'seatIds', 'cheapestTest', 'uncertainty', 'solutionAlternatives', 'contradictions', 'wildcard'], 'signals[' + index + ']');
    const evidenceStage = String(value.evidenceStage || '').toUpperCase();
    if (!SIGNAL_STAGES.includes(evidenceStage)) throw new Error('signals[' + index + '] evidenceStage is unsupported');
    const sources = normalizeReferences(value.sourceRefs || [], 'signals[' + index + '] sourceRefs', 1, 32);
    sources.forEach(ref => {
      if (!knownRefs.has(refKey(ref))) throw new Error('signals[' + index + '] source reference is outside declared new information or proof: ' + ref.id);
    });
    const sourceSeats = normalizeStrings(value.seatIds || [], 'signals[' + index + '] seatIds', 1, 32, 180);
    sourceSeats.forEach(id => {
      if (!seatIds.has(id)) throw new Error('signals[' + index + '] references an unknown seat: ' + id);
    });
    return {
      id: portableId(value.id, 'signals[' + index + '] id', 180),
      statement: text(value.statement, 'signals[' + index + '] statement', 2400),
      evidenceStage,
      sourceRefs: sources,
      seatIds: sourceSeats.sort(),
      cheapestTest: text(value.cheapestTest, 'signals[' + index + '] cheapestTest', 1200),
      uncertainty: text(value.uncertainty, 'signals[' + index + '] uncertainty', 1200),
      solutionAlternatives: normalizeStrings(value.solutionAlternatives || [], 'signals[' + index + '] solutionAlternatives', 1, 16, 600),
      contradictions: normalizeStrings(value.contradictions || [], 'signals[' + index + '] contradictions', 0, 16, 600),
      wildcard: value.wildcard === true,
      truthWeight: 'NONE'
    };
  });
  const ids = result.map(value => value.id);
  if (new Set(ids).size !== ids.length) throw new Error('signals contains duplicate ids');
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeTransportChecks(values) {
  if (!Array.isArray(values)) throw new Error('transportChecks must be an array');
  if (values.length > 128) throw new Error('transportChecks exceeds 128 entries');
  const result = values.map((value, index) => {
    value = object(value, 'transportChecks[' + index + ']');
    exactKeys(value, ['id', 'payloadRef', 'senderReceiptRef', 'receiverReceiptRef', 'senderDigest', 'receiverDigest'], 'transportChecks[' + index + ']');
    return {
      id: portableId(value.id, 'transportChecks[' + index + '] id', 180),
      payloadRef: normalizeReference(value.payloadRef, 'transportChecks[' + index + '] payload'),
      senderReceiptRef: normalizeReference(value.senderReceiptRef, 'transportChecks[' + index + '] sender receipt'),
      receiverReceiptRef: normalizeReference(value.receiverReceiptRef, 'transportChecks[' + index + '] receiver receipt'),
      senderDigest: digest(value.senderDigest, 'transportChecks[' + index + '] senderDigest'),
      receiverDigest: digest(value.receiverDigest, 'transportChecks[' + index + '] receiverDigest')
    };
  });
  const ids = result.map(value => value.id);
  if (new Set(ids).size !== ids.length) throw new Error('transportChecks contains duplicate ids');
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

function evaluateTransport(checks, holds) {
  checks.forEach(check => {
    if (check.senderDigest !== check.receiverDigest || check.senderDigest !== check.payloadRef.sha256) {
      addHold(holds, 'TRANSPORT_DIGEST_MISMATCH', check.id + ' sender, receiver, and payload digests do not agree');
    }
  });
  return { state: holds.some(item => item.code.startsWith('TRANSPORT_')) ? 'HELD' : 'MATCHED', count: checks.length };
}

function normalizePermissionChecks(values) {
  if (!Array.isArray(values)) throw new Error('permissionChecks must be an array');
  if (values.length > 128) throw new Error('permissionChecks exceeds 128 entries');
  const result = values.map((value, index) => {
    value = object(value, 'permissionChecks[' + index + ']');
    exactKeys(value, ['permission', 'declared', 'allowedAttempt', 'deniedAttempt'], 'permissionChecks[' + index + ']');
    const declared = String(value.declared || '').toUpperCase();
    if (!['ALLOW', 'DENY', 'NONE'].includes(declared)) throw new Error('permissionChecks[' + index + '] declared is unsupported');
    function attempt(input, label) {
      input = object(input, label);
      exactKeys(input, ['result', 'receiptRef'], label);
      const result = String(input.result || '').toUpperCase();
      if (!['ALLOWED', 'DENIED', 'NOT_RUN'].includes(result)) throw new Error(label + ' result is unsupported');
      return { result, receiptRef: normalizeReference(input.receiptRef, label + ' receipt') };
    }
    return {
      permission: portableId(value.permission, 'permissionChecks[' + index + '] permission', 180),
      declared,
      allowedAttempt: attempt(value.allowedAttempt, 'permissionChecks[' + index + '] allowedAttempt'),
      deniedAttempt: attempt(value.deniedAttempt, 'permissionChecks[' + index + '] deniedAttempt')
    };
  });
  const permissions = result.map(value => value.permission);
  if (new Set(permissions).size !== permissions.length) throw new Error('permissionChecks contains duplicate permissions');
  return result.sort((a, b) => a.permission.localeCompare(b.permission));
}

function evaluatePermissions(checks, holds) {
  checks.forEach(check => {
    const valid = check.declared === 'ALLOW'
      ? check.allowedAttempt.result === 'ALLOWED' && check.deniedAttempt.result === 'DENIED'
      : check.allowedAttempt.result === 'DENIED' && check.deniedAttempt.result === 'DENIED';
    if (!valid) addHold(holds, 'PERMISSION_RUNTIME_MISMATCH', check.permission + ' declared ' + check.declared + ' but runtime attempts disagree');
  });
  return { state: holds.some(item => item.code.startsWith('PERMISSION_')) ? 'HELD' : 'MATCHED', count: checks.length };
}

function normalizeHandoffs(values) {
  if (!Array.isArray(values)) throw new Error('handoffs must be an array');
  if (values.length > 128) throw new Error('handoffs exceeds 128 entries');
  const result = values.map((value, index) => {
    value = object(value, 'handoffs[' + index + ']');
    exactKeys(value, ['id', 'fromSeatId', 'toSeatId', 'payloadRef', 'senderReceiptRef', 'receiverReceiptRef'], 'handoffs[' + index + ']');
    return {
      id: portableId(value.id, 'handoffs[' + index + '] id', 180),
      fromSeatId: portableId(value.fromSeatId, 'handoffs[' + index + '] fromSeatId', 180),
      toSeatId: portableId(value.toSeatId, 'handoffs[' + index + '] toSeatId', 180),
      payloadRef: normalizeReference(value.payloadRef, 'handoffs[' + index + '] payload'),
      senderReceiptRef: normalizeReference(value.senderReceiptRef, 'handoffs[' + index + '] sender receipt'),
      receiverReceiptRef: normalizeReference(value.receiverReceiptRef, 'handoffs[' + index + '] receiver receipt')
    };
  });
  const ids = result.map(value => value.id);
  if (new Set(ids).size !== ids.length) throw new Error('handoffs contains duplicate ids');
  const edges = result.map(value => value.fromSeatId + '>' + value.toSeatId + '|' + refKey(value.payloadRef));
  if (new Set(edges).size !== edges.length) throw new Error('handoffs contains duplicate edges');
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

function evaluateHandoffs(handoffs, seats, holds) {
  const seatIds = new Set(seats.map(value => value.id));
  const graph = new Map();
  handoffs.forEach(handoff => {
    if (!seatIds.has(handoff.fromSeatId) || !seatIds.has(handoff.toSeatId)) addHold(holds, 'HANDOFF_UNKNOWN_SEAT', handoff.id + ' references an unknown seat');
    if (handoff.fromSeatId === handoff.toSeatId) addHold(holds, 'HANDOFF_SELF_LOOP', handoff.id + ' is a self handoff');
    if (!graph.has(handoff.fromSeatId)) graph.set(handoff.fromSeatId, []);
    graph.get(handoff.fromSeatId).push(handoff.toSeatId);
  });
  const visiting = new Set(), visited = new Set();
  function walk(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of graph.get(id) || []) if (walk(next)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  for (const id of graph.keys()) {
    if (walk(id)) {
      addHold(holds, 'HANDOFF_CYCLE', 'handoff graph contains a cycle');
      break;
    }
  }
  return { state: holds.some(item => item.code.startsWith('HANDOFF_')) ? 'HELD' : 'ACYCLIC', count: handoffs.length };
}

function normalizeHumanReview(input) {
  input = object(input, 'humanReview');
  exactKeys(input, ['required', 'verdict', 'comprehension', 'receiptRef', 'actorKind'], 'humanReview');
  const verdict = String(input.verdict || '').toUpperCase();
  const comprehension = String(input.comprehension || '').toUpperCase();
  if (!['PASS', 'FAIL', 'NOT_RUN'].includes(verdict)) throw new Error('humanReview verdict is unsupported');
  if (!['IMPROVED', 'UNCHANGED', 'WORSE', 'UNKNOWN'].includes(comprehension)) throw new Error('humanReview comprehension is unsupported');
  if (input.actorKind !== 'HUMAN') throw new Error('humanReview actorKind must be HUMAN');
  return {
    required: input.required === true,
    verdict,
    comprehension,
    receiptRef: input.receiptRef ? normalizeReference(input.receiptRef, 'humanReview receipt') : null,
    actorKind: 'HUMAN'
  };
}

function normalizeAuthorityAttempts(values) {
  if (!Array.isArray(values)) throw new Error('authorityAttempts must be an array');
  if (values.length > 128) throw new Error('authorityAttempts exceeds 128 entries');
  const result = values.map((value, index) => {
    value = object(value, 'authorityAttempts[' + index + ']');
    exactKeys(value, ['id', 'actorId', 'actorKind', 'action', 'attempted', 'receiptRef'], 'authorityAttempts[' + index + ']');
    const actorKind = String(value.actorKind || '').toUpperCase();
    const action = String(value.action || '').toUpperCase();
    if (!['CANDIDATE', 'MODEL', 'TOOL'].includes(actorKind)) throw new Error('authorityAttempts[' + index + '] actorKind is unsupported');
    if (!AUTHORITY_ACTIONS.includes(action)) throw new Error('authorityAttempts[' + index + '] action is unsupported');
    return {
      id: portableId(value.id, 'authorityAttempts[' + index + '] id', 180),
      actorId: portableId(value.actorId, 'authorityAttempts[' + index + '] actorId', 180),
      actorKind,
      action,
      attempted: value.attempted === true,
      receiptRef: normalizeReference(value.receiptRef, 'authorityAttempts[' + index + '] receipt')
    };
  });
  const ids = result.map(value => value.id);
  if (new Set(ids).size !== ids.length) throw new Error('authorityAttempts contains duplicate ids');
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

function evaluateAuthorityAttempts(attempts, seats, holds) {
  const seatIds = new Set(seats.map(value => value.id));
  attempts.forEach(attempt => {
    if (attempt.actorKind === 'MODEL' && !seatIds.has(attempt.actorId)) {
      addHold(holds, 'AUTHORITY_ATTEMPT_MODEL_SEAT_MISSING', attempt.id + ' names an undeclared model seat');
    }
    if (attempt.attempted) {
      addHold(holds, 'AUTHORITY_FORBIDDEN_ATTEMPT', attempt.actorKind + ' ' + attempt.actorId + ' attempted ' + attempt.action);
    }
  });
  return { state: holds.some(item => item.code.startsWith('AUTHORITY_')) ? 'HELD' : 'NONE_ATTEMPTED', count: attempts.length };
}

function evaluateHumanReview(review, holds) {
  if (review.comprehension === 'WORSE') addHold(holds, 'HUMAN_COMPREHENSION_WORSE', 'human comprehension was worse despite structured references');
  if (review.required && (review.verdict !== 'PASS' || !review.receiptRef || review.comprehension === 'UNKNOWN')) {
    addHold(holds, 'HUMAN_REVIEW_INCOMPLETE', 'required human review is not complete');
  }
  return { state: holds.some(item => item.code.startsWith('HUMAN_')) ? 'HELD' : (review.required ? 'PASSED' : 'NOT_REQUIRED') };
}

function normalizeCycleInput(input) {
  if (input == null) return null;
  input = object(input, 'cycle');
  exactKeys(input, ['cycleId', 'capabilityId', 'generatedAt', 'gap', 'provenance', 'candidate', 'verification', 'decision', 'availability', 'refresh'], 'cycle');
  const nested = [
    ['gap', ['state', 'reason', 'reportRef', 'existingCapabilityRef']],
    ['candidate', ['strategy', 'status', 'artifactRef', 'sourceMutationPerformed', 'installed', 'promoted', 'canon']],
    ['verification', ['verdict', 'subjectDigest', 'receiptRef', 'evidenceAuthority', 'limitations']],
    ['decision', ['verdict', 'actorKind', 'actorId', 'candidateDigest', 'confirmation', 'decisionRef']],
    ['availability', ['status', 'candidateDigest', 'authorityId', 'receiptRef']],
    ['refresh', ['trigger', 'checkedAt', 'due', 'reason']]
  ];
  nested.forEach(([field, keys]) => {
    if (input[field] != null) exactKeys(object(input[field], 'cycle ' + field), keys, 'cycle ' + field);
  });
  return clone(input);
}

function addHold(holds, code, detail) {
  if (!holds.some(item => item.code === code && item.detail === detail)) holds.push({ code, detail });
}

function evaluateOutputClosures(closures, requiredRefs, embeddedRefs, holds) {
  const byKey = new Map(closures.map(value => [refKey(value.dependencyRef), value]));
  const embedded = new Set(embeddedRefs.map(refKey));
  const required = new Map(requiredRefs.map(ref => [refKey(ref), ref]));
  required.forEach((ref, key) => {
    if (embedded.has(key)) return;
    const closure = byKey.get(key);
    if (!closure) {
      addHold(holds, 'OUTPUT_CLOSURE_MISSING', 'later dependency has no closure check: ' + ref.id);
      return;
    }
    if (closure.state !== 'CURRENT') addHold(holds, 'OUTPUT_DEPENDENCY_' + closure.state, ref.id + ' closure state is ' + closure.state);
    if (closure.summarySubstituted || closure.state === 'SUMMARY_SUBSTITUTED') addHold(holds, 'OUTPUT_SUMMARY_SUBSTITUTED', ref.id + ' summary cannot replace the bound output');
    if (!closure.observedRef || refKey(closure.observedRef) !== key) addHold(holds, 'OUTPUT_OBSERVED_IDENTITY_MISMATCH', ref.id + ' observed identity does not match the dependency');
  });
  closures.forEach(closure => {
    if (!required.has(refKey(closure.dependencyRef))) addHold(holds, 'OUTPUT_UNDECLARED_CLOSURE', 'closure is not used by the run: ' + closure.dependencyRef.id);
  });
  return {
    state: holds.some(item => item.code.startsWith('OUTPUT_')) ? 'HELD' : 'CURRENT',
    required: required.size,
    checked: closures.length
  };
}

function collectRequiredRefs(parts) {
  const refs = [];
  function add(ref) { if (ref) refs.push(ref); }
  add(parts.need.sourceRef); add(parts.need.directionRef);
  parts.newInformationRefs.forEach(add);
  parts.seats.forEach(seat => add(seat.provenanceRef));
  parts.adapters.forEach(adapter => {
    add(adapter.inputSchemaRef); add(adapter.outputSchemaRef); add(adapter.translationReceiptRef); adapter.unsupportedFieldRefs.forEach(add);
  });
  add(parts.budget.usage.usageRef);
  parts.artifactAncestry.nodes.forEach(node => { add(node.artifactRef); node.assumptionRefs.forEach(add); });
  parts.ideaEvidenceAncestry.items.forEach(add);
  parts.proofRefs.forEach(proof => add(proof.evidenceRef));
  parts.transportChecks.forEach(check => { add(check.payloadRef); add(check.senderReceiptRef); add(check.receiverReceiptRef); });
  parts.permissionChecks.forEach(check => { add(check.allowedAttempt.receiptRef); add(check.deniedAttempt.receiptRef); });
  parts.handoffs.forEach(handoff => { add(handoff.payloadRef); add(handoff.senderReceiptRef); add(handoff.receiverReceiptRef); });
  add(parts.humanReview.receiptRef);
  add(parts.previousCycleRef);
  parts.authorityAttempts.forEach(attempt => add(attempt.receiptRef));
  if (parts.cycleReceipt) {
    add(parts.cycleReceipt.gap && parts.cycleReceipt.gap.reportRef);
    add(parts.cycleReceipt.gap && parts.cycleReceipt.gap.existingCapabilityRef);
    (parts.cycleReceipt.provenance || []).forEach(add);
    add(parts.cycleReceipt.candidate && parts.cycleReceipt.candidate.artifactRef);
    add(parts.cycleReceipt.verification && parts.cycleReceipt.verification.receiptRef);
    add(parts.cycleReceipt.stewardDecision && parts.cycleReceipt.stewardDecision.decisionRef);
    add(parts.cycleReceipt.availability && parts.cycleReceipt.availability.receiptRef);
  }
  return Array.from(new Map(refs.map(ref => [refKey(ref), ref])).values());
}

function noNewCycle(runId, generatedAt, baseline, need, comparison, existingCapabilityRef) {
  return Loop.build({
    cycleId: runId + ':cycle',
    capabilityId: 'simulation.baseline.no-new-information',
    generatedAt,
    baseline: Capsule.toVerifiedCapabilityBaseline(baseline),
    need,
    gap: {
      state: 'NO_GAP',
      reason: 'The exact baseline and declared new-information set are unchanged; no recursive generation is justified.',
      reportRef: reference(comparison, { id: runId + ':baseline-comparison', schema: comparison.schema || 'axm.baseline-comparison/v1' }),
      existingCapabilityRef
    },
    provenance: [], candidate: null, verification: null, decision: null, availability: null,
    refresh: { trigger: 'NEW_INFORMATION', checkedAt: generatedAt, due: false, reason: 'No new evidence, counterexample, requirement, or failure was declared.' }
  });
}

function activeCycle(cycleInput, baseline, need) {
  return Loop.build({
    cycleId: cycleInput.cycleId,
    capabilityId: cycleInput.capabilityId,
    generatedAt: cycleInput.generatedAt,
    baseline: Capsule.toVerifiedCapabilityBaseline(baseline),
    need,
    gap: cycleInput.gap,
    provenance: cycleInput.provenance,
    candidate: cycleInput.candidate,
    verification: cycleInput.verification,
    decision: cycleInput.decision,
    availability: cycleInput.availability,
    refresh: cycleInput.refresh
  });
}

function cycleState(cycle) {
  const states = {
    NEEDS_GAP_EVIDENCE: 'GAP_EVIDENCE_NEEDED',
    REUSE_EXISTING: 'EXISTING_CAPABILITY_RECORDED',
    GAP_OPEN: 'GAP_RECORDED',
    CANDIDATE_UNVERIFIED: 'CANDIDATE_RECORDED',
    REPAIR_OR_REJECT: 'REPAIR_OR_REJECT',
    VERIFICATION_HOLD: 'EVIDENCE_HOLD',
    AWAITING_STEWARD: 'AWAITING_HUMAN_REVIEW',
    STEWARD_HOLD: 'HUMAN_HOLD',
    REJECTED: 'REJECTED',
    READY_FOR_GOVERNED_INTAKE: 'READY_FOR_GOVERNED_INTAKE',
    AVAILABLE_FOR_REUSE: 'AVAILABLE_FOR_REUSE',
    REFRESH_DUE: 'REFRESH_DUE'
  };
  return states[cycle.state] || 'CYCLE_HOLD';
}

function deriveState(holds, noNewInformation, cycle) {
  if (holds.length) {
    for (const [prefix, state] of HOLD_STATES) if (holds.some(item => item.code.startsWith(prefix))) return state;
    return 'CONTRACT_HOLD';
  }
  if (noNewInformation) return 'NO_NEW_INFORMATION';
  return cycleState(cycle);
}

async function build(input) {
  input = object(input, 'run input');
  exactKeys(input, [
    'runId', 'generatedAt', 'baselineCapsule', 'priorBaselineCapsule', 'previousCycleRef',
    'need', 'newInformationRefs', 'seats', 'adapters', 'budget', 'outputClosures',
    'artifactAncestry', 'ideaEvidenceAncestry', 'evidenceReceipt', 'proofRefs', 'signals',
    'transportChecks', 'permissionChecks', 'handoffs', 'humanReview', 'authorityAttempts', 'cycle'
  ], 'run input');

  const holds = [];
  const runId = portableId(input.runId, 'runId', 180);
  const generatedAt = timestamp(input.generatedAt, 'generatedAt');
  const baseline = clone(input.baselineCapsule);
  const baselineCheck = Capsule.verify(baseline);
  if (!baselineCheck.pass) throw new Error('baseline capsule is invalid: ' + baselineCheck.errors.join('; '));
  const currentRef = Capsule.capsuleReference(baseline);
  let prior = input.priorBaselineCapsule == null ? null : clone(input.priorBaselineCapsule);
  let priorRef = null;
  let comparison;
  if (prior) {
    const priorCheck = Capsule.verify(prior);
    if (!priorCheck.pass) throw new Error('prior baseline capsule is invalid: ' + priorCheck.errors.join('; '));
    priorRef = Capsule.capsuleReference(prior);
    comparison = Capsule.compare(prior, baseline, { comparisonId: runId + ':baseline-comparison', comparedAt: generatedAt });
    if (comparison.state === 'INCOMPARABLE') addHold(holds, 'BASELINE_INCOMPARABLE', 'prior and current capsules identify different subjects');
  } else {
    comparison = {
      schema: 'axm.baseline-first-observation/v1',
      state: 'FIRST_OBSERVATION',
      priorRef: null,
      currentRef,
      refreshRequired: baseline.freshness.refreshRequired,
      automaticAction: false,
      receiptDigest: sha256({ runId, currentRef, state: 'FIRST_OBSERVATION' })
    };
  }

  const previousCycleRef = input.previousCycleRef ? normalizeReference(input.previousCycleRef, 'previousCycleRef') : null;
  const need = normalizeNeed(input.need);
  const newInformationRefs = normalizeReferences(input.newInformationRefs || [], 'newInformationRefs', 0, 128);
  const seats = normalizeSeats(input.seats);
  const adapters = normalizeAdapters(input.adapters, baseline.subject.kind);
  const budget = normalizeBudget(input.budget);
  const budgetAssessment = evaluateBudget(budget, holds);
  const outputClosures = normalizeClosures(input.outputClosures || []);
  const artifactAncestry = normalizeArtifactAncestry(input.artifactAncestry);
  const artifactAssessment = evaluateArtifactAncestry(artifactAncestry, currentRef, priorRef, comparison, holds);
  const ideaEvidenceAncestry = normalizeIdeaEvidenceAncestry(input.ideaEvidenceAncestry);
  const ideaEvidenceAssessment = evaluateIdeaEvidenceAncestry(ideaEvidenceAncestry, artifactAncestry, need, newInformationRefs, holds);
  const evidenceReceipt = clone(object(input.evidenceReceipt, 'evidenceReceipt'));
  const evidenceIntegrity = await Evidence.verify(evidenceReceipt);
  const proofRefs = normalizeProofRefs(input.proofRefs || []);
  const evidenceAssessment = evaluateEvidence(evidenceReceipt, proofRefs, evidenceIntegrity, holds);
  const knownSignalRefs = new Set(newInformationRefs.concat(proofRefs.map(value => value.evidenceRef)).map(refKey));
  const signals = normalizeSignals(input.signals || [], seats, knownSignalRefs);
  const transportChecks = normalizeTransportChecks(input.transportChecks || []);
  const transportAssessment = evaluateTransport(transportChecks, holds);
  const permissionChecks = normalizePermissionChecks(input.permissionChecks || []);
  const permissionAssessment = evaluatePermissions(permissionChecks, holds);
  const handoffs = normalizeHandoffs(input.handoffs || []);
  const handoffAssessment = evaluateHandoffs(handoffs, seats, holds);
  const humanReview = normalizeHumanReview(input.humanReview);
  const humanReviewAssessment = evaluateHumanReview(humanReview, holds);
  const authorityAttempts = normalizeAuthorityAttempts(input.authorityAttempts || []);
  const authorityAssessment = evaluateAuthorityAttempts(authorityAttempts, seats, holds);
  const cycleInput = normalizeCycleInput(input.cycle);

  const noNewInformation = !!prior && comparison.state === 'NO_NEW_INFORMATION' && newInformationRefs.length === 0 && signals.length === 0;
  if (!prior && newInformationRefs.length === 0) addHold(holds, 'NO_NEW_FIRST_RUN_INFORMATION_MISSING', 'a first observation needs declared new information');
  if (comparison.state === 'BASELINE_CHANGED' && newInformationRefs.length === 0) addHold(holds, 'BASELINE_CHANGED_WITHOUT_NEW_INFORMATION', 'changed baseline needs an explicit evidence, requirement, counterexample, or failure reference');
  if (signals.length && !newInformationRefs.length) addHold(holds, 'NO_NEW_SIGNAL_WITHOUT_INFORMATION', 'signals cannot appear without declared new information');
  if (noNewInformation && cycleInput) addHold(holds, 'NO_NEW_CYCLE_INPUT_FORBIDDEN', 'no-new-information run must not supply a recursive cycle candidate');
  if (noNewInformation && (budget.usage.executionPerformed || budget.usage.timeMs || budget.usage.storageBytes || budget.usage.peakConcurrency || budget.usage.retries)) {
    addHold(holds, 'NO_NEW_GENERATION_WORK_PERFORMED', 'no-new-information run spent the declared generation budget');
  }
  if (noNewInformation && !previousCycleRef) addHold(holds, 'NO_NEW_EXISTING_CAPABILITY_REFERENCE_MISSING', 'no-new-information run needs the existing capability reference it is reusing');
  if (!noNewInformation && !cycleInput) addHold(holds, 'CYCLE_INPUT_MISSING', 'a run with new information needs one Verified Capability Cycle input');

  const evidenceRef = evidenceReceipt.integrity && DIGEST.test(String(evidenceReceipt.integrity.digest || ''))
    ? { id: runId + ':evidence-receipt', schema: Evidence.RECEIPT_SCHEMA, sha256: evidenceReceipt.integrity.digest }
    : null;

  let cycleReceipt;
  if (noNewInformation && previousCycleRef) {
    cycleReceipt = noNewCycle(runId, generatedAt, baseline, need, comparison, previousCycleRef);
  } else if (cycleInput) {
    try {
      cycleReceipt = activeCycle(cycleInput, baseline, need);
    } catch (error) {
      addHold(holds, 'CYCLE_INVALID', error.message);
      cycleReceipt = null;
    }
  } else {
    cycleReceipt = null;
  }
  if (cycleReceipt && !Loop.verify(cycleReceipt).pass) addHold(holds, 'CYCLE_RECEIPT_INVALID', 'Verified Capability Cycle receipt did not verify');
  if (cycleReceipt && !noNewInformation) {
    const provenanceKeys = new Set(cycleReceipt.provenance.map(refKey));
    newInformationRefs.forEach(ref => {
      if (!provenanceKeys.has(refKey(ref))) addHold(holds, 'CYCLE_NEW_INFORMATION_PROVENANCE_MISSING', 'cycle provenance omits ' + ref.id);
    });
    if (cycleReceipt.stewardDecision) {
      const actor = seats.find(seat => seat.id === cycleReceipt.stewardDecision.actorId);
      if (!actor || actor.kind !== 'HUMAN') addHold(holds, 'AUTHORITY_DECISION_ACTOR_NOT_HUMAN_SEAT', 'cycle human decision is not bound to a declared human seat');
    }
    if (cycleReceipt.availability) {
      const modelSeatIds = new Set(seats.filter(seat => seat.kind === 'MODEL').map(seat => seat.id));
      if (modelSeatIds.has(cycleReceipt.availability.authorityId)) addHold(holds, 'AUTHORITY_MODEL_SELF_AVAILABILITY', 'model seat attempted to certify availability');
      if (cycleReceipt.candidate && cycleReceipt.availability.authorityId === cycleReceipt.candidate.artifactRef.id) addHold(holds, 'AUTHORITY_CANDIDATE_SELF_AVAILABILITY', 'candidate attempted to certify its own availability');
    }
  }

  const requiredRefs = collectRequiredRefs({
    need, newInformationRefs, seats, adapters, budget, artifactAncestry, ideaEvidenceAncestry,
    proofRefs, transportChecks, permissionChecks, handoffs, humanReview, previousCycleRef,
    authorityAttempts, cycleReceipt
  });
  const embeddedRefs = [currentRef];
  if (priorRef) embeddedRefs.push(priorRef);
  if (evidenceRef) embeddedRefs.push(evidenceRef);
  if (cycleReceipt && cycleReceipt.gap && cycleReceipt.gap.reportRef && cycleReceipt.gap.reportRef.id === runId + ':baseline-comparison') {
    embeddedRefs.push(cycleReceipt.gap.reportRef);
  }
  const closureAssessment = evaluateOutputClosures(outputClosures, requiredRefs, embeddedRefs, holds);

  const commonModeCautions = [];
  if (seats.some(seat => seat.priorOutputExposure !== 'NONE')) commonModeCautions.push('PRIOR_OUTPUT_EXPOSURE');
  if (seats.some(seat => seat.identityDisclosure !== 'EXACT')) commonModeCautions.push('SEAT_IDENTITY_DISCLOSURE_GAP');
  const modelSeats = seats.filter(seat => seat.kind === 'MODEL');
  const independenceEstablished = modelSeats.length > 0 && modelSeats.every(seat => seat.priorOutputExposure === 'NONE' && seat.identityDisclosure === 'EXACT');
  if (!independenceEstablished && modelSeats.length) commonModeCautions.push('INDEPENDENCE_NOT_ESTABLISHED');

  const state = deriveState(holds, noNewInformation, cycleReceipt);
  const receipt = {
    schema: RUN_SCHEMA,
    version: VERSION,
    runId,
    generatedAt,
    state,
    baseline: { current: baseline, prior, comparison },
    previousCycleRef,
    need,
    newInformationRefs,
    seats,
    adapters,
    budget: { limits: budget.limits, usage: budget.usage, assessment: budgetAssessment },
    outputClosures,
    closureAssessment,
    artifactAncestry,
    ideaEvidenceAncestry,
    ancestryAssessment: { artifact: artifactAssessment, ideaEvidence: ideaEvidenceAssessment },
    evidence: { receipt: evidenceReceipt, receiptRef: evidenceRef, proofRefs, assessment: evidenceAssessment },
    signals,
    transportChecks,
    transportAssessment,
    permissionChecks,
    permissionAssessment,
    handoffs,
    handoffAssessment,
    humanReview,
    humanReviewAssessment,
    authorityAttempts,
    authorityAssessment,
    cycleInput,
    cycleReceipt,
    analysis: {
      noNewInformation,
      seatCount: seats.length,
      modelSeatCount: modelSeats.length,
      independenceEstablished,
      commonModeCautions,
      crossModelAgreementIsProof: false,
      rankingPerformed: false,
      majorityDecisionPerformed: false
    },
    holds,
    truth: {
      authority: 'EVIDENCE_GAP_CANDIDATE_AND_REVIEW_PACKET_ONLY',
      sourceExecutedByLab: false,
      modelInvokedByLab: false,
      automaticNextGeneration: false,
      automaticBuild: false,
      automaticWrite: false,
      automaticInstall: false,
      automaticPermissionGrant: false,
      automaticPromotion: false,
      automaticMerge: false,
      automaticCanon: false,
      foundationMutation: false,
      modelWeightTrainingClaimed: false,
      publication: false,
      push: false,
      humanMergeGateRequired: true
    },
    receiptDigest: null
  };
  const payload = clone(receipt);
  delete payload.receiptDigest;
  receipt.receiptDigest = sha256(payload);
  return receipt;
}

async function verify(receipt) {
  const errors = [];
  if (!receipt || receipt.schema !== RUN_SCHEMA) return { pass: false, errors: ['run schema mismatch'] };
  if (receipt.version !== VERSION) errors.push('run version mismatch');
  let rebuilt = null;
  try {
    rebuilt = await build({
      runId: receipt.runId,
      generatedAt: receipt.generatedAt,
      baselineCapsule: receipt.baseline.current,
      priorBaselineCapsule: receipt.baseline.prior,
      previousCycleRef: receipt.previousCycleRef,
      need: receipt.need,
      newInformationRefs: receipt.newInformationRefs,
      seats: receipt.seats,
      adapters: receipt.adapters,
      budget: { limits: receipt.budget.limits, usage: receipt.budget.usage },
      outputClosures: receipt.outputClosures,
      artifactAncestry: receipt.artifactAncestry,
      ideaEvidenceAncestry: receipt.ideaEvidenceAncestry,
      evidenceReceipt: receipt.evidence.receipt,
      proofRefs: receipt.evidence.proofRefs,
      signals: receipt.signals.map(signal => {
        const inputSignal = clone(signal);
        delete inputSignal.truthWeight;
        return inputSignal;
      }),
      transportChecks: receipt.transportChecks,
      permissionChecks: receipt.permissionChecks,
      handoffs: receipt.handoffs,
      humanReview: receipt.humanReview,
      authorityAttempts: receipt.authorityAttempts,
      cycle: receipt.cycleInput
    });
  } catch (error) {
    errors.push('run content invalid: ' + error.message);
  }
  if (rebuilt) {
    if (stableStringify(rebuilt) !== stableStringify(receipt)) errors.push('run content or derived state mismatch');
    if (rebuilt.receiptDigest !== receipt.receiptDigest) errors.push('run receipt digest mismatch');
  }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  RUN_SCHEMA,
  VERSION,
  METHOD_SURFACES: clone(METHOD_SURFACES),
  stableStringify,
  sha256,
  reference,
  build,
  verify
};
