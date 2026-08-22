'use strict';

const crypto = require('crypto');
const ReturnGate = require('../../tools/branch-module-return-gate/return-gate-core');

const HOST_PROFILE_SCHEMA = 'axm.simulation-lab-host-profile/v1';
const EXTENSION_SCHEMA = 'axm.simulation-lab-extension/v1';
const ASSESSMENT_SCHEMA = 'axm.simulation-lab-extension-assessment/v1';
const VERSION = '0.1.0';
const EXTENSION_FILE = 'axm-simulation-lab-extension.json';
const SUBJECT_KINDS = Object.freeze(['SOFTWARE_REPOSITORY', 'MIRROR_STATE', 'SPECIALIST_MASK']);
const RELATIONS = Object.freeze(['ADAPTER', 'SPECIALIST_EXTENSION']);

const HOST_ROOTS = Object.freeze([
  {
    role: 'PORTABLE_BASELINE_IDENTITY',
    moduleId: 'portable-baseline-capsule',
    requiredProvides: [
      'simulation.baseline.capsule.verify',
      'simulation.baseline.software.bind-git-dirty',
      'simulation.baseline.mirror.separate-realms',
      'simulation.baseline.specialist.bind-host-mask-ceiling',
      'simulation.baseline.authority.none',
      'axm.portable-baseline-capsule/v1'
    ],
    requiredAccepts: [
      'SOFTWARE_REPOSITORY adapter observations',
      'MIRROR_STATE adapter observations',
      'SPECIALIST_MASK adapter observations'
    ]
  },
  {
    role: 'INVARIANT_RUN_ENVELOPE',
    moduleId: 'baseline-simulation-lab',
    requiredProvides: [
      'simulation.run-envelope.verify',
      'simulation.run-envelope.no-new-information-stop',
      'simulation.run-envelope.artifact-ancestry',
      'simulation.run-envelope.idea-evidence-ancestry',
      'simulation.run-envelope.native-evidence-routing',
      'simulation.run-envelope.output-closure',
      'simulation.run-envelope.transport-receipts',
      'simulation.run-envelope.budget-hold',
      'simulation.run-envelope.human-authority-gate',
      'axm.baseline-simulation-lab-run/v1'
    ],
    requiredAccepts: [
      'SOFTWARE_REPOSITORY baseline capsule',
      'MIRROR_STATE baseline capsule',
      'SPECIALIST_MASK baseline capsule'
    ]
  },
  {
    role: 'GROUNDED_CHALLENGER_EVALUATION',
    moduleId: 'grounded-growth-challenger-lab',
    requiredProvides: [
      'growth.challenger.direction-native-verify',
      'growth.challenger.baseline-challenger-bind',
      'growth.challenger.held-out-separation',
      'growth.challenger.regression-hold',
      'growth.challenger.no-gain-hold',
      'growth.challenger.adoption.none',
      'axm.grounded-growth-challenger-plan/v1',
      'axm.grounded-growth-challenger-evaluation/v1'
    ],
    requiredAccepts: [
      'one verified non-WAIT direction hypothesis',
      'inert baseline and challenger references',
      'explicitly executed shadow and diagnostic receipts'
    ]
  }
]);

const ROOT_REFUSALS = Object.freeze([
  'automatic-install',
  'automatic-permission-grant',
  'automatic-promotion',
  'automatic-merge',
  'automatic-canon',
  'foundation-mutation',
  'model-weight-training-claim'
]);

const CANDIDATE_REFUSALS = Object.freeze([
  'automatic-execution',
  'automatic-write',
  'automatic-install',
  'automatic-permission-grant',
  'automatic-promotion',
  'automatic-merge',
  'automatic-canon',
  'foundation-mutation',
  'model-weight-training-claim'
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    const output = {};
    Object.keys(value).sort().forEach((key) => { output[key] = stableValue(value[key]); });
    return output;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stableStringify(value), 'utf8');
  return 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(label + ' has unknown fields: ' + extras.sort().join(', '));
}

function requiredText(value, label, maximum = 240) {
  const result = String(value || '').trim();
  if (!result || result.length > maximum) throw new Error(label + ' must be 1-' + maximum + ' characters');
  if (/^[A-Za-z]:[\\/]|^\//.test(result)) throw new Error(label + ' cannot persist a machine path');
  return result;
}

function portableId(value, label) {
  const result = requiredText(value, label, 100);
  if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(result)) throw new Error(label + ' must be a portable lowercase id');
  return result;
}

