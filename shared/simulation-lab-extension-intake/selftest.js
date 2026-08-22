#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Intake = require('./simulation-lab-extension-intake');
const ReturnGate = require('../../tools/branch-module-return-gate/return-gate-core');

const portableBaseline = require('../portable-baseline-capsule/module.contract.json');
const baselineLab = require('../baseline-simulation-lab/module.contract.json');
const challengerLab = require('../grounded-growth-challenger-lab/module.contract.json');
const moduleContract = require('./module.contract.json');
const hostSchema = require('./simulation-lab-host-profile.schema.json');
const extensionSchema = require('./simulation-lab-extension.schema.json');
const assessmentSchema = require('./simulation-lab-extension-assessment.schema.json');

let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks += 1;
  console.log('PASS ' + label);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const hostProfile = Intake.buildHostProfile({
  profileId: 'axm-current-simulation-lab-host',
  generatedAt: '2026-08-19T13:30:00.000Z',
  contracts: {
    'portable-baseline-capsule': portableBaseline,
    'baseline-simulation-lab': baselineLab,
    'grounded-growth-challenger-lab': challengerLab
  }
});

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-simulation-extension-intake-'));
let serial = 0;

function makeMapping(kind, candidateCapability) {
  const profiles = {
    SOFTWARE_REPOSITORY: {
      hostCapability: 'simulation.baseline.software.bind-git-dirty',
      candidateCapability: candidateCapability || 'simulation.extension.translate.software'
    },
    MIRROR_STATE: {
      hostCapability: 'simulation.baseline.mirror.separate-realms',
      candidateCapability: candidateCapability || 'simulation.extension.translate.mirror'
    },
    SPECIALIST_MASK: {
      hostCapability: 'simulation.baseline.specialist.bind-host-mask-ceiling',
      candidateCapability: candidateCapability || 'simulation.extension.translate.specialist'
    }
  };
  return {
    subjectKind: kind,
    candidateCapability: profiles[kind].candidateCapability,
    hostModuleId: 'portable-baseline-capsule',
    hostCapability: profiles[kind].hostCapability,
    inputSchema: 'axm.portable-baseline-capsule/v1',
    outputSchema: 'axm.baseline-simulation-lab-run/v1',
    unsupportedFieldPolicy: 'DIGEST_BOUND_REFERENCE',
    nativeSchemaIdentityClaimed: false
  };
}

