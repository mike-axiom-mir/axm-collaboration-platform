'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ORGAN_ID = 'axm.mirror.organ/clone-role-steward-v1';
const REGISTRY_SCHEMA = 'axm.mirror.clone-role-registry/v1';
const ACTIVITY_SCHEMA = 'axm.mirror.clone-role-activity/v1';
const ASSESSMENT_SCHEMA = 'axm.mirror.clone-role-assessment/v1';
const REGISTRY_PATH = 'lineage/clone-role-registry-v1.json';
const AUTHORITY_KEYS = Object.freeze([
  'sourceWrite', 'repairApply', 'candidateExecution', 'toolUse', 'network',
  'trainingAdmission', 'installation', 'promotion', 'canon', 'worldAction'
]);
const ROLE_AUTHORITY_KEYS = Object.freeze([
  'workshopSourceWrite', 'mirrorSourceWrite', 'repairApplication',
  'candidateExecution', 'toolUse', 'network', 'trainingAdmission',
  'installation', 'promotion', 'canon', 'worldAction'
]);
const ZERO_AUTHORITY = Object.freeze(Object.fromEntries(AUTHORITY_KEYS.map(key => [key, false])));
const ZERO_ROLE_AUTHORITY = Object.freeze(Object.fromEntries(ROLE_AUTHORITY_KEYS.map(key => [key, false])));
const VERDICTS = Object.freeze([
  'ROLE_ALIGNED_PROPOSAL_ONLY',
  'ROLE_ALIGNED_PRESERVATION_ONLY',
  'HOLD_ROLE_LINEAGE_DIVERGED',
  'HOLD_CROSS_ROLE_ACTIVITY',
  'HOLD_REPAIR_EVIDENCE_INCOMPLETE',
  'HOLD_CAPABILITY_STORY_INCOMPLETE',
  'HOLD_CAPABILITY_UNVERIFIED',
  'HOLD_HISTORICAL_ROLE_MISMATCH',
  'REFUSED_ACTIVITY_AUTHORITY',
  'UNKNOWN_CLONE'
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex');
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function without(value, ...keys) { const copy = clone(value); for (const key of keys) delete copy[key]; return copy; }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const actual = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(label + ' fields changed');
}
function inside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
function cleanText(value, maximum, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000-\u001f]/.test(value)) throw new Error(label + ' is invalid');
  return value;
}
function sha(value, label) {
  if (!/^[a-f0-9]{64}$/.test(String(value || ''))) throw new Error(label + ' must be a SHA-256 digest');
  return value;
}
function exactAuthority(value, keys, label, requireFalse) {
  exactKeys(value, keys, label);
  for (const key of keys) {
    if (typeof value[key] !== 'boolean') throw new Error(label + ' flags must be boolean');
    if (requireFalse && value[key] !== false) throw new Error(label + ' gained authority');
  }
}