function uniqueSorted(values, label, maximum = 64) {
  if (!Array.isArray(values) || values.length > maximum) throw new Error(label + ' must be an array with at most ' + maximum + ' entries');
  const normalized = values.map((value, index) => requiredText(value, label + '[' + index + ']'));
  if (new Set(normalized).size !== normalized.length) throw new Error(label + ' contains duplicates');
  return normalized.sort();
}

function includesEvery(values, required) {
  const set = new Set(Array.isArray(values) ? values : []);
  return required.every((value) => set.has(value));
}

function sameTextSet(left, right) {
  return stableStringify(Array.from(new Set(left || [])).sort()) === stableStringify(Array.from(new Set(right || [])).sort());
}

function normalizeRootContract(definition, contract) {
  exactKeys(contract, ['schema', 'id', 'version', 'status', 'provides', 'consumes', 'permissions', 'handoffs', 'boundaries', 'lifecycle'], definition.moduleId + ' contract');
  if (contract.schema !== 'axm.module-contract/v1') throw new Error(definition.moduleId + ' contract schema mismatch');
  if (contract.id !== definition.moduleId) throw new Error(definition.moduleId + ' contract identity mismatch');
  if (contract.status !== 'TEST') throw new Error(definition.moduleId + ' must remain TEST');
  requiredText(contract.version, definition.moduleId + ' version', 80);
  if (!Array.isArray(contract.permissions) || contract.permissions.length) throw new Error(definition.moduleId + ' must retain zero permissions');
  if (!Array.isArray(contract.provides) || !includesEvery(contract.provides, definition.requiredProvides)) {
    throw new Error(definition.moduleId + ' is missing required host capabilities');
  }
  if (!contract.handoffs || !Array.isArray(contract.handoffs.accepts) || !Array.isArray(contract.handoffs.emits)) {
    throw new Error(definition.moduleId + ' handoff arrays are required');
  }
  if (!includesEvery(contract.handoffs.accepts, definition.requiredAccepts)) throw new Error(definition.moduleId + ' is missing required host accepts');
  if (!contract.boundaries || !Array.isArray(contract.boundaries.refuses) || !includesEvery(contract.boundaries.refuses, ROOT_REFUSALS)) {
    throw new Error(definition.moduleId + ' is missing required authority refusals');
  }
  return {
    role: definition.role,
    moduleId: definition.moduleId,
    version: contract.version,
    status: contract.status,
    contractDigest: sha256(contract),
    contract: clone(contract)
  };
}

function buildHostProfile(input) {
  exactKeys(input, ['profileId', 'generatedAt', 'contracts'], 'host profile input');
  const profileId = portableId(input.profileId, 'profileId');
  const generatedAt = requiredText(input.generatedAt, 'generatedAt', 80);
  exactKeys(input.contracts, HOST_ROOTS.map((item) => item.moduleId), 'host contracts');
  const roots = HOST_ROOTS.map((definition) => normalizeRootContract(definition, input.contracts[definition.moduleId]));
  const profile = {
    schema: HOST_PROFILE_SCHEMA,
    version: VERSION,
    profileId,
    generatedAt,
    roots,
    subjectKinds: SUBJECT_KINDS.slice(),
    invariantTruthRules: [
      'ADAPTERS_CHANGE_TRANSLATION_NOT_TRUTH_RULES',
      'UNSUPPORTED_SOURCE_FIELDS_REMAIN_DIGEST_BOUND',
      'NO_NEW_INFORMATION_STOPS_RECURSION',
      'MODEL_OR_CANDIDATE_CANNOT_CERTIFY_AVAILABILITY',
      'HUMAN_VALUE_REQUIRES_HUMAN_JUDGMENT'
    ],
    authority: {
      permissions: [],
      executionAuthorized: false,
      installAuthorized: false,
      promotionAuthorized: false,
      mergeAuthorized: false,
      canonAuthorized: false,
      foundationMutationAuthorized: false,
      modelWeightTrainingClaimed: false
    },
    profileDigest: null
  };
  const payload = clone(profile);
  delete payload.profileDigest;
  profile.profileDigest = sha256(payload);
  return profile;
}