function buildCandidate(options = {}) {
  serial += 1;
  const id = options.id || 'platform-baseline-software-adapter';
  const version = options.version || 'v0.1-experimental';
  const status = options.status || 'EXPERIMENTAL';
  const relation = options.relation || 'ADAPTER';
  const subjectKinds = options.subjectKinds || ['SOFTWARE_REPOSITORY'];
  const mappings = options.mappings || subjectKinds.map((kind) => makeMapping(kind));
  const permissions = options.permissions || [];
  const contractProvides = options.contractProvides || mappings.map((mapping) => mapping.candidateCapability);
  const contractConsumes = options.contractConsumes || Array.from(new Set(mappings.map((mapping) => mapping.inputSchema)));
  const contractEmits = options.contractEmits || Array.from(new Set(mappings.map((mapping) => mapping.outputSchema)));
  const root = path.join(tempRoot, String(serial).padStart(2, '0') + '-' + id);
  fs.mkdirSync(root, { recursive: false });

  const boundaries = Object.assign({
    truthRulesChanged: false,
    rootReplacement: false,
    originalSourceMutation: false,
    candidateCodeExecuted: false,
    installed: false,
    promoted: false,
    canonChanged: false,
    permissionsRequested: []
  }, options.boundaryOverrides || {});
  const extension = {
    schema: Intake.EXTENSION_SCHEMA,
    version: Intake.VERSION,
    extensionId: id + '-extension',
    candidate: { moduleId: id, version },
    relation,
    hostProfileDigest: options.hostProfileDigest || hostProfile.profileDigest,
    subjectKinds,
    mappings,
    boundaries
  };
  if (options.extensionExtra) Object.assign(extension, options.extensionExtra);

  const contract = {
    schema: 'axm.module-contract/v1',
    id,
    version,
    status,
    provides: contractProvides,
    consumes: contractConsumes,
    permissions,
    handoffs: { emits: contractEmits, accepts: contractConsumes },
    boundaries: {
      writes: [],
      refuses: [
        'automatic-execution', 'automatic-write', 'automatic-install',
        'automatic-permission-grant', 'automatic-promotion', 'automatic-merge',
        'automatic-canon', 'foundation-mutation', 'model-weight-training-claim'
      ]
    },
    lifecycle: { state_owner: 'none', reload: 'reset', disconnect: 'not-applicable', cleanup: 'caller-owned' }
  };
  const manifest = {
    schema: 'axm.tool-manifest/v1',
    kind: 'adapter',
    id,
    name: 'Platform Baseline Extension Fixture',
    version,
    status,
    entry: 'index.js',
    contract: 'module.contract.json',
    type: 'local-module',
    uses: [],
    permissions
  };
  const fileNames = [
    'axm-branch-return.json', Intake.EXTENSION_FILE, 'manifest.json',
    'module.contract.json', 'index.js', 'selftest.js'
  ];
  const declaration = {
    schema: ReturnGate.RETURN_SCHEMA,
    module: { id, version, title: 'Platform baseline extension fixture', summary: 'An inert adapter fixture for extension-intake verification.' },
    source: { project: 'platform-simulation-branch', repository: null, branch: 'experimental-baseline-adapter', commit: null },
    selection: { files: fileNames },
    portability: {
      target: 'axm-workshop-dependency-free',
      branchRuntimeRequired: false,
      networkRequired: false,
      packageManagerRequired: false,
      hostCommandsRequired: false,
      externalPackages: [],
      remoteServices: [],
      nativeComponents: [],
      hostCommands: [],
      absolutePaths: [],
      workshopCapabilities: contractConsumes,
      permissions
    },
    verification: { selftest: 'selftest.js' },
    requiredSeats: 'dual'
  };
  fs.writeFileSync(path.join(root, 'axm-branch-return.json'), JSON.stringify(declaration, null, 2) + '\n');
  fs.writeFileSync(path.join(root, Intake.EXTENSION_FILE), JSON.stringify(extension, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'module.contract.json'), JSON.stringify(contract, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'index.js'), "'use strict';\nmodule.exports = Object.freeze({ status: 'EXPERIMENTAL' });\n");
  fs.writeFileSync(path.join(root, 'selftest.js'), "throw new Error('candidate code must not execute during static intake');\n");
  return ReturnGate.buildPackage(root);
}

function assess(candidate, suffix) {
  const input = {
    assessmentId: 'simulation-extension-' + suffix,
    generatedAt: '2026-08-19T13:31:00.000Z',
    hostProfile,
    package: candidate.package,
    returnReceipt: candidate.receipt
  };
  return { input, assessment: Intake.buildAssessment(input) };
}

