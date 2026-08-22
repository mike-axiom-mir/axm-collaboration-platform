'use strict';

const crypto = require('node:crypto');
const Checkpoint = require('../deterministic-pr-checkpoint/checkpoint-core');

const DECLARATION_SCHEMA = 'axm.local-continuation-declaration/v1';
const CAPSULE_SCHEMA = 'axm.local-continuation-capsule/v1';
const VERIFICATION_SCHEMA = 'axm.local-continuation-capsule-verification/v1';
const CARD_SCHEMA = 'axm.local-continuation-resume-card/v1';
const CARD_VERIFICATION_SCHEMA = 'axm.local-continuation-resume-card-verification/v1';
const POLICY_VERSION = 'axm-deterministic-continuation-capsule-policy/0.1';
const ALLOWED_STATUS = ['EXPERIMENTAL','TEST','WORKING'];
const ALLOWED_SOURCE_CLASS = ['CANONICAL_STATE','DURABLE_EVENT','DERIVED_VIEW','SESSION_SEGMENT'];
const REFUSED_SOURCE_CLASS = ['REPETITIVE_TELEMETRY','TEMPORARY_CAPTURE','PRIVATE_OR_USER_SOURCE','UNCLASSIFIED'];
const ALLOWED_FRESHNESS = ['STATIC','REPROBE_REQUIRED'];
const SENSITIVE_PATTERNS = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
  ['openai-key', /\bsk-[A-Za-z0-9_-]{24,}\b/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['github-fine-grained-token', /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ['authorization-header', /\bauthorization\s*:\s*(?:bearer|token)\s+\S+/i],
  ['private-windows-user-path', /\b[A-Za-z]:\\Users\\[^\\\r\n]+/i],
  ['private-posix-user-path', /(?:^|[\s`'"(])\/(?:home|Users)\/[^/\s]+\//],
  ['axm-machine-path', /\b[A-Za-z]:\\AXM_(?:ACTIVE|MIRROR_LOCAL)\\/i]
];

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function digest(value) { return Checkpoint.canonicalDigest(value); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function isDigest(value) { return /^[a-f0-9]{64}$/.test(String(value || '').toLowerCase()); }

function strictObject(value, label, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(label + ' must be an object');
  const unknown = Object.keys(value).filter(key => !allowed.includes(key));
  if (unknown.length) throw new TypeError(label + ' contains unknown field: ' + unknown.sort()[0]);
  return value;
}

function stableId(value, label) {
  const text = String(value || '').trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(text)) throw new TypeError(label + ' must be a stable identifier');
  return text;
}

function sensitiveFinding(text) {
  return SENSITIVE_PATTERNS.find(row => row[1].test(text));
}

function safeText(value, label, maximum) {
  const text = String(value === undefined || value === null ? '' : value).replace(/\r\n/g, '\n').trim();
  if (!text) throw new TypeError(label + ' is required');
  if (text.length > maximum) throw new TypeError(label + ' is too long');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new TypeError(label + ' contains control characters');
  const finding = sensitiveFinding(text);
  if (finding) throw new TypeError(label + ' contains sensitive or machine-local material (' + finding[0] + ')');
  return text;
}

function logicalLocator(value, label) {
  const text = safeText(value, label, 500);
  if (!/^(?:repo|receipt|local|evidence|governance):\/\/[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=:@\/-]{0,470}$/.test(text)) {
    throw new TypeError(label + ' must use a public-safe logical locator scheme');
  }
  return text;
}

function relativeInputPath(value, label) {
  const text = String(value || '').trim().replace(/\\/g, '/');
  if (!text || text.length > 800 || text.startsWith('/') || /^[A-Za-z]:\//.test(text)) throw new TypeError(label + ' must be a relative path');
  const parts = text.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw new TypeError(label + ' contains an unsafe segment');
  return text;
}

function stringList(value, label, maximumItems, maximumText) {
  if (!Array.isArray(value) || value.length > maximumItems) throw new TypeError(label + ' must be an array of at most ' + maximumItems + ' items');
  return Array.from(new Set(value.map((item, index) => safeText(item, label + '[' + index + ']', maximumText)))).sort();
}

function idList(value, label, maximumItems) {
  if (!Array.isArray(value) || value.length > maximumItems) throw new TypeError(label + ' must be an array of at most ' + maximumItems + ' items');
  return Array.from(new Set(value.map((item, index) => stableId(item, label + '[' + index + ']')))).sort();
}

function uniqueRows(rows, label) {
  const seen = new Set();
  rows.forEach(row => {
    if (seen.has(row.id)) throw new TypeError(label + ' contains duplicate id: ' + row.id);
    seen.add(row.id);
  });
  return rows;
}

function normalizeSource(value, index) {
  const label = 'sources[' + index + ']';
  const row = strictObject(value, label, ['id','inputPath','locator','mediaType','expectedSchema','expectedSha256','classification','freshness','role']);
  const mediaType = safeText(row.mediaType, label + '.mediaType', 100).toLowerCase();
  if (!['application/json','text/plain'].includes(mediaType)) throw new TypeError(label + '.mediaType is unsupported');
  const classification = safeText(row.classification, label + '.classification', 80).toUpperCase();
  if (!ALLOWED_SOURCE_CLASS.includes(classification) && !REFUSED_SOURCE_CLASS.includes(classification)) throw new TypeError(label + '.classification is unsupported');
  const freshness = safeText(row.freshness, label + '.freshness', 80).toUpperCase();
  if (!ALLOWED_FRESHNESS.includes(freshness)) throw new TypeError(label + '.freshness is unsupported');
  const expectedSchema = row.expectedSchema === null || row.expectedSchema === undefined ? null : safeText(row.expectedSchema, label + '.expectedSchema', 180);
  if (mediaType === 'application/json' && !expectedSchema) throw new TypeError(label + '.expectedSchema is required for JSON sources');
  if (mediaType !== 'application/json' && expectedSchema) throw new TypeError(label + '.expectedSchema is only valid for JSON sources');
  const expectedSha256 = String(row.expectedSha256 || '').toLowerCase();
  if (!isDigest(expectedSha256)) throw new TypeError(label + '.expectedSha256 must be SHA-256');
  return {
    id:stableId(row.id, label + '.id'),
    inputPath:relativeInputPath(row.inputPath, label + '.inputPath'),
    locator:logicalLocator(row.locator, label + '.locator'),
    mediaType,
    expectedSchema,
    expectedSha256,
    classification,
    freshness,
    role:safeText(row.role, label + '.role', 240)
  };
}

function normalizeDecision(value, index) {
  const label = 'decisions[' + index + ']';
  const row = strictObject(value, label, ['id','status','statement','rationale','evidenceRefs']);
  const status = safeText(row.status, label + '.status', 40).toUpperCase();
  if (!['ACTIVE','SUPERSEDED','HELD'].includes(status)) throw new TypeError(label + '.status is unsupported');
  return {
    id:stableId(row.id, label + '.id'),
    status,
    statement:safeText(row.statement, label + '.statement', 1000),
    rationale:safeText(row.rationale, label + '.rationale', 1000),
    evidenceRefs:idList(row.evidenceRefs, label + '.evidenceRefs', 20)
  };
}

function normalizeOpenLoop(value, index) {
  const label = 'openLoops[' + index + ']';
  const row = strictObject(value, label, ['id','ordinal','state','summary','nextAction','blockers','invalidatedBy','evidenceRefs']);
  const ordinal = Number(row.ordinal);
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 10000) throw new TypeError(label + '.ordinal must be a positive integer');
  const state = safeText(row.state, label + '.state', 40).toUpperCase();
  if (!['READY','WAITING','HELD'].includes(state)) throw new TypeError(label + '.state is unsupported');
  return {
    id:stableId(row.id, label + '.id'),
    ordinal,
    state,
    summary:safeText(row.summary, label + '.summary', 1000),
    nextAction:safeText(row.nextAction, label + '.nextAction', 1200),
    blockers:stringList(row.blockers, label + '.blockers', 20, 500),
    invalidatedBy:stringList(row.invalidatedBy, label + '.invalidatedBy', 20, 500),
    evidenceRefs:idList(row.evidenceRefs, label + '.evidenceRefs', 20)
  };
}

function normalizeDeclaration(input) {
  const source = strictObject(input, 'declaration', ['schema','id','status','identity','currentGoal','authorities','decisions','openLoops','sources','resumeRules']);
  if (source.schema !== DECLARATION_SCHEMA) throw new TypeError('declaration schema is unsupported');
  const status = safeText(source.status, 'status', 40).toUpperCase();
  if (!ALLOWED_STATUS.includes(status)) throw new TypeError('status must remain EXPERIMENTAL, TEST, or WORKING');
  const identity = strictObject(source.identity, 'identity', ['workingName','technicalSubstrate','distinction','sourceRefs']);
  const goal = strictObject(source.currentGoal, 'currentGoal', ['objective','active','completionRule','basis','evidenceRefs']);
  const basis = safeText(goal.basis, 'currentGoal.basis', 80).toUpperCase();
  if (!['DECLARED_DIRECTION','SOURCE_LINKED'].includes(basis)) throw new TypeError('currentGoal.basis is unsupported');
  const authorities = strictObject(source.authorities, 'authorities', ['allowedActions','refusedActions']);
  const decisions = uniqueRows((Array.isArray(source.decisions) ? source.decisions : []).map(normalizeDecision), 'decisions').sort((a,b) => a.id.localeCompare(b.id));
  const openLoops = uniqueRows((Array.isArray(source.openLoops) ? source.openLoops : []).map(normalizeOpenLoop), 'openLoops').sort((a,b) => a.ordinal - b.ordinal || a.id.localeCompare(b.id));
  const sources = uniqueRows((Array.isArray(source.sources) ? source.sources : []).map(normalizeSource), 'sources').sort((a,b) => a.id.localeCompare(b.id));
  if (!sources.length) throw new TypeError('at least one source is required');
  const normalizedGoal = {
    objective:safeText(goal.objective, 'currentGoal.objective', 3000),
    active:goal.active === true,
    completionRule:safeText(goal.completionRule, 'currentGoal.completionRule', 2000),
    basis,
    evidenceRefs:idList(goal.evidenceRefs || [], 'currentGoal.evidenceRefs', 20)
  };
  if (!normalizedGoal.active) throw new TypeError('currentGoal.active must be true for a continuation capsule');
  if (basis === 'SOURCE_LINKED' && !normalizedGoal.evidenceRefs.length) throw new TypeError('source-linked goal requires evidenceRefs');
  return {
    schema:DECLARATION_SCHEMA,
    id:stableId(source.id, 'id'),
    status,
    identity:{
      workingName:safeText(identity.workingName, 'identity.workingName', 120),
      technicalSubstrate:safeText(identity.technicalSubstrate, 'identity.technicalSubstrate', 240),
      distinction:safeText(identity.distinction, 'identity.distinction', 1000),
      sourceRefs:idList(identity.sourceRefs || [], 'identity.sourceRefs', 20)
    },
    currentGoal:normalizedGoal,
    authorities:{
      allowedActions:stringList(authorities.allowedActions, 'authorities.allowedActions', 40, 500),
      refusedActions:stringList(authorities.refusedActions, 'authorities.refusedActions', 60, 500)
    },
    decisions,
    openLoops,
    sources,
    resumeRules:stringList(source.resumeRules, 'resumeRules', 40, 700)
  };
}

function publicDeclaration(normalized) {
  const out = copy(normalized);
  out.sources = out.sources.map(row => {
    const source = copy(row);
    delete source.inputPath;
    return source;
  });
  return out;
}

function blocker(code, detail) { return Object.assign({ code }, detail || {}); }

function allEvidenceRows(declaration) {
  return [
    { id:'current-goal', refs:declaration.currentGoal.evidenceRefs },
    { id:'identity', refs:declaration.identity.sourceRefs }
  ].concat(declaration.decisions.map(row => ({ id:'decision:' + row.id, refs:row.evidenceRefs })))
    .concat(declaration.openLoops.map(row => ({ id:'open-loop:' + row.id, refs:row.evidenceRefs })));
}

function buildCapsule(input) {
  const declaration = normalizeDeclaration(input && input.declaration);
  const publicInput = publicDeclaration(declaration);
  const observations = Array.isArray(input && input.observations) ? input.observations : [];
  const observationMap = new Map();
  const blockers = [];
  observations.forEach(row => {
    if (!row || typeof row !== 'object' || !row.id || observationMap.has(row.id)) blockers.push(blocker('SOURCE_OBSERVATION_INVALID'));
    else observationMap.set(String(row.id), row);
  });
  const sourceIds = new Set(declaration.sources.map(row => row.id));
  declaration.sources.forEach(source => {
    if (REFUSED_SOURCE_CLASS.includes(source.classification)) blockers.push(blocker('SOURCE_CLASS_REFUSED', { sourceId:source.id, classification:source.classification }));
    const observed = observationMap.get(source.id);
    if (!observed) blockers.push(blocker('SOURCE_MISSING', { sourceId:source.id }));
    else {
      if (observed.sha256 !== source.expectedSha256) blockers.push(blocker('SOURCE_DIGEST_MISMATCH', { sourceId:source.id }));
      if (observed.mediaType !== source.mediaType) blockers.push(blocker('SOURCE_MEDIA_TYPE_MISMATCH', { sourceId:source.id }));
      if (source.expectedSchema && observed.schema !== source.expectedSchema) blockers.push(blocker('SOURCE_SCHEMA_MISMATCH', { sourceId:source.id }));
      if (!Number.isSafeInteger(observed.sizeBytes) || observed.sizeBytes < 1) blockers.push(blocker('SOURCE_SIZE_INVALID', { sourceId:source.id }));
    }
  });
  observations.forEach(row => { if (row && row.id && !sourceIds.has(String(row.id))) blockers.push(blocker('UNDECLARED_SOURCE_OBSERVATION', { sourceId:String(row.id) })); });
  allEvidenceRows(declaration).forEach(row => row.refs.forEach(ref => {
    if (!sourceIds.has(ref)) blockers.push(blocker('EVIDENCE_REFERENCE_MISSING', { owner:row.id, sourceId:ref }));
  }));
  declaration.decisions.forEach(row => { if (!row.evidenceRefs.length) blockers.push(blocker('DECISION_EVIDENCE_REQUIRED', { decisionId:row.id })); });
  declaration.openLoops.forEach(row => { if (!row.evidenceRefs.length) blockers.push(blocker('OPEN_LOOP_EVIDENCE_REQUIRED', { openLoopId:row.id })); });

  const unique = Array.from(new Map(blockers.map(row => [row.code + '\0' + JSON.stringify(row), row])).values());
  const publicSources = declaration.sources.map(source => {
    const observed = observationMap.get(source.id) || {};
    return {
      id:source.id,
      locator:source.locator,
      mediaType:source.mediaType,
      schema:source.expectedSchema,
      sha256:source.expectedSha256,
      sizeBytes:Number.isSafeInteger(observed.sizeBytes) ? observed.sizeBytes : null,
      classification:source.classification,
      freshness:source.freshness,
      role:source.role
    };
  });
  const reprobeSources = publicSources.filter(row => row.freshness === 'REPROBE_REQUIRED').map(row => row.id);
  const stable = {
    schema:CAPSULE_SCHEMA,
    policyVersion:POLICY_VERSION,
    state:unique.length ? 'HELD' : 'READY',
    id:declaration.id,
    status:declaration.status,
    declarationDigest:digest(publicInput),
    identity:declaration.identity,
    currentGoal:declaration.currentGoal,
    authorities:declaration.authorities,
    decisions:declaration.decisions,
    openLoops:declaration.openLoops,
    sources:publicSources,
    freshness:{
      state:reprobeSources.length ? 'REPROBE_REQUIRED' : 'STATIC',
      sources:reprobeSources,
      rule:reprobeSources.length ? 'Re-probe these external facts before any state-changing action; matching stored digests do not prove external state is still current.' : 'All linked sources are declared static for this capsule.'
    },
    resume:{
      firstAction:reprobeSources.length ? 'Re-probe every REPROBE_REQUIRED source before using its state.' : (declaration.openLoops[0] ? declaration.openLoops[0].nextAction : 'Review the capsule and linked evidence.'),
      rules:declaration.resumeRules
    },
    truth:{
      sourceContentEmbedded:false,
      linkedPrivateSourceContentEmbedded:false,
      declarationPrivacyIndependentlyVerified:false,
      sourceDigestIsAcceptance:false,
      externalFreshnessProven:false,
      automaticAction:false,
      permissionChange:false,
      memoryAuthorityGranted:false,
      promotion:false,
      canon:false,
      roots:false
    },
    metrics:{ linkedSources:publicSources.length, linkedSourceBytes:publicSources.reduce((sum,row) => sum + (row.sizeBytes || 0), 0), decisions:declaration.decisions.length, openLoops:declaration.openLoops.length },
    blockers:unique
  };
  return Object.assign({}, stable, { capsuleDigest:digest(stable) });
}

function verifyCapsule(capsule) {
  const checks = [];
  const check = (id, pass) => checks.push({ id, pass:pass === true });
  let claimed = null;
  try {
    const stable = copy(capsule);
    claimed = String(stable.capsuleDigest || '').toLowerCase();
    delete stable.capsuleDigest;
    check('schema', stable.schema === CAPSULE_SCHEMA);
    check('digest-format', isDigest(claimed));
    check('digest-match', claimed === digest(stable));
    check('state-blocker-consistency', (stable.state === 'READY' && stable.blockers.length === 0) || (stable.state === 'HELD' && stable.blockers.length > 0));
    const ids = new Set((stable.sources || []).map(row => row.id));
    const refs = [];
    refs.push(...(stable.currentGoal && stable.currentGoal.evidenceRefs || []), ...(stable.identity && stable.identity.sourceRefs || []));
    (stable.decisions || []).forEach(row => refs.push(...(row.evidenceRefs || [])));
    (stable.openLoops || []).forEach(row => refs.push(...(row.evidenceRefs || [])));
    check('evidence-references-resolve', refs.every(ref => ids.has(ref)));
    check('no-input-paths', !(stable.sources || []).some(row => Object.prototype.hasOwnProperty.call(row, 'inputPath')));
    check('source-content-not-embedded', stable.truth && stable.truth.sourceContentEmbedded === false && stable.truth.linkedPrivateSourceContentEmbedded === false);
    check('declaration-privacy-not-overclaimed', stable.truth && stable.truth.declarationPrivacyIndependentlyVerified === false);
    check('authority-closed', stable.truth && ['automaticAction','permissionChange','memoryAuthorityGranted','promotion','canon','roots'].every(key => stable.truth[key] === false));
    check('freshness-honest', stable.freshness && ((stable.freshness.state === 'STATIC' && stable.freshness.sources.length === 0) || (stable.freshness.state === 'REPROBE_REQUIRED' && stable.freshness.sources.length > 0 && stable.truth.externalFreshnessProven === false)));
  } catch (_) {
    check('parseable-capsule', false);
  }
  const stable = { schema:'axm.local-continuation-capsule-integrity/v1', capsuleDigest:isDigest(claimed) ? claimed : null, state:checks.every(row => row.pass) ? 'PASS' : 'FAIL', checks };
  return Object.assign({}, stable, { verificationDigest:digest(stable) });
}

function reverifyCapsule(input) {
  const capsule = input && input.capsule;
  const integrity = verifyCapsule(capsule);
  let current = null;
  let declarationMatches = false;
  let sourceCompilationMatches = false;
  try {
    const normalized = normalizeDeclaration(input.declaration);
    declarationMatches = capsule && capsule.declarationDigest === digest(publicDeclaration(normalized));
    current = buildCapsule({ declaration:input.declaration, observations:input.observations });
    sourceCompilationMatches = capsule && current.state === 'READY' && current.capsuleDigest === capsule.capsuleDigest;
  } catch (_) {}
  const checks = [
    { id:'capsule-integrity', pass:integrity.state === 'PASS' },
    { id:'declaration-current', pass:declarationMatches },
    { id:'linked-sources-current', pass:sourceCompilationMatches }
  ];
  const pass = checks.every(row => row.pass);
  const actionState = pass && capsule && capsule.state === 'READY'
    ? (capsule.freshness.state === 'REPROBE_REQUIRED' ? 'REPROBE_REQUIRED' : 'READY')
    : 'HELD';
  const stable = {
    schema:VERIFICATION_SCHEMA,
    state:pass ? 'PASS' : 'FAIL',
    actionState,
    capsuleDigest:capsule && isDigest(capsule.capsuleDigest) ? capsule.capsuleDigest : null,
    currentCompilationDigest:current && current.capsuleDigest || null,
    checks,
    truth:{ storedSourceMatchProvesExternalFreshness:false, automaticAction:false, permissionChange:false }
  };
  return Object.assign({}, stable, { verificationDigest:digest(stable) });
}

function cardLine(text) { return String(text || '').replace(/[\r\n]+/g, ' ').trim(); }

function buildResumeCard(capsule) {
  const integrity = verifyCapsule(capsule);
  if (integrity.state !== 'PASS' || !capsule || capsule.state !== 'READY') throw new TypeError('a verified READY continuation capsule is required');
  const lines = [
    '# AXM continuation capsule — ' + cardLine(capsule.id),
    '',
    'Status: ' + capsule.status + ' (not CANON)',
    'Identity: ' + cardLine(capsule.identity.workingName) + ' on ' + cardLine(capsule.identity.technicalSubstrate),
    'Distinction: ' + cardLine(capsule.identity.distinction),
    '',
    '## Active objective',
    cardLine(capsule.currentGoal.objective),
    'Completion rule: ' + cardLine(capsule.currentGoal.completionRule),
    '',
    '## First action',
    cardLine(capsule.resume.firstAction),
    '',
    '## Decisions'
  ];
  capsule.decisions.forEach(row => lines.push('- [' + row.status + '] ' + row.id + ': ' + cardLine(row.statement) + ' (evidence: ' + row.evidenceRefs.join(', ') + ')'));
  lines.push('', '## Open loops');
  capsule.openLoops.forEach(row => lines.push(row.ordinal + '. [' + row.state + '] ' + row.id + ': ' + cardLine(row.nextAction) + ' (evidence: ' + row.evidenceRefs.join(', ') + ')'));
  lines.push('', '## Linked sources');
  capsule.sources.forEach(row => lines.push('- ' + row.id + ' · ' + row.freshness + ' · ' + row.locator + ' · sha256:' + row.sha256));
  lines.push('', '## Boundaries');
  capsule.authorities.refusedActions.forEach(value => lines.push('- Refuse: ' + cardLine(value)));
  capsule.resume.rules.forEach(value => lines.push('- Rule: ' + cardLine(value)));
  lines.push('- Linked content is not embedded; validate source digests independently.', '- Manually declared semantic text is not independently privacy-classified; review it before wider sharing.', '- Stored digests do not prove live external state; obey REPROBE_REQUIRED.', '- This capsule grants no permission, memory authority, merge authority, promotion, roots, or CANON change.', '', 'Capsule digest: `' + capsule.capsuleDigest + '`');
  const text = lines.join('\n') + '\n';
  const stable = {
    schema:CARD_SCHEMA,
    state:'READY',
    capsuleDigest:capsule.capsuleDigest,
    freshnessState:capsule.freshness.state,
    text,
    textSha256:sha256(Buffer.from(text, 'utf8')),
    truth:{ sourceContentEmbedded:false, automaticAction:false, permissionChange:false, canon:false, roots:false }
  };
  return Object.assign({}, stable, { cardDigest:digest(stable) });
}

function verifyResumeCard(card) {
  const checks = [];
  const check = (id, pass) => checks.push({ id, pass:pass === true });
  let claimed = null;
  try {
    const stable = copy(card);
    claimed = String(stable.cardDigest || '').toLowerCase();
    delete stable.cardDigest;
    check('schema', stable.schema === CARD_SCHEMA);
    check('digest-format', isDigest(claimed));
    check('digest-match', claimed === digest(stable));
    check('text-digest', stable.textSha256 === sha256(Buffer.from(String(stable.text || ''), 'utf8')));
    check('authority-closed', stable.truth && ['sourceContentEmbedded','automaticAction','permissionChange','canon','roots'].every(key => stable.truth[key] === false));
    check('freshness-visible', stable.freshnessState !== 'REPROBE_REQUIRED' || String(stable.text || '').includes('REPROBE_REQUIRED'));
  } catch (_) { check('parseable-card', false); }
  const stable = { schema:CARD_VERIFICATION_SCHEMA, cardDigest:isDigest(claimed) ? claimed : null, state:checks.every(row => row.pass) ? 'PASS' : 'FAIL', checks };
  return Object.assign({}, stable, { verificationDigest:digest(stable) });
}

module.exports = {
  DECLARATION_SCHEMA,
  CAPSULE_SCHEMA,
  VERIFICATION_SCHEMA,
  CARD_SCHEMA,
  CARD_VERIFICATION_SCHEMA,
  POLICY_VERSION,
  ALLOWED_SOURCE_CLASS,
  REFUSED_SOURCE_CLASS,
  digest,
  sha256,
  isDigest,
  normalizeDeclaration,
  publicDeclaration,
  buildCapsule,
  verifyCapsule,
  reverifyCapsule,
  buildResumeCard,
  verifyResumeCard
};