function verifyHostProfile(profile) {
  const errors = [];
  try {
    if (!profile || profile.schema !== HOST_PROFILE_SCHEMA) throw new Error('host profile schema mismatch');
    if (profile.version !== VERSION) throw new Error('host profile version mismatch');
    if (!Array.isArray(profile.roots)) throw new Error('host profile roots are required');
    const contracts = {};
    profile.roots.forEach((root) => { contracts[root.moduleId] = root.contract; });
    const rebuilt = buildHostProfile({ profileId: profile.profileId, generatedAt: profile.generatedAt, contracts });
    if (stableStringify(rebuilt) !== stableStringify(profile)) throw new Error('host profile content or derived state mismatch');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors };
}

function normalizeBoundaries(boundaries) {
  const keys = [
    'truthRulesChanged', 'rootReplacement', 'originalSourceMutation', 'candidateCodeExecuted',
    'installed', 'promoted', 'canonChanged', 'permissionsRequested'
  ];
  exactKeys(boundaries, keys, 'extension boundaries');
  keys.slice(0, 7).forEach((key) => {
    if (boundaries[key] !== false) throw new Error('extension boundaries.' + key + ' must be false');
  });
  if (!Array.isArray(boundaries.permissionsRequested) || boundaries.permissionsRequested.length) {
    throw new Error('extension boundaries.permissionsRequested must be empty');
  }
  return {
    truthRulesChanged: false,
    rootReplacement: false,
    originalSourceMutation: false,
    candidateCodeExecuted: false,
    installed: false,
    promoted: false,
    canonChanged: false,
    permissionsRequested: []
  };
}

function normalizeExtensionDeclaration(value) {
  exactKeys(value, ['schema', 'version', 'extensionId', 'candidate', 'relation', 'hostProfileDigest', 'subjectKinds', 'mappings', 'boundaries'], 'extension declaration');
  if (value.schema !== EXTENSION_SCHEMA) throw new Error('extension declaration schema mismatch');
  if (value.version !== VERSION) throw new Error('extension declaration version mismatch');
  const extensionId = portableId(value.extensionId, 'extensionId');
  exactKeys(value.candidate, ['moduleId', 'version'], 'extension candidate');
  const candidate = {
    moduleId: portableId(value.candidate.moduleId, 'extension candidate moduleId'),
    version: requiredText(value.candidate.version, 'extension candidate version', 80)
  };
  if (!RELATIONS.includes(value.relation)) throw new Error('extension relation is unsupported');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(value.hostProfileDigest || ''))) throw new Error('extension hostProfileDigest is invalid');
  const subjectKinds = uniqueSorted(value.subjectKinds, 'extension subjectKinds', SUBJECT_KINDS.length);
  if (!subjectKinds.length || subjectKinds.some((kind) => !SUBJECT_KINDS.includes(kind))) throw new Error('extension subjectKinds are unsupported');
  if (value.relation === 'SPECIALIST_EXTENSION' && (subjectKinds.length !== 1 || subjectKinds[0] !== 'SPECIALIST_MASK')) {
    throw new Error('SPECIALIST_EXTENSION must target only SPECIALIST_MASK');
  }
  if (!Array.isArray(value.mappings) || !value.mappings.length || value.mappings.length > 24) throw new Error('extension mappings must contain 1-24 entries');
  const mappings = value.mappings.map((mapping, index) => {
    exactKeys(mapping, [
      'subjectKind', 'candidateCapability', 'hostModuleId', 'hostCapability',
      'inputSchema', 'outputSchema', 'unsupportedFieldPolicy', 'nativeSchemaIdentityClaimed'
    ], 'extension mappings[' + index + ']');
    if (!SUBJECT_KINDS.includes(mapping.subjectKind)) throw new Error('extension mappings[' + index + '] subjectKind is unsupported');
    if (!subjectKinds.includes(mapping.subjectKind)) throw new Error('extension mappings[' + index + '] subjectKind is not declared');
    if (mapping.unsupportedFieldPolicy !== 'DIGEST_BOUND_REFERENCE') throw new Error('extension mappings[' + index + '] must preserve unsupported fields by digest-bound reference');
    if (mapping.nativeSchemaIdentityClaimed !== false) throw new Error('extension mappings[' + index + '] cannot claim native schema identity');
    return {
      subjectKind: mapping.subjectKind,
      candidateCapability: requiredText(mapping.candidateCapability, 'mapping candidateCapability'),
      hostModuleId: portableId(mapping.hostModuleId, 'mapping hostModuleId'),
      hostCapability: requiredText(mapping.hostCapability, 'mapping hostCapability'),
      inputSchema: requiredText(mapping.inputSchema, 'mapping inputSchema'),
      outputSchema: requiredText(mapping.outputSchema, 'mapping outputSchema'),
      unsupportedFieldPolicy: 'DIGEST_BOUND_REFERENCE',
      nativeSchemaIdentityClaimed: false
    };
  }).sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  const mappingKeys = mappings.map((mapping) => stableStringify(mapping));
  if (new Set(mappingKeys).size !== mappingKeys.length) throw new Error('extension mappings contain duplicates');
  subjectKinds.forEach((kind) => {
    if (!mappings.some((mapping) => mapping.subjectKind === kind)) throw new Error('extension mapping missing for ' + kind);
  });
  return {
    schema: EXTENSION_SCHEMA,
    version: VERSION,
    extensionId,
    candidate,
    relation: value.relation,
    hostProfileDigest: value.hostProfileDigest,
    subjectKinds,
    mappings,
    boundaries: normalizeBoundaries(value.boundaries)
  };
}

