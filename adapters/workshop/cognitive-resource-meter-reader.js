'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const WorkshopRoot = require('../../config/workshop-root');
const Metrology = require('../../kernel/cognitive-work-metrology-cell');
const Economics = require('../../kernel/cognitive-resource-economics-cell');

const SCHEMA = 'axm.mirror.cognitive-resource-meter-workshop-observation/v1';
const ROOT = path.resolve(__dirname, '..', '..');
const MODULE_ID = 'cognitive-resource-meter';
const MAX_DECLARATION_BYTES = 1024 * 1024;
const MAX_EXPORT_BYTES = 1024 * 1024;
const MAX_EXPORT_FILES = 128;
const MAX_BUNDLE_BYTES = 50 * 1024 * 1024;
const MAX_BUNDLE_FILES = 64;
const MAX_TOTAL_BUNDLE_BYTES = 256 * 1024 * 1024;
const REQUIRED_PERMISSION = 'cognitive.evidence.write';
const REQUIRED_HANDS = Object.freeze([
  'goal-run-receipt-capture-hand',
  'provider-compute-telemetry-capture-hand',
  'machine-profile-sealing-hand',
  'billing-rate-schedule-capture-hand',
  'local-hardware-rate-profile-hand',
  'mirror-observation-draft-export-hand',
  'mirror-economics-profile-draft-export-hand',
  'cognitive-ledger-archive-hand'
]);
const REQUIRED_REFUSALS = Object.freeze([
  'mirror-write',
  'automatic-network-price-refresh',
  'external-freshness-certification',
  'universal-token-to-compute-conversion',
  'nonlinear-billing-claim',
  'measured-or-billed-cost-claim-from-profile',
  'ranking',
  'optimization',
  'model-hardware-provider-or-plan-selection',
  'budget-allocation',
  'permission-grant',
  'training',
  'release',
  'canon',
  'world-action'
]);
const CONTRACTS = Object.freeze({
  [Metrology.DRAFT_SCHEMA]: Object.freeze({
    relativeMirrorPath: 'contracts/cognitive-work-observation-draft.schema.json',
    outputKind: 'COGNITIVE_WORK_OBSERVATION_DRAFT',
    normalize: Metrology.normalizeDraft,
    digest: Metrology.digest
  }),
  [Economics.PROFILE_DRAFT_SCHEMA]: Object.freeze({
    relativeMirrorPath: 'contracts/cognitive-resource-economics-profile-draft.schema.json',
    outputKind: 'COGNITIVE_RESOURCE_ECONOMICS_PROFILE_DRAFT',
    normalize: Economics.normalizeProfileDraft,
    digest: Economics.digest
  })
});

function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function stable(value) { return Metrology.stable(value); }
function digest(value) { return Metrology.digest(value); }
function contained(base, relative, label) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw new Error(`${label} must be a non-empty relative path`);
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(resolvedBase, relative);
  const relation = path.relative(resolvedBase, resolved);
  if (!relation || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) throw new Error(`${label} escapes its declared root: ${relative}`);
  return resolved;
}
function realDirectory(directory, label) {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a real directory`);
  return directory;
}
function boundedJson(file, limit, label) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a real file`);
  if (stat.size > limit) throw new Error(`${label} exceeds ${limit} bytes`);
  const bytes = fs.readFileSync(file);
  return { value: JSON.parse(bytes.toString('utf8')), bytes, bytesLength: bytes.length, sha256: sha256(bytes) };
}
function falseAuthority(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length || Object.values(value).some(item => item !== false)) {
    throw new Error(`${label} must declare only false authority`);
  }
}