function validateRegistry(registry) {
  exactKeys(registry, ['schema', 'registryId', 'registryDigest', 'status', 'recordedAt', 'humanDirection', 'roles', 'boundary', 'authority'], 'clone role registry');
  if (registry.schema !== REGISTRY_SCHEMA || registry.status !== 'TEST') throw new Error('clone role registry identity changed');
  if (!/^clone-role-registry-[a-f0-9]{20}$/.test(registry.registryId) || registry.registryDigest !== digest(without(registry, 'registryId', 'registryDigest')) || registry.registryId !== 'clone-role-registry-' + registry.registryDigest.slice(0, 20)) throw new Error('clone role registry content address changed');
  if (!/^2026-07-27$/.test(registry.recordedAt)) throw new Error('clone role registry date changed');
  exactKeys(registry.humanDirection, ['declaredBy', 'statement', 'canonAccepted'], 'clone role human direction');
  if (registry.humanDirection.declaredBy !== 'Mike' || registry.humanDirection.canonAccepted !== false) throw new Error('clone role direction attribution or CANON boundary changed');
  cleanText(registry.humanDirection.statement, 500, 'clone role direction statement');
  if (!Array.isArray(registry.roles) || registry.roles.length !== 3) throw new Error('clone role registry must contain exactly three current role records');
  const ids = new Set();
  for (const role of registry.roles) {
    exactKeys(role, ['cloneId', 'displayName', 'status', 'roleClass', 'purpose', 'successCriterion', 'permittedActivityKinds', 'forbiddenActivityKinds', 'storyAuthority', 'twoViewsOneTrace', 'evidence', 'authority', 'limitations'], 'clone role');
    if (!/^[a-z0-9][a-z0-9.-]{1,79}$/.test(role.cloneId) || ids.has(role.cloneId)) throw new Error('clone role identity is invalid or duplicated');
    ids.add(role.cloneId);
    if (!['TEST', 'NEEDS_REVIEW'].includes(role.status)) throw new Error('clone role status changed');
    if (!['STABILITY_REPAIR', 'CAPABILITY_STORY_INNOVATION', 'HISTORICAL_ROLE_MISMATCH'].includes(role.roleClass)) throw new Error('clone role class changed');
    cleanText(role.displayName, 120, 'clone display name');
    cleanText(role.purpose, 600, 'clone purpose');
    cleanText(role.successCriterion, 300, 'clone success criterion');
    if (!Array.isArray(role.permittedActivityKinds) || !role.permittedActivityKinds.length || !Array.isArray(role.forbiddenActivityKinds) || !role.forbiddenActivityKinds.length) throw new Error('clone activity boundary is empty');
    if (role.permittedActivityKinds.some(kind => role.forbiddenActivityKinds.includes(kind))) throw new Error('clone activity is both permitted and forbidden');
    if (role.storyAuthority !== 'CREATIVE_CONTEXT_ONLY_NOT_TRUTH_EVIDENCE_PERMISSION_RELEASE_GATE_OR_CANON' && role.storyAuthority !== 'NONE') throw new Error('clone story authority changed');
    exactKeys(role.twoViewsOneTrace, ['humanView', 'machineView'], 'clone two-view trace');
    cleanText(role.twoViewsOneTrace.humanView, 300, 'clone human view');
    cleanText(role.twoViewsOneTrace.machineView, 300, 'clone machine view');
    if (!Array.isArray(role.evidence) || !role.evidence.length) throw new Error('clone role evidence is empty');
    for (const ref of role.evidence) {
      exactKeys(ref, ['root', 'path', 'sha256', 'assertion'], 'clone role evidence reference');
      if (!['MIRROR', 'WORKSHOP'].includes(ref.root) || !/^[a-zA-Z0-9._/-]+$/.test(ref.path) || ref.path.includes('..')) throw new Error('clone role evidence path is unsafe');
      sha(ref.sha256, 'clone role evidence digest');
      cleanText(ref.assertion, 120, 'clone role evidence assertion');
    }
    exactAuthority(role.authority, ROLE_AUTHORITY_KEYS, 'clone role authority', true);
    if (!Array.isArray(role.limitations) || !role.limitations.length || role.limitations.some(item => typeof item !== 'string' || !item)) throw new Error('clone role limitations changed');
  }
  const repair = registry.roles.find(role => role.cloneId === 'repairbuddy');
  const future = registry.roles.find(role => role.cloneId === 'future-code-mirror');
  const historical = registry.roles.find(role => role.cloneId === 'mirror-code-clone-v0.2');
  if (!repair || repair.roleClass !== 'STABILITY_REPAIR' || !repair.permittedActivityKinds.includes('STABILITY_REPAIR_REPLAY') || !repair.forbiddenActivityKinds.includes('CAPABILITY_STORY_PROPOSAL')) throw new Error('RepairBuddy role separation changed');
  if (!future || future.roleClass !== 'CAPABILITY_STORY_INNOVATION' || !future.permittedActivityKinds.includes('CAPABILITY_STORY_PROPOSAL') || !future.forbiddenActivityKinds.includes('STABILITY_REPAIR_REPLAY') || future.storyAuthority === 'NONE') throw new Error('future Code Mirror role separation changed');
  if (!historical || historical.roleClass !== 'HISTORICAL_ROLE_MISMATCH' || JSON.stringify(historical.permittedActivityKinds) !== JSON.stringify(['PRESERVE_EVIDENCE_ONLY'])) throw new Error('historical Code Clone hold changed');
  exactAuthority(registry.authority, ROLE_AUTHORITY_KEYS, 'clone role registry authority', true);
  cleanText(registry.boundary, 1200, 'clone role registry boundary');
  return registry;
}