function packageFile(packageValue, relativePath) {
  const files = packageValue && Array.isArray(packageValue.files) ? packageValue.files : [];
  const item = files.find((file) => file.path === relativePath);
  if (!item) throw new Error('candidate package is missing ' + relativePath);
  const bytes = Buffer.from(String(item.content || ''), 'base64');
  if (bytes.toString('base64') !== item.content) throw new Error(relativePath + ' is not canonical base64');
  if (sha256(bytes) !== 'sha256:' + item.sha256) throw new Error(relativePath + ' digest mismatch');
  return bytes;
}

function packageJson(packageValue, relativePath) {
  try { return JSON.parse(packageFile(packageValue, relativePath).toString('utf8').replace(/^\uFEFF/, '')); }
  catch (error) { throw new Error(relativePath + ' is invalid JSON: ' + error.message); }
}

function addIssue(issues, code, detail) {
  issues.push({ code, detail: String(detail) });
}

function checkReturnReceipt(receipt, packageResult, issues) {
  if (!receipt || receipt.schema !== ReturnGate.RECEIPT_SCHEMA) addIssue(issues, 'RECEIPT_SCHEMA', 'branch return receipt schema mismatch');
  if (!receipt || receipt.status !== 'READY_FOR_GOVERNED_INTAKE') addIssue(issues, 'RECEIPT_STATUS', 'branch return receipt is not ready for governed intake');
  const authority = receipt && receipt.authority || {};
  ['staged', 'installed', 'promoted', 'canonChanged', 'permissionsChanged', 'candidateCodeExecuted'].forEach((key) => {
    if (authority[key] !== false) addIssue(issues, 'RECEIPT_AUTHORITY', 'return receipt authority.' + key + ' must be false');
  });
  const truth = receipt && receipt.truth || {};
  if (truth.structuralPortabilityChecked !== true) addIssue(issues, 'RECEIPT_TRUTH', 'structural portability must be checked');
  if (truth.runtimeVerified !== false || truth.visualsVerified !== false) addIssue(issues, 'RECEIPT_TRUTH', 'return receipt cannot claim runtime or visual verification');
  if (receipt && packageResult && receipt.packageDigest !== packageResult.packageDigest) addIssue(issues, 'RECEIPT_DIGEST', 'return receipt package digest mismatch');
}