function readDeclarations(workshopRoot, mirrorRoot = ROOT) {
  const moduleDirectory = realDirectory(path.join(workshopRoot, 'tools', MODULE_ID), 'cognitive-resource-meter module directory');
  const sharedDirectory = realDirectory(path.join(workshopRoot, 'shared', 'cognitive-resource'), 'cognitive-resource shared directory');
  const manifestRead = boundedJson(path.join(moduleDirectory, 'manifest.json'), MAX_DECLARATION_BYTES, 'cognitive-resource-meter manifest');
  const contractRead = boundedJson(path.join(moduleDirectory, 'module.contract.json'), MAX_DECLARATION_BYTES, 'cognitive-resource-meter module contract');
  const catalogRead = boundedJson(path.join(sharedDirectory, 'provider-declarations.json'), MAX_DECLARATION_BYTES, 'cognitive-resource provider catalog');
  const manifest = manifestRead.value;
  const contract = contractRead.value;
  const catalog = catalogRead.value;

  if (!manifest || manifest.id !== MODULE_ID || manifest.status !== 'TEST' || manifest.contract !== 'module.contract.json') throw new Error('cognitive-resource-meter TEST manifest identity changed');
  if (!Array.isArray(manifest.permissions) || !manifest.permissions.includes(REQUIRED_PERMISSION)) throw new Error('cognitive-resource-meter manifest permission declaration changed');
  const requiredOutputs = Object.values(CONTRACTS).map(item => item.outputKind).concat(['COGNITIVE_RESOURCE_LEDGER_RECEIPT', 'PRIVACY_SAFE_MACHINE_PROFILE_DIGEST']).sort();
  if (!Array.isArray(manifest.produces) || manifest.produces.some(item => typeof item !== 'string') || new Set(manifest.produces).size !== manifest.produces.length || requiredOutputs.some(item => !manifest.produces.includes(item))) throw new Error('cognitive-resource-meter required manifest outputs changed');
  if (!contract || contract.schema !== 'axm.module-contract/v1' || contract.id !== MODULE_ID || contract.status !== 'TEST') throw new Error('cognitive-resource-meter TEST module contract identity changed');
  if (!Array.isArray(contract.permissions) || !contract.permissions.includes(REQUIRED_PERMISSION)) throw new Error('cognitive-resource-meter module permission declaration changed');
  if (!contract.handoffs || !Array.isArray(contract.handoffs.emits) || Object.values(CONTRACTS).some(item => !contract.handoffs.emits.includes(item.outputKind))) throw new Error('cognitive-resource-meter exact draft handoff outputs changed');
  const refusals = contract.boundaries && contract.boundaries.refuses;
  if (!Array.isArray(refusals) || REQUIRED_REFUSALS.some(item => !refusals.includes(item))) throw new Error('cognitive-resource-meter refusal boundary is incomplete');
  if (!catalog || catalog.schema !== 'axm.cognitive-resource-hand-provider-catalog/v1' || catalog.status !== 'TEST') throw new Error('cognitive-resource provider catalog identity changed');
  falseAuthority(catalog.authority, 'cognitive-resource provider catalog authority');
  if (!Array.isArray(catalog.providers) || !catalog.providers.length || catalog.providers.some(provider => !provider || provider.automaticCapture !== false)) throw new Error('cognitive-resource provider automatic capture boundary changed');
  if (!Array.isArray(catalog.hands)) throw new Error('cognitive-resource hand declarations are missing');
  const handIds = catalog.hands.map(hand => hand && hand.id);
  if (handIds.some(id => typeof id !== 'string' || !id) || new Set(handIds).size !== handIds.length || REQUIRED_HANDS.some(id => !handIds.includes(id))) throw new Error('cognitive-resource required hand inventory changed');
  if (catalog.hands.some(hand => hand.automaticAuthority !== false)) throw new Error('cognitive-resource hand automatic authority boundary changed');

  if (!Array.isArray(catalog.contractBindings) || catalog.contractBindings.length !== Object.keys(CONTRACTS).length) throw new Error('cognitive-resource contract binding inventory changed');
  const seenSchemas = new Set();
  const bindings = catalog.contractBindings.map(binding => {
    if (!binding || typeof binding.schemaId !== 'string' || seenSchemas.has(binding.schemaId)) throw new Error('cognitive-resource contract binding identity is missing or duplicated');
    seenSchemas.add(binding.schemaId);
    const expected = CONTRACTS[binding.schemaId];
    if (!expected || binding.outputKind !== expected.outputKind || !/^[a-f0-9]{64}$/.test(String(binding.sha256 || ''))) throw new Error(`cognitive-resource contract binding changed: ${binding.schemaId}`);
    const workshopContract = boundedJson(contained(sharedDirectory, binding.path, 'cognitive-resource contract path'), MAX_DECLARATION_BYTES, `Workshop ${binding.schemaId} contract`);
    const mirrorContract = boundedJson(contained(mirrorRoot, expected.relativeMirrorPath, 'Mirror cognitive-resource contract path'), MAX_DECLARATION_BYTES, `Mirror ${binding.schemaId} contract`);
    if (workshopContract.value.$id !== binding.schemaId || mirrorContract.value.$id !== binding.schemaId) throw new Error(`cognitive-resource contract schema identity changed: ${binding.schemaId}`);
    if (workshopContract.sha256 !== binding.sha256 || mirrorContract.sha256 !== binding.sha256 || workshopContract.sha256 !== mirrorContract.sha256) throw new Error(`cognitive-resource contract bytes diverged: ${binding.schemaId}`);
    const consume = `contract:${binding.schemaId}@${binding.sha256}`;
    if (!Array.isArray(contract.consumes) || !contract.consumes.includes(consume)) throw new Error(`cognitive-resource module contract binding is absent: ${binding.schemaId}`);
    return {
      schemaId: binding.schemaId,
      outputKind: binding.outputKind,
      sha256: binding.sha256,
      workshopRelativePath: `shared/cognitive-resource/${binding.path.replace(/\\/g, '/')}`,
      mirrorRelativePath: expected.relativeMirrorPath,
      bytes: workshopContract.bytesLength
    };
  }).sort((left, right) => left.schemaId.localeCompare(right.schemaId));

  return {
    moduleDirectory,
    declaration: {
      moduleId: MODULE_ID,
      version: String(manifest.version || contract.version || ''),
      status: 'TEST',
      claimCeiling: 'TEST_MACHINE_BOUND_COGNITIVE_RESOURCE_AND_ECONOMICS_PROFILE_PRODUCER',
      manifest: { sha256: manifestRead.sha256, bytes: manifestRead.bytesLength },
      moduleContract: { sha256: contractRead.sha256, bytes: contractRead.bytesLength },
      providerCatalog: { sha256: catalogRead.sha256, bytes: catalogRead.bytesLength },
      bindings,
      providersDeclared: catalog.providers.length,
      handsDeclared: catalog.hands.length,
      handIds: handIds.slice().sort(),
      additionalHandIds: handIds.filter(id => !REQUIRED_HANDS.includes(id)).sort(),
      declaredOutputKinds: manifest.produces.slice().sort(),
      additionalOutputKinds: manifest.produces.filter(item => !requiredOutputs.includes(item)).sort(),
      automaticAuthority: false
    }
  };
}