function semanticEvidence(assertion, bytes) {
  const text = bytes.toString('utf8');
  let value = null;
  if (!assertion.endsWith('_KERNEL')) {
    try { value = JSON.parse(text); } catch (_) { return false; }
  }
  if (assertion === 'REPAIRBUDDY_IDENTITY_BRANCH') return value.schema === 'axm.mirror.identity-branch/v1' && value.branchId === 'axm.machine.repairbuddy/branch-0' && /SMALLEST_REVERSIBLE_REPAIR/.test(value.identityCore) && value.canonAccepted === false;
  if (assertion === 'REPAIRBUDDY_MANIFEST') return value.id === 'repairbuddy' && Array.isArray(value.permissions) && value.permissions.length === 0 && /repair/i.test(value.summary || '');
  if (assertion === 'REPAIRBUDDY_CONTRACT') return value.id === 'repairbuddy' && value.boundaries && value.boundaries.refuses.includes('new-code-generation') && value.boundaries.refuses.includes('automatic-repair-application');
  if (assertion === 'CODE_MIRROR_ROLE_DIRECTION') return value.schema === 'axm.mirror-code-role-direction/v1' && value.roleMap.futureCodeMirror.role === 'ORIGINATE_NEW_CAPABILITY_BEARING_CODE_STORIES_IN_DISPOSABLE_EXPERIMENTS' && value.roleMap.futureCodeMirror.storyAuthority === 'NOT_TRUTH_PERMISSION_EVIDENCE_RELEASE_GATE_OR_CANON' && value.training.repairReceiptsEligibleAsCodeMirrorInnovation === false;
  if (assertion === 'CODE_CLONE_V02_MANIFEST') return value.id === 'mirror-code-clone' && value.version === 'v0.2' && /repair/i.test(JSON.stringify(value.actions || []));
  if (assertion === 'CODE_CLONE_V02_CONTRACT') return value.id === 'mirror-code-clone' && value.version === 'v0.2' && (value.provides || []).includes('allowlisted-candidate-code-repair') && (value.boundaries.refuses || []).includes('unknown-repair-class');
  if (assertion === 'CODE_CLONE_V02_KERNEL') return /const REPAIR_CLASS/.test(text) && /const COMPLETENESS_REPAIR_CLASS/.test(text) && !/CAPABILITY_STORY_PROPOSAL/.test(text);
  return false;
}

function inspectRegistry(options = {}) {
  const root = path.resolve(options.root || path.resolve(__dirname, '..'));
  const registryFile = path.resolve(root, options.registryPath || REGISTRY_PATH);
  if (!inside(root, registryFile) || !fs.existsSync(registryFile)) throw new Error('clone role registry path is missing or outside Mirror');
  const registryBytes = fs.readFileSync(registryFile);
  const registry = validateRegistry(JSON.parse(registryBytes.toString('utf8')));
  const workshopRoot = options.workshopRoot ? path.resolve(options.workshopRoot) : null;
  const checks = [];
  const findings = [];
  for (const role of registry.roles) {
    for (const ref of role.evidence) {
      const evidenceRoot = ref.root === 'MIRROR' ? root : workshopRoot;
      let state = 'PASS';
      let observedSha256 = null;
      let reason = null;
      if (!evidenceRoot || !fs.existsSync(evidenceRoot)) {
        state = 'HOLD_ROOT_UNAVAILABLE'; reason = ref.root + ' evidence root is unavailable';
      } else {
        const file = path.resolve(evidenceRoot, ref.path);
        if (!inside(evidenceRoot, file) || !fs.existsSync(file)) {
          state = 'HOLD_EVIDENCE_MISSING'; reason = 'evidence file is missing or outside its root';
        } else {
          const stat = fs.lstatSync(file);
          if (stat.isSymbolicLink() || !stat.isFile()) {
            state = 'HOLD_EVIDENCE_NOT_ORDINARY_FILE'; reason = 'evidence path is not an ordinary file';
          } else {
            const bytes = fs.readFileSync(file);
            observedSha256 = digest(bytes);
            if (observedSha256 !== ref.sha256) {
              state = 'HOLD_EVIDENCE_DIGEST_DIVERGED'; reason = 'evidence bytes changed';
            } else if (!semanticEvidence(ref.assertion, bytes)) {
              state = 'HOLD_EVIDENCE_SEMANTICS_DIVERGED'; reason = 'evidence meaning no longer matches its assertion';
            }
          }
        }
      }
      checks.push({ cloneId: role.cloneId, root: ref.root, path: ref.path, assertion: ref.assertion, expectedSha256: ref.sha256, observedSha256, state });
      if (state !== 'PASS') findings.push({ code: state, cloneId: role.cloneId, evidencePath: ref.path, reason });
    }
  }
  return {
    schema: 'axm.mirror.clone-role-registry-inspection/v1',
    state: findings.length ? 'HOLD_ROLE_LINEAGE_DIVERGED' : 'PASS_CURRENT_ROLE_LINEAGE',
    registryId: registry.registryId,
    registryDigest: registry.registryDigest,
    registryFileSha256: digest(registryBytes),
    checkedEvidence: checks.length,
    passedEvidence: checks.filter(item => item.state === 'PASS').length,
    failedEvidence: checks.filter(item => item.state !== 'PASS').length,
    checks,
    findings,
    authority: clone(ZERO_ROLE_AUTHORITY),
    registry
  };
}