function validateCandidateArtifacts(context, issues) {
  const { hostProfile, packageValue, packageResult, receipt, manifest, contract, returnDeclaration, extension, returnBytes } = context;
  const piece = packageValue.piece || {};
  const rootIds = new Set(hostProfile.roots.map((root) => root.moduleId));
  if (rootIds.has(String(piece.id || ''))) addIssue(issues, 'ROOT_IDENTITY_COLLISION', 'candidate module id collides with a protected simulation root');

  if (manifest.schema !== 'axm.tool-manifest/v1' || contract.schema !== 'axm.module-contract/v1') addIssue(issues, 'CANDIDATE_STRUCTURE', 'candidate manifest or contract schema mismatch');
  if (manifest.id !== piece.id || contract.id !== piece.id || returnDeclaration.module.id !== piece.id || extension.candidate.moduleId !== piece.id) {
    addIssue(issues, 'CANDIDATE_IDENTITY', 'candidate identities do not match');
  }
  if (manifest.version !== piece.version || contract.version !== piece.version || returnDeclaration.module.version !== piece.version || extension.candidate.version !== piece.version) {
    addIssue(issues, 'CANDIDATE_IDENTITY', 'candidate versions do not match');
  }
  if (manifest.status !== 'EXPERIMENTAL' || contract.status !== 'EXPERIMENTAL') addIssue(issues, 'CANDIDATE_STATUS', 'returned simulation extension must remain EXPERIMENTAL');
  if (manifest.contract !== 'module.contract.json') addIssue(issues, 'CANDIDATE_STRUCTURE', 'manifest contract path mismatch');
  if (!packageValue.files.some((file) => file.path === manifest.entry)) addIssue(issues, 'CANDIDATE_STRUCTURE', 'manifest entry is absent from the package');
  if (!Array.isArray(manifest.permissions) || manifest.permissions.length || !Array.isArray(contract.permissions) || contract.permissions.length) {
    addIssue(issues, 'PERMISSION_EXPANSION', 'simulation extension must request zero permissions');
  }
  if (!Array.isArray(contract.provides) || !Array.isArray(contract.consumes) || !contract.handoffs || !Array.isArray(contract.handoffs.accepts) || !Array.isArray(contract.handoffs.emits)) {
    addIssue(issues, 'CANDIDATE_STRUCTURE', 'candidate contract capability and handoff arrays are required');
  }
  if (!contract.boundaries || !Array.isArray(contract.boundaries.refuses) || !includesEvery(contract.boundaries.refuses, CANDIDATE_REFUSALS)) {
    addIssue(issues, 'BOUNDARY_EXPANSION', 'candidate contract is missing required authority refusals');
  }

  const portability = returnDeclaration.portability || {};
  ['branchRuntimeRequired', 'networkRequired', 'packageManagerRequired', 'hostCommandsRequired'].forEach((key) => {
    if (portability[key] !== false) addIssue(issues, 'BOUNDARY_EXPANSION', 'return portability.' + key + ' must be false');
  });
  ['externalPackages', 'remoteServices', 'nativeComponents', 'hostCommands', 'absolutePaths', 'permissions'].forEach((key) => {
    if (!Array.isArray(portability[key]) || portability[key].length) addIssue(issues, key === 'permissions' ? 'PERMISSION_EXPANSION' : 'BOUNDARY_EXPANSION', 'return portability.' + key + ' must be empty');
  });
  const packagePaths = packageValue.files.map((file) => file.path);
  if (!returnDeclaration.selection || !sameTextSet(returnDeclaration.selection.files, packagePaths)) addIssue(issues, 'CANDIDATE_STRUCTURE', 'return selection must exactly match packaged files');
  if (!packagePaths.includes(EXTENSION_FILE)) addIssue(issues, 'CANDIDATE_STRUCTURE', 'extension declaration must be packaged');

  if (piece.activation !== 'manual' || packageValue.requiredSeats !== 'dual') addIssue(issues, 'BOUNDARY_EXPANSION', 'candidate activation must be manual with dual review seats');
  if (!sameTextSet(piece.capabilities && piece.capabilities.provides, contract.provides)) addIssue(issues, 'CANDIDATE_STRUCTURE', 'package provided capabilities differ from candidate contract');
  if (!sameTextSet(piece.capabilities && piece.capabilities.requires, contract.consumes)) addIssue(issues, 'CANDIDATE_STRUCTURE', 'package required capabilities differ from candidate contract');
  if (!sameTextSet(piece.protocols, [...(contract.handoffs && contract.handoffs.emits || []), ...(contract.handoffs && contract.handoffs.accepts || [])])) {
    addIssue(issues, 'CANDIDATE_STRUCTURE', 'package protocols differ from candidate contract handoffs');
  }
  const profile = piece.resourceProfile || {};
  if (profile.fileCount !== packageResult.files || profile.totalBytes !== packageResult.bytes || profile.branchRuntimeRequired !== false || profile.networkRequired !== false || profile.packageManagerRequired !== false || profile.nativeComponentsRequired !== false) {
    addIssue(issues, 'BOUNDARY_EXPANSION', 'package resource profile expands or misstates the return boundary');
  }
  const provenance = piece.provenance || {};
  if (provenance.returnContractSha256 !== sha256(returnBytes).replace('sha256:', '')) addIssue(issues, 'CANDIDATE_STRUCTURE', 'return contract provenance digest mismatch');
  if (!returnDeclaration.source || provenance.sourceProject !== returnDeclaration.source.project || provenance.sourceBranch !== returnDeclaration.source.branch || provenance.sourceRepository !== (returnDeclaration.source.repository || null) || provenance.sourceCommit !== (returnDeclaration.source.commit || null)) {
    addIssue(issues, 'CANDIDATE_STRUCTURE', 'package provenance differs from return declaration');
  }
  if (!receipt.module || receipt.module.id !== piece.id || receipt.module.version !== piece.version) addIssue(issues, 'RECEIPT_IDENTITY', 'return receipt candidate identity mismatch');

  if (extension.hostProfileDigest !== hostProfile.profileDigest) addIssue(issues, 'MAPPING_HOST_PROFILE', 'extension targets a different host profile digest');
  const roots = new Map(hostProfile.roots.map((root) => [root.moduleId, root]));
  extension.mappings.forEach((mapping) => {
    const root = roots.get(mapping.hostModuleId);
    if (!root) addIssue(issues, 'MAPPING_HOST_ROOT', 'mapping targets an unknown host root: ' + mapping.hostModuleId);
    else if (!root.contract.provides.includes(mapping.hostCapability)) addIssue(issues, 'MAPPING_HOST_CAPABILITY', 'mapping host capability is not provided: ' + mapping.hostCapability);
    if (!contract.provides.includes(mapping.candidateCapability)) addIssue(issues, 'MAPPING_CANDIDATE_CAPABILITY', 'candidate does not provide mapped capability: ' + mapping.candidateCapability);
    if (!contract.handoffs.accepts.includes(mapping.inputSchema)) addIssue(issues, 'MAPPING_INPUT_SCHEMA', 'candidate does not accept mapped input schema: ' + mapping.inputSchema);
    if (!contract.handoffs.emits.includes(mapping.outputSchema)) addIssue(issues, 'MAPPING_OUTPUT_SCHEMA', 'candidate does not emit mapped output schema: ' + mapping.outputSchema);
  });
}