try {
  check(hostSchema.$id === Intake.HOST_PROFILE_SCHEMA && extensionSchema.$id === Intake.EXTENSION_SCHEMA && assessmentSchema.$id === Intake.ASSESSMENT_SCHEMA, 'schema identities match implementation');
  check(moduleContract.status === 'TEST' && moduleContract.permissions.length === 0, 'module contract stays TEST with zero permissions');
  check(moduleContract.boundaries.writes.length === 0, 'module contract performs no writes');
  check(moduleContract.boundaries.refuses.includes('root-replacement') && moduleContract.boundaries.refuses.includes('runtime-proof-as-human-value'), 'module contract refuses rival roots and evidence substitution');

  check(Intake.verifyHostProfile(hostProfile).pass, 'current three-root host profile verifies natively');
  check(hostProfile.roots.map((root) => root.moduleId).join(',') === 'portable-baseline-capsule,baseline-simulation-lab,grounded-growth-challenger-lab', 'host profile binds the three exact protected roots');
  check(hostProfile.subjectKinds.length === 3 && hostProfile.authority.permissions.length === 0, 'host profile supports three adapter kinds with no authority');

  const validCandidate = buildCandidate();
  check(validCandidate.report.pass && validCandidate.receipt.authority.candidateCodeExecuted === false, 'existing Branch Module Return Gate packages the fixture without executing it');
  check(ReturnGate.verifyPackage(validCandidate.package, validCandidate.receipt).pass, 'existing return gate natively verifies the inert package and receipt');
  const valid = assess(validCandidate, 'valid');
  check(valid.assessment.disposition === 'READY_FOR_EXPERIMENTAL_EVALUATION_PLANNING', 'valid distinct adapter reaches evaluation planning only');
  check(Intake.verifyAssessment(valid.assessment, valid.input).pass, 'fresh assessment verifies by exact rebuild');
  check(valid.assessment.bindings.hostProfileDigest === hostProfile.profileDigest, 'assessment binds the exact host profile digest');
  check(valid.assessment.bindings.candidatePackageDigest === 'sha256:' + validCandidate.receipt.packageDigest, 'assessment binds the exact inert package digest');
  check(valid.assessment.coverage.subjectKinds[0] === 'SOFTWARE_REPOSITORY' && valid.assessment.coverage.mappingCount === 1, 'assessment preserves declared adapter scope and mapping count');
  check(valid.assessment.evaluationRequirements.length === 9 && valid.assessment.evaluationRequirements.every((item) => item.status === 'NOT_RUN'), 'ready intake emits nine NOT_RUN evaluation requirements rather than test claims');
  check(valid.assessment.evaluationRequirements.some((item) => item.id === 'software-git-dirty-separation'), 'software adapter routes the Git and dirty-worktree separation proof');
  check(valid.assessment.evaluationRequirements.some((item) => item.id === 'human-comprehension' && item.primarySurface === 'EXPLICIT_HUMAN_JUDGMENT'), 'human value remains routed to explicit human judgment');
  check(valid.assessment.nextGate.includes('EXPLICIT_STEWARD_EXPERIMENT_DECISION'), 'static readiness still requires a separate steward experiment decision');
  check(!Object.prototype.hasOwnProperty.call(valid.assessment, 'package'), 'assessment does not duplicate or expose candidate package bytes');
  check(Object.values(valid.assessment.authority).every((value) => value === false), 'assessment grants no execution, graft, adoption or CANON authority');

  const tamperedInput = deepClone(valid.input);
  tamperedInput.package.files.find((file) => file.path === 'index.js').content = Buffer.from('tampered').toString('base64');
  const tampered = Intake.buildAssessment(tamperedInput);
  check(tampered.disposition === 'HOLD_INVALID_PACKAGE', 'candidate byte tampering is held by native package verification');

  const receiptAuthorityInput = deepClone(valid.input);
  receiptAuthorityInput.returnReceipt.authority.installed = true;
  const receiptAuthority = Intake.buildAssessment(receiptAuthorityInput);
  check(receiptAuthority.disposition === 'HOLD_BOUNDARY_EXPANSION', 'return receipt claiming installation is held');

  const rootCollision = assess(buildCandidate({ id: 'baseline-simulation-lab' }), 'root-collision').assessment;
  check(rootCollision.disposition === 'HOLD_ROOT_IDENTITY_COLLISION', 'candidate cannot reuse a protected root module id');

  const statusExpansion = assess(buildCandidate({ status: 'TEST' }), 'status-expansion').assessment;
  check(statusExpansion.disposition === 'HOLD_BOUNDARY_EXPANSION', 'branch candidate must remain EXPERIMENTAL');

  const permissionExpansion = assess(buildCandidate({ permissions: ['storage'] }), 'permission-expansion').assessment;
  check(permissionExpansion.disposition === 'HOLD_BOUNDARY_EXPANSION', 'simulation extension permission expansion is held');

  const truthChange = assess(buildCandidate({ boundaryOverrides: { truthRulesChanged: true } }), 'truth-change').assessment;
  check(truthChange.disposition === 'HOLD_BOUNDARY_EXPANSION', 'candidate cannot change invariant truth rules');

  const nativeIdentityMapping = makeMapping('SOFTWARE_REPOSITORY');
  nativeIdentityMapping.nativeSchemaIdentityClaimed = true;
  const nativeIdentity = assess(buildCandidate({ mappings: [nativeIdentityMapping] }), 'native-identity').assessment;
  check(nativeIdentity.disposition === 'HOLD_BOUNDARY_EXPANSION', 'adapter cannot claim native schema identity');

  const missingCapabilityMapping = makeMapping('SOFTWARE_REPOSITORY', 'simulation.extension.translate.missing');
  const missingCapability = assess(buildCandidate({ mappings: [missingCapabilityMapping], contractProvides: ['simulation.extension.translate.other'] }), 'missing-capability').assessment;
  check(missingCapability.disposition === 'HOLD_CONTRACT_MAPPING', 'mapping to an undeclared candidate capability is held');

  const missingSubjectMapping = assess(buildCandidate({ subjectKinds: ['SOFTWARE_REPOSITORY', 'MIRROR_STATE'], mappings: [makeMapping('SOFTWARE_REPOSITORY')] }), 'missing-subject').assessment;
  check(missingSubjectMapping.disposition === 'HOLD_CONTRACT_MAPPING', 'every declared subject kind requires an exact mapping');

  const wrongSpecialistRelation = assess(buildCandidate({ relation: 'SPECIALIST_EXTENSION', subjectKinds: ['SOFTWARE_REPOSITORY'] }), 'wrong-specialist').assessment;
  check(wrongSpecialistRelation.disposition === 'HOLD_BOUNDARY_EXPANSION', 'specialist extension cannot silently target a software repository');

  const wrongHostDigest = assess(buildCandidate({ hostProfileDigest: 'sha256:' + '0'.repeat(64) }), 'wrong-host').assessment;
  check(wrongHostDigest.disposition === 'HOLD_CONTRACT_MAPPING', 'extension bound to another host profile is held');

  const invalidHostInput = deepClone(valid.input);
  invalidHostInput.hostProfile.authority.installAuthorized = true;
  const invalidHost = Intake.buildAssessment(invalidHostInput);
  check(invalidHost.disposition === 'HOLD_INVALID_HOST_PROFILE', 'tampered host authority is held before candidate mapping');

  const assessmentTamper = deepClone(valid.assessment);
  assessmentTamper.authority.adoptionAuthorized = true;
  check(!Intake.verifyAssessment(assessmentTamper, valid.input).pass, 'assessment cannot be silently changed into adoption authority');
  check(valid.assessment.staticVerification.runtimeBehavior === 'NOT_RUN' && valid.assessment.staticVerification.humanValue === 'NOT_RUN', 'static integrity is not mislabeled as runtime behavior or human value');
  check(valid.assessment.authority.humanBenefitClaimed === false && valid.assessment.authority.sharedGrowthClaimed === false && valid.assessment.authority.modelWeightsTrained === false, 'intake claims neither beneficiary growth nor model training');

  console.log('Simulation Lab Extension Intake selftest passed: ' + checks + ' checks.');
} finally {
  const resolvedTemp = path.resolve(tempRoot);
  const resolvedSystemTemp = path.resolve(os.tmpdir()) + path.sep;
  if (!resolvedTemp.startsWith(resolvedSystemTemp)) throw new Error('refusing to clean a temp path outside the system temp directory');
  fs.rmSync(resolvedTemp, { recursive: true, force: true });
}