function validateOptionalStory(value) {
  if (value === null) return;
  exactKeys(value, ['sourceId', 'sourceDigest', 'statement'], 'activity story');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{1,119}$/.test(value.sourceId)) throw new Error('story source identity is invalid');
  sha(value.sourceDigest, 'story source digest');
  cleanText(value.statement, 2000, 'story statement');
}
function validateOptionalCapability(value) {
  if (value === null) return;
  exactKeys(value, ['contractId', 'contractDigest', 'candidateDigest', 'candidateAuthorId', 'verification'], 'activity capability');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{1,159}$/.test(value.contractId)) throw new Error('capability contract identity is invalid');
  sha(value.contractDigest, 'capability contract digest');
  sha(value.candidateDigest, 'capability candidate digest');
  cleanText(value.candidateAuthorId, 160, 'capability candidate author identity');
  exactKeys(value.verification, ['state', 'evidenceDigest', 'verifierId', 'relationToCandidateAuthor'], 'activity capability verification');
  if (!['PASS', 'FAIL', 'NOT_RUN'].includes(value.verification.state)) throw new Error('capability verification state changed');
  sha(value.verification.evidenceDigest, 'capability verification evidence digest');
  cleanText(value.verification.verifierId, 160, 'capability verifier identity');
  if (!['INDEPENDENT', 'SAME_BUILDER', 'UNKNOWN'].includes(value.verification.relationToCandidateAuthor)) throw new Error('capability verifier relation changed');
  if (value.verification.relationToCandidateAuthor === 'INDEPENDENT' && value.verification.verifierId === value.candidateAuthorId) throw new Error('capability verifier cannot claim independence from itself');
}
function validateOptionalRepair(value) {
  if (value === null) return;
  exactKeys(value, ['patternId', 'patternDigest', 'knownGoodDigest', 'verification', 'rollback'], 'activity repair');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{1,159}$/.test(value.patternId)) throw new Error('repair pattern identity is invalid');
  sha(value.patternDigest, 'repair pattern digest');
  sha(value.knownGoodDigest, 'repair known-good digest');
  exactKeys(value.verification, ['state', 'evidenceDigest', 'verifierId'], 'activity repair verification');
  if (!['PASS', 'FAIL', 'NOT_RUN'].includes(value.verification.state)) throw new Error('repair verification state changed');
  sha(value.verification.evidenceDigest, 'repair verification evidence digest');
  cleanText(value.verification.verifierId, 160, 'repair verifier identity');
  exactKeys(value.rollback, ['state', 'boundaryDigest'], 'activity repair rollback');
  if (!['AVAILABLE', 'NOT_PROVIDED'].includes(value.rollback.state)) throw new Error('repair rollback state changed');
  sha(value.rollback.boundaryDigest, 'repair rollback boundary digest');
}

function validateActivity(activity) {
  exactKeys(activity, ['schema', 'proposalId', 'proposalDigest', 'cloneId', 'activityKind', 'story', 'capability', 'repair', 'requestedAuthority', 'humanRendering'], 'clone role activity');
  if (activity.schema !== ACTIVITY_SCHEMA || !/^[a-z0-9][a-z0-9.-]{1,79}$/.test(activity.cloneId)) throw new Error('clone role activity identity changed');
  if (!['STABILITY_REPAIR_REPLAY', 'CAPABILITY_STORY_PROPOSAL', 'PRESERVE_EVIDENCE_ONLY'].includes(activity.activityKind)) throw new Error('clone role activity kind changed');
  validateOptionalStory(activity.story);
  validateOptionalCapability(activity.capability);
  validateOptionalRepair(activity.repair);
  exactAuthority(activity.requestedAuthority, AUTHORITY_KEYS, 'activity requested authority', false);
  if (typeof activity.humanRendering !== 'string' || activity.humanRendering.length > 2000 || /[\u0000-\u001f]/.test(activity.humanRendering)) throw new Error('activity human rendering is invalid');
  const expected = digest(without(activity, 'proposalId', 'proposalDigest'));
  if (activity.proposalDigest !== expected || activity.proposalId !== 'clone-role-activity-' + expected.slice(0, 24)) throw new Error('clone role activity content address changed');
  return activity;
}