function evaluationRequirements(subjectKinds) {
  const requirements = [
    ['adapter-runtime-translation', 'DETERMINISTIC_BEHAVIOR', 'HIGH', 'candidate translation behavior', 'ISOLATED_SHADOW_PLUS_PAIRED_DIAGNOSTIC_RECEIPTS', 'static package integrity'],
    ['no-new-information-stop', 'DETERMINISTIC_BEHAVIOR', 'HIGH', 'unchanged baseline and no-new-information behavior', 'BASELINE_SIMULATION_RUN_RECEIPT', 'general recursion safety'],
    ['artifact-and-evidence-ancestry', 'PERSISTENCE', 'HIGH', 'artifact and idea/evidence ancestry across a bounded run', 'EXACT_PARENT_AND_OUTPUT_CLOSURE_RECEIPTS', 'truth beyond the bound ancestry'],
    ['output-closure-and-transport', 'TRANSPORT', 'HIGH', 'later evidence dependency and sender/receiver parity', 'DIGEST_BOUND_SENDER_AND_RECEIVER_RECEIPTS', 'receiver use or human value'],
    ['held-out-ai-and-regression', 'LEARNING_IMPROVEMENT', 'HIGH', 'bounded challenger improvement without held-out regression', 'GROUNDED_GROWTH_CHALLENGER_EVALUATION', 'generalization, model learning, or human benefit'],
    ['resource-budget', 'RESOURCE_SAFETY', 'MEDIUM', 'time, storage, concurrency and retry bounds', 'MEASURED_BOUNDED_RUN_TELEMETRY', 'unattended or unknown-host safety'],
    ['authority-denial', 'AUTHORIZATION', 'HIGH', 'execution, install, permission, promotion, merge, CANON and Foundation denial', 'ALLOWED_AND_DENIED_BOUNDARY_ATTEMPTS', 'safety of an authorized future action'],
    ['human-comprehension', 'TASTE_OR_MEANING', 'HIGH', 'voluntary human comprehension and usefulness', 'EXPLICIT_HUMAN_JUDGMENT', 'universal value or consent']
  ];
  const subjectRequirements = {
    SOFTWARE_REPOSITORY: ['software-git-dirty-separation', 'DETERMINISTIC_BEHAVIOR', 'HIGH', 'Git identity and dirty-worktree state remain separate', 'DIGEST_BOUND_SOFTWARE_ADAPTER_RECEIPT', 'repository usefulness'],
    MIRROR_STATE: ['mirror-realm-separation', 'AUTHORIZATION', 'HIGH', 'Original Mirror, private lessons and disposable challenger remain distinct', 'DIGEST_BOUND_MIRROR_ADAPTER_RECEIPT', 'private lesson quality or identity'],
    SPECIALIST_MASK: ['specialist-host-mask-ceiling', 'AUTHORIZATION', 'HIGH', 'host model, mask version, capabilities and evidence ceiling remain separate', 'DIGEST_BOUND_SPECIALIST_ADAPTER_RECEIPT', 'host-model truth or new permissions']
  };
  subjectKinds.forEach((kind) => requirements.push(subjectRequirements[kind]));
  return requirements.map(([id, claimKind, risk, scope, primarySurface, cannotProve]) => ({
    id,
    claimKind,
    risk,
    scope,
    primarySurface,
    status: 'NOT_RUN',
    cannotProve
  }));
}