function readExports(workshopRoot) {
  const exportDirectory = path.join(workshopRoot, 'exports', MODULE_ID);
  if (!fs.existsSync(exportDirectory)) return [];
  realDirectory(exportDirectory, 'cognitive-resource-meter export directory');
  const entries = fs.readdirSync(exportDirectory, { withFileTypes: true })
    .filter(entry => entry.name !== 'bundles')
    .sort((left, right) => left.name.localeCompare(right.name));
  if (entries.length > MAX_EXPORT_FILES) throw new Error(`cognitive-resource-meter export inventory exceeds ${MAX_EXPORT_FILES} files`);
  return entries.map(entry => {
    if (entry.name.startsWith('.') || !entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.json')) throw new Error(`unexpected cognitive-resource-meter export entry: ${entry.name}`);
    const file = contained(exportDirectory, entry.name, 'cognitive-resource-meter export path');
    let read;
    try {
      read = boundedJson(file, MAX_EXPORT_BYTES, `cognitive-resource-meter export ${entry.name}`);
    } catch (error) {
      return {
        relativePath: `exports/${MODULE_ID}/${entry.name}`,
        bytes: null,
        sha256: null,
        schema: null,
        outputKind: null,
        permissionStatus: null,
        normalizedDigest: null,
        state: 'REFUSED_INVALID_OR_UNBOUND_DRAFT',
        issue: String(error.message || error).slice(0, 500)
      };
    }
    const candidate = {
      relativePath: `exports/${MODULE_ID}/${entry.name}`,
      bytes: read.bytesLength,
      sha256: read.sha256,
      schema: read.value && read.value.schema || null,
      outputKind: null,
      permissionStatus: null,
      normalizedDigest: null,
      state: null,
      issue: null
    };
    const expected = CONTRACTS[candidate.schema];
    if (!expected) {
      candidate.state = 'REFUSED_UNDECLARED_OUTPUT_SCHEMA';
      candidate.issue = 'The export root schema is not one of the two digest-bound Mirror draft schemas.';
      return candidate;
    }
    candidate.outputKind = expected.outputKind;
    try {
      const normalized = expected.normalize(read.value);
      candidate.permissionStatus = normalized.permission.status;
      candidate.normalizedDigest = expected.digest(normalized);
      candidate.state = normalized.permission.status === 'ALLOWED'
        ? 'EXPLICIT_INTAKE_CANDIDATE_REQUIRES_STEWARD_REVIEW'
        : 'HOLD_PERMISSION_NOT_ALLOWED';
    } catch (error) {
      candidate.state = 'REFUSED_INVALID_OR_UNBOUND_DRAFT';
      candidate.issue = String(error.message || error).slice(0, 500);
    }
    return candidate;
  });
}

function readBundles(workshopRoot) {
  const bundleDirectory = path.join(workshopRoot, 'exports', MODULE_ID, 'bundles');
  if (!fs.existsSync(bundleDirectory)) return [];
  realDirectory(bundleDirectory, 'cognitive-resource-meter bundle directory');
  const entries = fs.readdirSync(bundleDirectory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
  if (entries.length > MAX_BUNDLE_FILES) throw new Error(`cognitive-resource-meter bundle inventory exceeds ${MAX_BUNDLE_FILES} files`);
  const bounded = entries.map(entry => {
    if (entry.name.startsWith('.') || !entry.isFile() || entry.isSymbolicLink() || !entry.name.endsWith('.zip')) throw new Error(`unexpected cognitive-resource-meter bundle entry: ${entry.name}`);
    const file = contained(bundleDirectory, entry.name, 'cognitive-resource-meter bundle path');
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`cognitive-resource-meter bundle ${entry.name} must be a real file`);
    if (stat.size > MAX_BUNDLE_BYTES) throw new Error(`cognitive-resource-meter bundle ${entry.name} exceeds ${MAX_BUNDLE_BYTES} bytes`);
    return { entry, file, bytes: stat.size };
  });
  const totalBytes = bounded.reduce((sum, item) => sum + item.bytes, 0);
  if (totalBytes > MAX_TOTAL_BUNDLE_BYTES) throw new Error(`cognitive-resource-meter bundle inventory exceeds ${MAX_TOTAL_BUNDLE_BYTES} total bytes`);
  return bounded.map(({ entry, file, bytes }) => {
    return {
      relativePath: `exports/${MODULE_ID}/bundles/${entry.name}`,
      bytes,
      sha256: sha256(fs.readFileSync(file)),
      state: 'OPAQUE_EVIDENCE_BUNDLE_OBSERVED_NOT_OPENED_NOT_INTAKE'
    };
  });
}

function buildObservation(resolution, declaration, exports, bundles = [], sourceStability = 'STABLE_ACROSS_SECOND_READ') {
  const reviewCandidates = exports.filter(item => item.state === 'EXPLICIT_INTAKE_CANDIDATE_REQUIRES_STEWARD_REVIEW').length;
  const holds = exports.length - reviewCandidates;
  const observation = {
    schema: SCHEMA,
    observationDigest: null,
    workshop: { state: resolution.state, source: resolution.source, absolutePathPersisted: false },
    sourceExecution: false,
    sourceStability,
    declaration,
    exports,
    bundles,
    summary: {
      exportedFilesObserved: exports.length,
      opaqueBundleArchivesObserved: bundles.length,
      explicitIntakeCandidates: reviewCandidates,
      heldOrRefusedExports: holds,
      observationsAdmitted: 0,
      economicsProfilesAdmitted: 0,
      providerSelections: 0,
      budgetAllocations: 0,
      trainingAdmissions: 0,
      promotions: 0,
      worldActions: 0
    },
    state: !exports.length
      ? 'DECLARED_TEST_PROVIDER_NO_EXPORTED_DRAFTS'
      : holds
        ? 'HOLD_DRAFTS_REQUIRE_REVIEW'
        : 'EXPLICIT_INTAKE_CANDIDATES_OBSERVED',
    authority: {
      automaticIntake: false,
      evidenceAdmission: false,
      measuredOrBilledCostClaim: false,
      currentPriceCertification: false,
      universalTokenComputeConversion: false,
      nonlinearBillingClaim: false,
      calibratedCostClaim: false,
      ranking: false,
      modelHardwareProviderOrPlanSelection: false,
      budgetAllocation: false,
      permissionGrant: false,
      trainingAdmission: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'Mirror observed only bounded typed Workshop declarations and export files. A valid export is an explicit-intake candidate, not admitted evidence, a sealed observation, a rate truth, measured or billed cost, current pricing, universal compute, calibrated accuracy, ranking, selection, budget authority, permission, training, promotion, CANON, or action.'
  };
  observation.observationDigest = digest(Object.assign({}, observation, { observationDigest: null }));
  return stable(observation);
}

function verifyObservation(observation) {
  if (!observation || observation.schema !== SCHEMA || observation.observationDigest !== digest(Object.assign({}, observation, { observationDigest: null }))) throw new Error('cognitive-resource-meter Workshop observation digest changed');
  if (observation.sourceExecution !== false || !observation.workshop || observation.workshop.absolutePathPersisted !== false) throw new Error('cognitive-resource-meter observation source boundary changed');
  const expectedStability = observation.state === 'WORKSHOP_ABSENT' ? 'NOT_APPLICABLE_WORKSHOP_ABSENT'
    : observation.state === 'COGNITIVE_RESOURCE_METER_ABSENT' ? 'NOT_APPLICABLE_MODULE_ABSENT'
      : 'STABLE_ACROSS_SECOND_READ';
  if (observation.sourceStability !== expectedStability) throw new Error('cognitive-resource-meter observation source stability changed');
  if (!observation.authority || Object.values(observation.authority).some(Boolean)) throw new Error('cognitive-resource-meter observation authority changed');
  if (observation.summary.observationsAdmitted !== 0 || observation.summary.economicsProfilesAdmitted !== 0 || observation.summary.providerSelections !== 0 || observation.summary.budgetAllocations !== 0 || observation.summary.trainingAdmissions !== 0 || observation.summary.promotions !== 0 || observation.summary.worldActions !== 0) throw new Error('cognitive-resource-meter observation outcome boundary changed');
  for (const candidate of observation.exports || []) {
    if ('content' in candidate || 'draft' in candidate) throw new Error('cognitive-resource-meter observation persisted draft content');
    if (candidate.state === 'EXPLICIT_INTAKE_CANDIDATE_REQUIRES_STEWARD_REVIEW' && candidate.permissionStatus !== 'ALLOWED') throw new Error('cognitive-resource-meter candidate permission boundary changed');
  }
  for (const bundle of observation.bundles || []) {
    if (bundle.state !== 'OPAQUE_EVIDENCE_BUNDLE_OBSERVED_NOT_OPENED_NOT_INTAKE' || !/^[a-f0-9]{64}$/.test(String(bundle.sha256 || ''))) throw new Error('cognitive-resource-meter opaque bundle boundary changed');
  }
  return true;
}

function observe(options = {}) {
  const resolution = WorkshopRoot.inspect(options);
  if (!resolution.available) {
    const observation = buildObservation(resolution, null, [], [], 'NOT_APPLICABLE_WORKSHOP_ABSENT');
    observation.state = 'WORKSHOP_ABSENT';
    observation.boundary = 'The resolved Workshop root is absent. No provider, draft, evidence, selection, training, promotion, or action is inferred from absence.';
    observation.observationDigest = digest(Object.assign({}, observation, { observationDigest: null }));
    return stable(observation);
  }
  const moduleDirectory = path.join(resolution.root, 'tools', MODULE_ID);
  if (!fs.existsSync(moduleDirectory)) {
    const observation = buildObservation(resolution, null, [], [], 'NOT_APPLICABLE_MODULE_ABSENT');
    observation.state = 'COGNITIVE_RESOURCE_METER_ABSENT';
    observation.boundary = 'Workshop is present but the declared cognitive-resource-meter module is absent. Mirror infers no provider or capability from its name.';
    observation.observationDigest = digest(Object.assign({}, observation, { observationDigest: null }));
    return stable(observation);
  }
  const declarations = readDeclarations(resolution.root, path.resolve(options.mirrorRoot || ROOT));
  const exports = readExports(resolution.root);
  const bundles = readBundles(resolution.root);
  const declarationsAfter = readDeclarations(resolution.root, path.resolve(options.mirrorRoot || ROOT));
  const exportsAfter = readExports(resolution.root);
  const bundlesAfter = readBundles(resolution.root);
  if (digest(declarations.declaration) !== digest(declarationsAfter.declaration) || digest(exports) !== digest(exportsAfter) || digest(bundles) !== digest(bundlesAfter)) {
    throw new Error('cognitive-resource-meter Workshop source changed during bounded observation');
  }
  const observation = buildObservation(resolution, declarations.declaration, exports, bundles);
  verifyObservation(observation);
  return observation;
}

module.exports = {
  SCHEMA,
  ROOT,
  MODULE_ID,
  MAX_DECLARATION_BYTES,
  MAX_EXPORT_BYTES,
  MAX_EXPORT_FILES,
  MAX_BUNDLE_BYTES,
  MAX_BUNDLE_FILES,
  MAX_TOTAL_BUNDLE_BYTES,
  REQUIRED_PERMISSION,
  REQUIRED_HANDS,
  REQUIRED_REFUSALS,
  CONTRACTS,
  sha256,
  contained,
  boundedJson,
  readDeclarations,
  readExports,
  readBundles,
  buildObservation,
  verifyObservation,
  observe
};