function sealActivity(input) {
  exactKeys(input, ['cloneId', 'activityKind', 'story', 'capability', 'repair', 'requestedAuthority', 'humanRendering'], 'unsealed clone role activity');
  const activity = {
    schema: ACTIVITY_SCHEMA,
    proposalId: null,
    proposalDigest: null,
    cloneId: input.cloneId,
    activityKind: input.activityKind,
    story: clone(input.story),
    capability: clone(input.capability),
    repair: clone(input.repair),
    requestedAuthority: clone(input.requestedAuthority),
    humanRendering: input.humanRendering
  };
  const proposalDigest = digest(without(activity, 'proposalId', 'proposalDigest'));
  activity.proposalId = 'clone-role-activity-' + proposalDigest.slice(0, 24);
  activity.proposalDigest = proposalDigest;
  return validateActivity(activity);
}

function makeFinding(code, severity, statement) { return { code, severity, statement }; }

function assess(options = {}) {
  const activity = validateActivity(clone(options.activity));
  const inspection = inspectRegistry(options);
  const role = inspection.registry.roles.find(item => item.cloneId === activity.cloneId) || null;
  const findings = [];
  let verdict;
  if (inspection.state !== 'PASS_CURRENT_ROLE_LINEAGE') {
    verdict = 'HOLD_ROLE_LINEAGE_DIVERGED';
    findings.push(makeFinding('ROLE_LINEAGE_NOT_CURRENT', 'HOLD', 'Current role evidence did not reconstruct, so no role-fit decision is admitted.'));
  } else if (!role) {
    verdict = 'UNKNOWN_CLONE';
    findings.push(makeFinding('CLONE_NOT_REGISTERED', 'HOLD', 'The supplied clone identity has no current role contract.'));
  } else if (Object.values(activity.requestedAuthority).some(Boolean)) {
    verdict = 'REFUSED_ACTIVITY_AUTHORITY';
    findings.push(makeFinding('ACTIVITY_REQUESTED_AUTHORITY', 'REFUSE', 'A role-fit proposal cannot request source, tool, training, promotion, CANON, or world authority.'));
  } else if (role.forbiddenActivityKinds.includes(activity.activityKind) || !role.permittedActivityKinds.includes(activity.activityKind)) {
    verdict = role.roleClass === 'HISTORICAL_ROLE_MISMATCH' ? 'HOLD_HISTORICAL_ROLE_MISMATCH' : 'HOLD_CROSS_ROLE_ACTIVITY';
    findings.push(makeFinding('ACTIVITY_CROSSES_CLONE_ROLE', 'HOLD', activity.activityKind + ' is not permitted for ' + role.cloneId + '.'));
  } else if (role.roleClass === 'STABILITY_REPAIR') {
    if (!activity.repair || activity.story !== null || activity.capability !== null || activity.repair.verification.state !== 'PASS' || activity.repair.rollback.state !== 'AVAILABLE') {
      verdict = 'HOLD_REPAIR_EVIDENCE_INCOMPLETE';
      findings.push(makeFinding('STABILITY_REPAIR_REQUIRES_EXACT_VERIFIED_PATTERN', 'HOLD', 'RepairBuddy needs one verified known-good repair pattern plus a rollback boundary and may not originate a capability story.'));
    } else {
      verdict = 'ROLE_ALIGNED_PROPOSAL_ONLY';
      findings.push(makeFinding('STABILITY_REPAIR_ROLE_ALIGNED', 'INFO', 'The proposal matches RepairBuddy stability work but remains proposal-only.'));
    }
  } else if (role.roleClass === 'CAPABILITY_STORY_INNOVATION') {
    if (!activity.story || !activity.capability || activity.repair !== null) {
      verdict = 'HOLD_CAPABILITY_STORY_INCOMPLETE';
      findings.push(makeFinding('CAPABILITY_STORY_REQUIRES_BOTH_VIEWS', 'HOLD', 'Future Code Mirror needs attributed story lineage and a capability contract/candidate for the same proposal.'));
    } else if (activity.capability.verification.state !== 'PASS' || activity.capability.verification.relationToCandidateAuthor !== 'INDEPENDENT') {
      verdict = 'HOLD_CAPABILITY_UNVERIFIED';
      findings.push(makeFinding('CAPABILITY_BEHAVIOR_NOT_INDEPENDENTLY_VERIFIED', 'HOLD', 'A good story without separately verified working capability remains a concept.'));
    } else {
      verdict = 'ROLE_ALIGNED_PROPOSAL_ONLY';
      findings.push(makeFinding('CAPABILITY_STORY_ROLE_ALIGNED', 'INFO', 'The proposal carries story and verified capability views but novelty, usefulness, and transfer remain untested.'));
    }
  } else {
    verdict = 'ROLE_ALIGNED_PRESERVATION_ONLY';
    findings.push(makeFinding('HISTORICAL_EVIDENCE_PRESERVATION_ALIGNED', 'INFO', 'The role-mismatched v0.2 body may be preserved but not trained or relabelled as innovation.'));
  }
  if (!VERDICTS.includes(verdict)) throw new Error('clone role verdict escaped its closed set');
  const basis = {
    schema: ASSESSMENT_SCHEMA,
    organ: { id: ORGAN_ID, version: 'v1', body: 'DETERMINISTIC_KERNEL', learnedWeights: false },
    registry: { registryId: inspection.registryId, registryDigest: inspection.registryDigest, lineageState: inspection.state, checkedEvidence: inspection.checkedEvidence, passedEvidence: inspection.passedEvidence, failedEvidence: inspection.failedEvidence },
    proposalId: activity.proposalId,
    proposalDigest: activity.proposalDigest,
    cloneId: activity.cloneId,
    roleClass: role ? role.roleClass : 'UNKNOWN',
    verdict,
    findings,
    views: {
      human: { suppliedRendering: activity.humanRendering, storyStatement: activity.story ? activity.story.statement : null, nonAuthoritative: true },
      machine: { activityKind: activity.activityKind, storySourceDigest: activity.story ? activity.story.sourceDigest : null, capabilityContractDigest: activity.capability ? activity.capability.contractDigest : null, capabilityCandidateDigest: activity.capability ? activity.capability.candidateDigest : null, capabilityVerificationState: activity.capability ? activity.capability.verification.state : null, capabilityVerifierRelation: activity.capability ? activity.capability.verification.relationToCandidateAuthor : null, capabilityEvidenceDigest: activity.capability ? activity.capability.verification.evidenceDigest : null, repairPatternDigest: activity.repair ? activity.repair.patternDigest : null, repairVerificationState: activity.repair ? activity.repair.verification.state : null, repairEvidenceDigest: activity.repair ? activity.repair.verification.evidenceDigest : null, rollbackState: activity.repair ? activity.repair.rollback.state : null }
    },
    authority: clone(ZERO_ROLE_AUTHORITY),
    limitations: [
      'Role alignment is not proof that submitted evidence is genuine, or proof of repair correctness, capability behavior, novelty, usefulness, taste, independent authorship, or learning improvement.',
      'Human story rendering is preserved but never read as truth, evidence, permission, a release gate, or CANON authority.',
      'No candidate is executed, trained, installed, promoted, applied, or allowed to act.'
    ],
    boundary: 'This deterministic organ verifies current clone-role lineage and classifies one content-addressed proposal. It does not repair, innovate, execute candidates, judge story quality, certify novelty or usefulness, admit evidence or training, grant permission, install, promote, change CANON, or act.'
  };
  const assessmentDigest = digest(basis);
  return Object.assign({ assessmentId: 'clone-role-assessment-' + assessmentDigest.slice(0, 24), assessmentDigest }, basis);
}

module.exports = {
  ORGAN_ID,
  REGISTRY_SCHEMA,
  ACTIVITY_SCHEMA,
  ASSESSMENT_SCHEMA,
  REGISTRY_PATH,
  AUTHORITY_KEYS,
  ROLE_AUTHORITY_KEYS,
  ZERO_AUTHORITY,
  ZERO_ROLE_AUTHORITY,
  VERDICTS,
  stable,
  digest,
  validateRegistry,
  inspectRegistry,
  validateActivity,
  sealActivity,
  assess
};