function dispositionFor(issues) {
  const codes = issues.map((issue) => issue.code);
  if (codes.some((code) => code.startsWith('HOST_'))) return 'HOLD_INVALID_HOST_PROFILE';
  if (codes.some((code) => code.startsWith('PACKAGE_') || code === 'RECEIPT_DIGEST')) return 'HOLD_INVALID_PACKAGE';
  if (codes.includes('ROOT_IDENTITY_COLLISION')) return 'HOLD_ROOT_IDENTITY_COLLISION';
  if (codes.some((code) => /AUTHORITY|BOUNDARY|PERMISSION|STATUS|RECEIPT_TRUTH|RECEIPT_STATUS/.test(code))) return 'HOLD_BOUNDARY_EXPANSION';
  if (issues.length) return 'HOLD_CONTRACT_MAPPING';
  return 'READY_FOR_EXPERIMENTAL_EVALUATION_PLANNING';
}

function buildAssessment(input) {
  exactKeys(input, ['assessmentId', 'generatedAt', 'hostProfile', 'package', 'returnReceipt'], 'assessment input');
  const assessmentId = portableId(input.assessmentId, 'assessmentId');
  const generatedAt = requiredText(input.generatedAt, 'generatedAt', 80);
  const issues = [];
  const hostVerification = verifyHostProfile(input.hostProfile);
  hostVerification.errors.forEach((error) => addIssue(issues, 'HOST_PROFILE_INVALID', error));
  const packageResult = ReturnGate.verifyPackage(input.package, input.returnReceipt);
  packageResult.errors.forEach((error) => addIssue(issues, 'PACKAGE_INVALID', error));
  checkReturnReceipt(input.returnReceipt, packageResult, issues);

  let extension = null;
  let moduleIdentity = null;
  if (hostVerification.pass && packageResult.pass) {
    try {
      const manifest = packageJson(input.package, 'manifest.json');
      const contract = packageJson(input.package, 'module.contract.json');
      const returnBytes = packageFile(input.package, 'axm-branch-return.json');
      const returnDeclaration = JSON.parse(returnBytes.toString('utf8').replace(/^\uFEFF/, ''));
      extension = normalizeExtensionDeclaration(packageJson(input.package, EXTENSION_FILE));
      moduleIdentity = { id: input.package.piece.id, version: input.package.piece.version };
      validateCandidateArtifacts({
        hostProfile: input.hostProfile,
        packageValue: input.package,
        packageResult,
        receipt: input.returnReceipt,
        manifest,
        contract,
        returnDeclaration,
        extension,
        returnBytes
      }, issues);
    } catch (error) {
      const code = /boundaries|permission|native schema identity|SPECIALIST_EXTENSION/.test(error.message)
        ? 'BOUNDARY_EXPANSION'
        : 'CANDIDATE_STRUCTURE';
      addIssue(issues, code, error.message);
    }
  }
  issues.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
  const disposition = dispositionFor(issues);
  const ready = disposition === 'READY_FOR_EXPERIMENTAL_EVALUATION_PLANNING';
  const requirements = ready ? evaluationRequirements(extension.subjectKinds) : [];
  const assessment = {
    schema: ASSESSMENT_SCHEMA,
    version: VERSION,
    assessmentId,
    generatedAt,
    status: 'TEST',
    bindings: {
      hostProfileDigest: input.hostProfile && input.hostProfile.profileDigest || null,
      candidatePackageDigest: packageResult.packageDigest ? 'sha256:' + packageResult.packageDigest : null,
      returnReceiptDigest: input.returnReceipt ? sha256(input.returnReceipt) : null,
      extensionDeclarationDigest: extension ? sha256(extension) : null,
      candidate: moduleIdentity
    },
    staticVerification: {
      hostProfile: hostVerification.pass ? 'PASS' : 'HOLD',
      packageIntegrity: packageResult.pass ? 'PASS' : 'HOLD',
      uniqueAdapterIdentity: issues.some((issue) => issue.code === 'ROOT_IDENTITY_COLLISION') ? 'HOLD' : (moduleIdentity ? 'PASS' : 'UNKNOWN'),
      truthAndAuthorityBoundary: issues.some((issue) => /AUTHORITY|BOUNDARY|PERMISSION|STATUS|RECEIPT_TRUTH|RECEIPT_STATUS/.test(issue.code)) ? 'HOLD' : (moduleIdentity ? 'PASS' : 'UNKNOWN'),
      contractMapping: issues.some((issue) => /MAPPING|SUBJECT|CANDIDATE_STRUCTURE|CANDIDATE_IDENTITY|RECEIPT_IDENTITY/.test(issue.code)) ? 'HOLD' : (extension ? 'PASS' : 'UNKNOWN'),
      runtimeBehavior: 'NOT_RUN',
      humanValue: 'NOT_RUN'
    },
    coverage: ready ? {
      relation: extension.relation,
      subjectKinds: extension.subjectKinds,
      mappingCount: extension.mappings.length,
      targetRootIds: Array.from(new Set(extension.mappings.map((mapping) => mapping.hostModuleId))).sort()
    } : null,
    issues,
    evaluationRequirements: requirements,
    disposition,
    nextGate: ready
      ? 'EXPLICIT_STEWARD_EXPERIMENT_DECISION_THEN_GROUNDED_GROWTH_CHALLENGER_PLAN'
      : 'REPAIR_EXACT_ISSUES_THEN_REASSESS',
    authority: {
      packageExecuted: false,
      assessmentExecutedCandidate: false,
      staged: false,
      installed: false,
      permissionsChanged: false,
      promoted: false,
      merged: false,
      canonChanged: false,
      foundationMutated: false,
      modelWeightsTrained: false,
      humanBenefitClaimed: false,
      sharedGrowthClaimed: false,
      adoptionAuthorized: false,
      graftAuthorized: false
    },
    assessmentDigest: null
  };
  const payload = clone(assessment);
  delete payload.assessmentDigest;
  assessment.assessmentDigest = sha256(payload);
  return assessment;
}

function verifyAssessment(assessment, input) {
  const errors = [];
  try {
    if (!assessment || assessment.schema !== ASSESSMENT_SCHEMA) throw new Error('assessment schema mismatch');
    if (assessment.version !== VERSION) throw new Error('assessment version mismatch');
    const rebuilt = buildAssessment(input);
    if (stableStringify(rebuilt) !== stableStringify(assessment)) throw new Error('assessment content or derived state mismatch');
  } catch (error) { errors.push(error.message); }
  return { pass: errors.length === 0, errors };
}

module.exports = {
  HOST_PROFILE_SCHEMA,
  EXTENSION_SCHEMA,
  ASSESSMENT_SCHEMA,
  VERSION,
  EXTENSION_FILE,
  SUBJECT_KINDS,
  RELATIONS,
  HOST_ROOTS,
  stableStringify,
  sha256,
  buildHostProfile,
  verifyHostProfile,
  normalizeExtensionDeclaration,
  buildAssessment,
  verifyAssessment
};
