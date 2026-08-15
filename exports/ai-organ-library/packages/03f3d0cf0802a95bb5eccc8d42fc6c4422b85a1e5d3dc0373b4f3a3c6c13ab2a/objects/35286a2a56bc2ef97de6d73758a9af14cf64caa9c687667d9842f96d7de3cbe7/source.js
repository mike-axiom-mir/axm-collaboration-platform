'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const LanguageModel = require('../learning/typed-trace-language-model');
const CapabilitySurvey = require('./foundation-development-capability-survey-organ');
const OutputAdapterPlanner = require('./foundation-development-capability-output-adapter-planner-organ');
const EnvelopeAdapter = require('./foundation-evidence-envelope-adapter-organ');
const ImmutableBatchStore = require('../kernel/immutable-batch-store');

const ORGAN_ID = 'axm.mirror.foundation-capability-native-artifact-inventory-organ/v2';
const DECLARATION_SCHEMA = 'axm.mirror.foundation-capability-native-artifact-inventory-declaration/v1';
const BATCH_SCHEMA = 'axm.mirror.foundation-capability-native-artifact-inventory-batch/v2';
const STATUS = 'TEST_DECLARATION_DRIVEN_PRIVATE_NATIVE_ARTIFACT_HASH_INVENTORY';
const ROOT = path.resolve(__dirname, '..');
const INVENTORY_SOURCE_PATH = 'organs/foundation-capability-native-artifact-inventory-organ.js';
const ENVELOPE_ADAPTER_SOURCE_PATH = 'organs/foundation-evidence-envelope-adapter-organ.js';
const TRANSPORT_SOURCE_PATH = 'kernel/key-safe-json-transport-cell.js';
const DEFAULT_CAPABILITY_DIR = path.join(ROOT, 'capabilities');
const DEFAULT_ADAPTER_REQUEST_STATE_DIR = OutputAdapterPlanner.DEFAULT_STATE_DIR;
const DEFAULT_STATE_DIR = path.join(ROOT, 'state', 'foundation-capability-native-artifact-inventory-runs');
const MAX_DECLARATION_BYTES = 64 * 1024;
const ALLOWED_ROOT_PREFIXES = Object.freeze(['state/', 'training/datasets/']);

function stable(value) { return LanguageModel.stable(value); }
function digest(value) {
  const encoded = typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value));
  return crypto.createHash('sha256').update(encoded === undefined ? 'undefined' : encoded).digest('hex');
}
function json(value) { return JSON.stringify(stable(value), null, 2) + '\n'; }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function sourceSha256(sourcePath, sourceBytes) {
  return digest(sourceBytes == null ? fs.readFileSync(path.join(ROOT, sourcePath)) : Buffer.from(sourceBytes));
}
function relative(root, file) { return path.relative(root, file).replace(/\\/g, '/'); }
function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !same(Object.keys(value).sort(), keys.slice().sort())) throw new Error(`${label} fields changed`);
}
function boundedChild(parent, child) {
  const resolvedParent = path.resolve(parent);
  const resolved = path.resolve(resolvedParent, child);
  if (path.dirname(resolved) !== resolvedParent) throw new Error(`foundation native-artifact inventory path escapes its parent: ${child}`);
  return resolved;
}
function cleanRelativeRoot(value) {
  const text = String(value || '').replace(/\\/g, '/');
  if (!text || path.isAbsolute(text) || text.startsWith('/') || text.includes('\0') || text.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('native-artifact inventory root path changed');
  if (!ALLOWED_ROOT_PREFIXES.some(prefix => text.startsWith(prefix))) throw new Error('native-artifact inventory root is outside private state or datasets');
  return text;
}

function loadPolicy(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const policyPath = path.resolve(options.policyPath || path.join(root, 'training', 'TRAINING_POLICY.json'));
  const policy = options.policy || JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  if (!policy || policy.schema !== 'axm.mirror.training-policy/v1') throw new Error('foundation native-artifact inventory requires the Mirror training policy');
  if (policy.automaticFoundationCapabilityNativeArtifactInventory !== true) throw new Error('automatic foundation native-artifact inventory is not enabled');
  if (policy.automaticRuntimePromotion !== false || policy.automaticCanonPromotion !== false || policy.automaticAuthorityGrowth !== false) throw new Error('foundation native-artifact inventory refuses runtime, canon, or authority growth');
  if (!String(policy.foundationCapabilityNativeArtifactInventoryScope || '').includes('declaration-driven-bounded-private-hash-and-schema-inventory')) throw new Error('foundation native-artifact inventory scope is incomplete');
  return policy;
}

function declarationIdentityBasis(declaration) {
  return Object.assign({}, declaration, { inventoryDeclarationId: null, inventoryDeclarationDigest: null });
}
function declarationDigestBasis(declaration) {
  return Object.assign({}, declaration, { inventoryDeclarationDigest: null });
}

function validateFileRule(rule) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error('native-artifact inventory file rule changed');
  if (rule.kind === 'EXACT_BASENAME') {
    exactKeys(rule, ['kind', 'name'], 'native-artifact exact file rule');
    if (!/^[a-zA-Z0-9._-]{1,160}$/.test(String(rule.name || '')) || rule.name === '.' || rule.name === '..') throw new Error('native-artifact exact basename changed');
    return true;
  }
  if (rule.kind === 'CONTENT_ADDRESSED_JSON_BASENAME') {
    exactKeys(rule, ['kind', 'prefix', 'hexLength', 'suffix'], 'native-artifact content-addressed file rule');
    if (!/^[a-zA-Z0-9._-]{1,120}$/.test(String(rule.prefix || '')) || !Number.isInteger(rule.hexLength) || rule.hexLength < 8 || rule.hexLength > 64 || rule.suffix !== '.json') throw new Error('native-artifact content-addressed basename changed');
    return true;
  }
  throw new Error('native-artifact inventory file rule kind changed');
}

function verifiedCapabilityMap(capabilityInventory) {
  const map = new Map();
  for (const record of capabilityInventory || []) {
    if (record.status !== 'VERIFIED_DECLARATION') continue;
    CapabilitySurvey.validateDeclaration(record.declaration);
    map.set(`${record.declaration.capabilityId}:${record.declaration.declarationDigest}`, record.declaration);
  }
  return map;
}

function validateInventoryDeclaration(declaration, capabilityInventory) {
  exactKeys(declaration, ['schema', 'inventoryDeclarationId', 'inventoryDeclarationDigest', 'source', 'search', 'preservation', 'authority', 'boundary'], 'native-artifact inventory declaration');
  if (declaration.schema !== DECLARATION_SCHEMA) throw new Error('native-artifact inventory declaration schema changed');
  const expectedId = `foundation-capability-native-artifact-inventory-${digest(declarationIdentityBasis(declaration)).slice(0, 24)}`;
  if (declaration.inventoryDeclarationId !== expectedId || declaration.inventoryDeclarationDigest !== digest(declarationDigestBasis(declaration))) throw new Error('native-artifact inventory declaration seal changed');
  exactKeys(declaration.source, ['capabilityId', 'capabilityDeclarationDigest', 'nativeOutputKind'], 'native-artifact inventory declaration source');
  if (!String(declaration.source.capabilityId || '').trim() || !/^[a-f0-9]{64}$/.test(String(declaration.source.capabilityDeclarationDigest || '')) || !String(declaration.source.nativeOutputKind || '').trim()) throw new Error('native-artifact inventory declaration source changed');
  if (capabilityInventory) {
    const capability = verifiedCapabilityMap(capabilityInventory).get(`${declaration.source.capabilityId}:${declaration.source.capabilityDeclarationDigest}`);
    if (!capability || !capability.outputKinds.includes(declaration.source.nativeOutputKind)) throw new Error('native-artifact inventory declaration has no exact verified capability output binding');
  }
  exactKeys(declaration.search, ['roots', 'fileRule', 'maximumDepth', 'maximumFiles', 'maximumFileBytes', 'requiredRootSchema'], 'native-artifact inventory search');
  if (!Array.isArray(declaration.search.roots) || !declaration.search.roots.length || declaration.search.roots.length > 8) throw new Error('native-artifact inventory roots changed');
  const roots = new Set();
  for (const root of declaration.search.roots) {
    exactKeys(root, ['path', 'availability', 'artifactClass'], 'native-artifact inventory root');
    const rootPath = cleanRelativeRoot(root.path);
    if (roots.has(rootPath)) throw new Error('native-artifact inventory repeats a root');
    roots.add(rootPath);
    if (!['REQUIRED', 'OPTIONAL'].includes(root.availability) || !['PRIVATE_PERMISSIONED_DATASET', 'PRIVATE_EVIDENCE_STATE'].includes(root.artifactClass)) throw new Error('native-artifact inventory root classification changed');
  }
  validateFileRule(declaration.search.fileRule);
  if (!Number.isInteger(declaration.search.maximumDepth) || declaration.search.maximumDepth < 0 || declaration.search.maximumDepth > 3) throw new Error('native-artifact inventory maximum depth changed');
  if (!Number.isInteger(declaration.search.maximumFiles) || declaration.search.maximumFiles < 1 || declaration.search.maximumFiles > 1024) throw new Error('native-artifact inventory maximum files changed');
  if (!Number.isInteger(declaration.search.maximumFileBytes) || declaration.search.maximumFileBytes < 1 || declaration.search.maximumFileBytes > EnvelopeAdapter.MAX_ARTIFACT_BYTES) throw new Error('native-artifact inventory maximum file bytes changed');
  if (declaration.search.requiredRootSchema !== declaration.source.nativeOutputKind) throw new Error('native-artifact inventory root schema and native output kind changed');
  if (!same(declaration.preservation, {
    contentExposure: 'HASH_AND_MACHINE_CLASSIFICATION_ONLY',
    permissionState: 'NOT_EVALUATED',
    evidenceEligibility: 'UNASSESSED',
    selectionState: 'ALL_MATCHES_UNSELECTED'
  })) throw new Error('native-artifact inventory preservation boundary changed');
  if (!declaration.authority || Object.values(declaration.authority).some(value => value !== false)) throw new Error('native-artifact inventory declaration authority changed');
  if (!String(declaration.boundary || '').trim()) throw new Error('native-artifact inventory declaration boundary missing');
  return true;
}

function collectInventoryDeclarations(options = {}, capabilityInventory) {
  const root = path.resolve(options.root || ROOT);
  const capabilityDir = path.resolve(options.capabilityDir || path.join(root, 'capabilities'));
  if (!fs.existsSync(capabilityDir)) return [];
  const dirStat = fs.lstatSync(capabilityDir);
  if (!dirStat.isDirectory() || dirStat.isSymbolicLink()) throw new Error('native-artifact inventory declaration directory must be a real directory');
  return fs.readdirSync(capabilityDir, { withFileTypes: true })
    .filter(entry => entry.name.endsWith('.artifact-inventory.json'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => {
      const file = boundedChild(capabilityDir, entry.name);
      const stat = fs.lstatSync(file);
      const record = { path: relative(root, file), bytes: stat.size, sha256: null, status: null, issue: null, declaration: null };
      try {
        if (!entry.isFile() || stat.isSymbolicLink() || stat.size > MAX_DECLARATION_BYTES) throw new Error('native-artifact inventory declaration file boundary changed');
        const bytes = fs.readFileSync(file);
        record.sha256 = digest(bytes);
        record.declaration = JSON.parse(bytes.toString('utf8'));
        validateInventoryDeclaration(record.declaration, capabilityInventory);
        record.status = 'VERIFIED_INVENTORY_DECLARATION';
      } catch (error) {
        record.status = 'REFUSED_INVENTORY_DECLARATION';
        record.issue = String(error && error.message || error).slice(0, 500);
      }
      return record;
    });
}

function matchesFileRule(name, rule) {
  if (rule.kind === 'EXACT_BASENAME') return name === rule.name;
  if (!name.startsWith(rule.prefix) || !name.endsWith(rule.suffix)) return false;
  const middle = name.slice(rule.prefix.length, name.length - rule.suffix.length);
  return middle.length === rule.hexLength && /^[a-f0-9]+$/.test(middle);
}

function enumerateRoot(absoluteRoot, relativeRoot, search, rootBase = ROOT) {
  const matched = [];
  const refusedEntries = [];
  function walk(directory, depth) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      const rel = relative(rootBase, absolute);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) {
        refusedEntries.push({ path: rel, state: 'REFUSED_SYMLINK_ENTRY' });
        continue;
      }
      if (stat.isDirectory()) {
        if (depth < search.maximumDepth) walk(absolute, depth + 1);
        continue;
      }
      if (!stat.isFile()) {
        refusedEntries.push({ path: rel, state: 'REFUSED_SPECIAL_FILE' });
        continue;
      }
      if (!matchesFileRule(entry.name, search.fileRule)) continue;
      if (matched.length <= search.maximumFiles) {
        const fileSha256 = stat.size <= search.maximumFileBytes ? digest(fs.readFileSync(absolute)) : null;
        matched.push({ absolute, path: rel, bytes: stat.size, fileSha256 });
      }
    }
  }
  walk(absoluteRoot, 0);
  const fingerprint = digest({ relativeRoot, matched: matched.map(item => ({ path: item.path, bytes: item.bytes, fileSha256: item.fileSha256 })), refusedEntries });
  return { matched, refusedEntries, fingerprint };
}

function envelopeBoundaryState(error) {
  const message = String(error && error.message || error);
  if (message.includes('hidden reasoning')) return 'REFUSED_HIDDEN_REASONING_KEY';
  if (message.includes('unsafe object key')) return 'REFUSED_UNSAFE_OBJECT_KEY';
  if (message.includes('bounded JSON structure')) return 'REFUSED_BOUNDED_JSON_STRUCTURE_LIMIT';
  if (message.includes('bounded JSON envelope')) return 'REFUSED_BOUNDED_JSON_SIZE_LIMIT';
  if (message.includes('plain JSON')) return 'REFUSED_NON_PLAIN_JSON';
  return 'REFUSED_GENERIC_ENVELOPE_INPUT_BOUNDARY';
}

function inspectMatchedFile(file, search) {
  const base = {
    path: file.path,
    bytes: file.bytes,
    fileSha256: file.fileSha256,
    rootSchema: null,
    artifactDigest: null,
    genericEnvelopeCompatibility: 'NOT_ASSESSED',
    genericEnvelopeBoundaryState: null,
    state: null
  };
  if (file.bytes > search.maximumFileBytes) return Object.assign(base, { state: 'REFUSED_FILE_SIZE_LIMIT' });
  let artifact;
  try {
    artifact = JSON.parse(fs.readFileSync(file.absolute, 'utf8'));
  } catch (error) {
    return Object.assign(base, { state: 'REFUSED_INVALID_JSON' });
  }
  base.rootSchema = artifact && !Array.isArray(artifact) && typeof artifact.schema === 'string' ? artifact.schema : null;
  try {
    EnvelopeAdapter.assertJsonArtifact(artifact);
    base.artifactDigest = digest(artifact);
    base.genericEnvelopeCompatibility = 'COMPATIBLE_NOT_EXECUTED';
  } catch (error) {
    base.genericEnvelopeCompatibility = 'REFUSED_NOT_EXECUTED';
    base.genericEnvelopeBoundaryState = envelopeBoundaryState(error);
  }
  if (base.rootSchema !== search.requiredRootSchema) return Object.assign(base, { state: 'REFUSED_ROOT_SCHEMA_MISMATCH' });
  return Object.assign(base, {
    state: base.genericEnvelopeCompatibility === 'COMPATIBLE_NOT_EXECUTED'
      ? 'NATIVE_ARTIFACT_ROOT_SCHEMA_AND_CONTENT_SEAL_WITNESS_NOT_PERMISSION_OR_EVIDENCE'
      : 'NATIVE_ARTIFACT_ROOT_SCHEMA_WITNESS_GENERIC_ENVELOPE_BOUNDARY_REFUSED',
    permissionState: 'NOT_EVALUATED',
    evidenceEligibility: 'UNASSESSED',
    artifactSelected: false
  });
}

function scanDeclaredRoot(rootDeclaration, search, options = {}) {
  const root = path.resolve(options.root || ROOT);
  const rootPath = cleanRelativeRoot(rootDeclaration.path);
  const absolute = path.resolve(root, rootPath);
  const rel = relative(root, absolute);
  if (rel !== rootPath || path.isAbsolute(rel) || rel === '..' || rel.startsWith('../')) throw new Error('native-artifact inventory resolved root escaped Mirror');
  const base = {
    path: rootPath,
    availability: rootDeclaration.availability,
    artifactClass: rootDeclaration.artifactClass,
    beforeDigest: null,
    afterDigest: null,
    unchanged: true,
    matchingFiles: 0,
    witnessFiles: 0,
    refusedFiles: 0,
    state: null
  };
  if (!fs.existsSync(absolute)) {
    base.state = rootDeclaration.availability === 'OPTIONAL' ? 'OPTIONAL_ROOT_ABSENT_HOLD' : 'REQUIRED_ROOT_ABSENT_HOLD';
    return { root: base, artifacts: [], refusals: [] };
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    base.state = 'REFUSED_ROOT_NOT_REAL_DIRECTORY';
    return { root: base, artifacts: [], refusals: [{ path: rootPath, state: 'REFUSED_ROOT_NOT_REAL_DIRECTORY' }] };
  }
  const before = enumerateRoot(absolute, rootPath, search, root);
  base.beforeDigest = before.fingerprint;
  base.matchingFiles = before.matched.length;
  if (before.matched.length > search.maximumFiles) {
    const afterLimit = enumerateRoot(absolute, rootPath, search, root);
    base.afterDigest = afterLimit.fingerprint;
    base.unchanged = base.beforeDigest === base.afterDigest;
    base.state = 'HOLD_MATCHING_FILE_LIMIT_EXCEEDED';
    base.refusedFiles = before.refusedEntries.length;
    return { root: base, artifacts: [], refusals: before.refusedEntries.concat([{ path: rootPath, state: 'HOLD_MATCHING_FILE_LIMIT_EXCEEDED' }]) };
  }
  const inspected = before.matched.map(file => inspectMatchedFile(file, search));
  const after = enumerateRoot(absolute, rootPath, search, root);
  base.afterDigest = after.fingerprint;
  base.unchanged = base.beforeDigest === base.afterDigest;
  if (!base.unchanged) {
    base.state = 'HOLD_SOURCE_CHANGED_DURING_SCAN';
    return { root: base, artifacts: [], refusals: [{ path: rootPath, state: 'HOLD_SOURCE_CHANGED_DURING_SCAN' }] };
  }
  const artifacts = inspected.filter(item => item.state === 'NATIVE_ARTIFACT_ROOT_SCHEMA_AND_CONTENT_SEAL_WITNESS_NOT_PERMISSION_OR_EVIDENCE' || item.state === 'NATIVE_ARTIFACT_ROOT_SCHEMA_WITNESS_GENERIC_ENVELOPE_BOUNDARY_REFUSED');
  const refusals = before.refusedEntries.concat(inspected.filter(item => !artifacts.includes(item)));
  base.witnessFiles = artifacts.length;
  base.refusedFiles = refusals.length;
  base.state = artifacts.length ? 'NATIVE_ARTIFACT_ROOT_SCHEMA_WITNESSES_INVENTORIED_UNSELECTED'
    : before.matched.length ? 'HOLD_MATCHING_FILES_REFUSED'
      : 'HOLD_NO_MATCHING_NATIVE_ARTIFACT_FILES';
  return { root: base, artifacts, refusals };
}

function heldResult(request, nativeOutputKind, state) {
  const result = {
    resultId: null,
    adapterRequestId: request.adapterRequestId,
    adapterRequestDigest: request.adapterRequestDigest,
    capabilityId: request.source.capabilityId,
    capabilityDeclarationDigest: request.source.declarationDigest,
    nativeOutputKind,
    inventoryDeclarationId: null,
    inventoryDeclarationDigest: null,
    roots: [],
    artifacts: [],
    refusals: [],
    state,
    permissionState: 'NOT_EVALUATED',
    evidenceEligibility: 'UNASSESSED',
    artifactSelected: false,
    operationalFit: 'UNTESTED',
    newOrganNeed: 'UNASSESSED'
  };
  result.resultId = `foundation-native-artifact-inventory-result-${digest(Object.assign({}, result, { resultId: null })).slice(0, 24)}`;
  return result;
}

function inspectRequestKind(request, nativeOutputKind, records, options = {}) {
  const exact = records.filter(record => record.status === 'VERIFIED_INVENTORY_DECLARATION' && record.declaration.source.capabilityId === request.source.capabilityId && record.declaration.source.capabilityDeclarationDigest === request.source.declarationDigest && record.declaration.source.nativeOutputKind === nativeOutputKind);
  if (!exact.length) return heldResult(request, nativeOutputKind, 'HOLD_NO_EXACT_NATIVE_ARTIFACT_INVENTORY_DECLARATION');
  if (exact.length > 1) return heldResult(request, nativeOutputKind, 'HOLD_AMBIGUOUS_NATIVE_ARTIFACT_INVENTORY_DECLARATIONS');
  const declaration = exact[0].declaration;
  const scans = declaration.search.roots.slice().sort((a, b) => a.path.localeCompare(b.path)).map(root => scanDeclaredRoot(root, declaration.search, options));
  const artifacts = scans.flatMap(scan => scan.artifacts).sort((a, b) => a.path.localeCompare(b.path));
  const refusals = scans.flatMap(scan => scan.refusals).sort((a, b) => a.path.localeCompare(b.path));
  const roots = scans.map(scan => scan.root);
  const anyRequiredAbsent = roots.some(root => root.state === 'REQUIRED_ROOT_ABSENT_HOLD');
  const result = {
    resultId: null,
    adapterRequestId: request.adapterRequestId,
    adapterRequestDigest: request.adapterRequestDigest,
    capabilityId: request.source.capabilityId,
    capabilityDeclarationDigest: request.source.declarationDigest,
    nativeOutputKind,
    inventoryDeclarationId: declaration.inventoryDeclarationId,
    inventoryDeclarationDigest: declaration.inventoryDeclarationDigest,
    roots,
    artifacts,
    refusals,
    state: artifacts.length ? 'NATIVE_ARTIFACT_ROOT_SCHEMA_WITNESSES_FOUND_NOT_PERMISSION_OR_EVIDENCE_ELIGIBILITY'
      : anyRequiredAbsent ? 'HOLD_REQUIRED_NATIVE_ARTIFACT_ROOT_ABSENT'
        : roots.some(root => root.state === 'OPTIONAL_ROOT_ABSENT_HOLD') ? 'HOLD_OPTIONAL_NATIVE_ARTIFACT_ROOT_ABSENT'
          : 'HOLD_NO_NATIVE_ARTIFACT_ROOT_SCHEMA_WITNESSES',
    permissionState: 'NOT_EVALUATED',
    evidenceEligibility: 'UNASSESSED',
    artifactSelected: false,
    operationalFit: 'UNTESTED',
    newOrganNeed: 'UNASSESSED'
  };
  result.resultId = `foundation-native-artifact-inventory-result-${digest(Object.assign({}, result, { resultId: null })).slice(0, 24)}`;
  return result;
}

function expectedSummary(results, declarationInventory) {
  const roots = results.flatMap(result => result.roots || []);
  return {
    adapterRequestOutputKindsExamined: results.length,
    inventoryDeclarationsRead: (declarationInventory || []).length,
    verifiedInventoryDeclarations: (declarationInventory || []).filter(item => item.status === 'VERIFIED_INVENTORY_DECLARATION').length,
    refusedInventoryDeclarations: (declarationInventory || []).filter(item => item.status === 'REFUSED_INVENTORY_DECLARATION').length,
    rootsDeclared: roots.length,
    optionalRootsAbsent: roots.filter(item => item.state === 'OPTIONAL_ROOT_ABSENT_HOLD').length,
    requiredRootsAbsent: roots.filter(item => item.state === 'REQUIRED_ROOT_ABSENT_HOLD').length,
    matchingArtifactFiles: roots.reduce((sum, item) => sum + item.matchingFiles, 0),
    nativeArtifactRootSchemaWitnesses: results.reduce((sum, item) => sum + (item.artifacts || []).length, 0),
    genericEnvelopeCompatibleWitnesses: results.reduce((sum, item) => sum + (item.artifacts || []).filter(artifact => artifact.genericEnvelopeCompatibility === 'COMPATIBLE_NOT_EXECUTED').length, 0),
    genericEnvelopeBoundaryRefusals: results.reduce((sum, item) => sum + (item.artifacts || []).filter(artifact => artifact.genericEnvelopeCompatibility === 'REFUSED_NOT_EXECUTED').length, 0),
    refusedArtifactFiles: results.reduce((sum, item) => sum + (item.refusals || []).length, 0),
    sourceChangesDuringScan: roots.filter(item => item.unchanged === false).length,
    artifactSelections: 0,
    permissionEvaluations: 0,
    evidenceEligibilityEvaluations: 0,
    adapterExecutions: 0,
    nativeSourceExecutions: 0,
    evidenceAdmissions: 0,
    evidenceRelabelings: 0,
    capabilitiesSelected: 0,
    operationalFitsClaimed: 0,
    newOrgansRequired: 0,
    trainingAdmissions: 0,
    permissionGrants: 0,
    promotions: 0,
    worldActions: 0
  };
}

function buildBatch(adapterRequestBatch, capabilityInventory, declarationInventory, options = {}) {
  OutputAdapterPlanner.verifyBatch(adapterRequestBatch);
  verifiedCapabilityMap(capabilityInventory);
  for (const record of declarationInventory || []) if (record.status === 'VERIFIED_INVENTORY_DECLARATION') validateInventoryDeclaration(record.declaration, capabilityInventory);
  const capabilityInventoryDigest = digest((capabilityInventory || []).map(item => ({ path: item.path, sha256: item.sha256, status: item.status })).sort((a, b) => a.path.localeCompare(b.path)));
  const inventoryDeclarationDigest = digest((declarationInventory || []).map(item => ({ path: item.path, sha256: item.sha256, status: item.status })).sort((a, b) => a.path.localeCompare(b.path)));
  const results = [];
  for (const request of (adapterRequestBatch.requests || []).slice().sort((a, b) => a.adapterRequestId.localeCompare(b.adapterRequestId))) {
    for (const nativeOutputKind of request.adapterContract.inputKinds.slice().sort()) results.push(inspectRequestKind(request, nativeOutputKind, declarationInventory || [], options));
  }
  results.sort((a, b) => a.resultId.localeCompare(b.resultId));
  const source = {
    adapterRequestBatchId: adapterRequestBatch.batchId,
    adapterRequestBatchDigest: adapterRequestBatch.batchDigest,
    capabilityInventoryDigest,
    inventoryDeclarationDigest,
    inventoryOrganSourcePath: INVENTORY_SOURCE_PATH,
    inventoryOrganSourceSha256: sourceSha256(INVENTORY_SOURCE_PATH, options.inventoryOrganSourceBytes),
    envelopeAdapterSourcePath: ENVELOPE_ADAPTER_SOURCE_PATH,
    envelopeAdapterSourceSha256: sourceSha256(ENVELOPE_ADAPTER_SOURCE_PATH, options.envelopeAdapterSourceBytes),
    transportSourcePath: TRANSPORT_SOURCE_PATH,
    transportSourceSha256: sourceSha256(TRANSPORT_SOURCE_PATH, options.transportSourceBytes)
  };
  const batch = {
    schema: BATCH_SCHEMA,
    batchId: `foundation-capability-native-artifacts-${digest({ organId: ORGAN_ID, source, results }).slice(0, 24)}`,
    batchDigest: null,
    organ: {
      id: ORGAN_ID,
      status: STATUS,
      learnedWeights: false,
      capabilitySpecificRouting: false,
      nativeSourceExecution: false,
      artifactSelection: false
    },
    source,
    declarationInventory: (declarationInventory || []).slice().sort((a, b) => a.path.localeCompare(b.path)).map(record => ({
      path: record.path,
      bytes: record.bytes,
      sha256: record.sha256,
      status: record.status,
      issue: record.issue,
      inventoryDeclarationId: record.declaration && record.declaration.inventoryDeclarationId || null,
      inventoryDeclarationDigest: record.declaration && record.declaration.inventoryDeclarationDigest || null
    })),
    results,
    summary: expectedSummary(results, declarationInventory),
    state: results.some(result => result.artifacts.length) ? 'NATIVE_ARTIFACT_ROOT_SCHEMA_WITNESSES_INVENTORIED_NO_SELECTION'
      : results.length ? 'HOLD_NO_NATIVE_ARTIFACT_ROOT_SCHEMA_WITNESSES'
        : 'NO_ADAPTER_REQUEST_OUTPUT_KINDS_TO_INVENTORY',
    authority: {
      privateEvidenceTraceWrite: true,
      privateArtifactRead: true,
      artifactContentPersistence: false,
      artifactSelection: false,
      permissionInference: false,
      evidenceEligibilityClaim: false,
      adapterExecution: false,
      nativeSourceExecution: false,
      evidenceAdmission: false,
      evidenceRelabeling: false,
      capabilitySelection: false,
      operationalFitClaim: false,
      newOrganNeedClaim: false,
      trainingAdmission: false,
      permissionGrant: false,
      runtimePromotion: false,
      canonChange: false,
      worldAction: false
    },
    boundary: 'This declaration-driven organ may read bounded private state or dataset JSON and persist only paths, hashes, root schemas, refusal classes, and source-stability seals in ignored private evidence state. Artifact presence is not permission, requested evidence eligibility, selection, adapter execution, native source execution, operational fit, organ need, evidence admission, training, promotion, canon, or action.'
  };
  batch.batchDigest = digest(Object.assign({}, batch, { batchDigest: null }));
  return batch;
}

function verifyBatch(batch, adapterRequestBatch, capabilityInventory, declarationInventory, runDir, options = {}) {
  if (!batch || batch.schema !== BATCH_SCHEMA || batch.batchDigest !== digest(Object.assign({}, batch, { batchDigest: null }))) throw new Error('foundation native-artifact inventory batch digest changed');
  const expectedId = `foundation-capability-native-artifacts-${digest({ organId: ORGAN_ID, source: batch.source, results: batch.results }).slice(0, 24)}`;
  if (batch.batchId !== expectedId) throw new Error('foundation native-artifact inventory batch id changed');
  if (!batch.organ || batch.organ.id !== ORGAN_ID || batch.organ.status !== STATUS || batch.organ.learnedWeights !== false || batch.organ.capabilitySpecificRouting !== false || batch.organ.nativeSourceExecution !== false || batch.organ.artifactSelection !== false) throw new Error('foundation native-artifact inventory organ boundary changed');
  if (!batch.source || batch.source.inventoryOrganSourcePath !== INVENTORY_SOURCE_PATH || batch.source.envelopeAdapterSourcePath !== ENVELOPE_ADAPTER_SOURCE_PATH || batch.source.transportSourcePath !== TRANSPORT_SOURCE_PATH) throw new Error('foundation native-artifact inventory source path binding changed');
  if ([batch.source.inventoryOrganSourceSha256, batch.source.envelopeAdapterSourceSha256, batch.source.transportSourceSha256].some(value => !/^[a-f0-9]{64}$/.test(String(value || '')))) throw new Error('foundation native-artifact inventory source hash binding changed');
  if (!same(batch.summary, expectedSummary(batch.results || [], batch.declarationInventory || []))) throw new Error('foundation native-artifact inventory summary changed');
  for (const result of batch.results || []) {
    const expectedResultId = `foundation-native-artifact-inventory-result-${digest(Object.assign({}, result, { resultId: null })).slice(0, 24)}`;
    if (result.resultId !== expectedResultId || result.permissionState !== 'NOT_EVALUATED' || result.evidenceEligibility !== 'UNASSESSED' || result.artifactSelected !== false || result.operationalFit !== 'UNTESTED' || result.newOrganNeed !== 'UNASSESSED') throw new Error('foundation native-artifact inventory result boundary changed');
    if ((result.artifacts || []).some(item => item.permissionState !== 'NOT_EVALUATED' || item.evidenceEligibility !== 'UNASSESSED' || item.artifactSelected !== false || Object.prototype.hasOwnProperty.call(item, 'artifact'))) throw new Error('foundation native-artifact inventory artifact exposure changed');
  }
  const allowedTrue = new Set(['privateEvidenceTraceWrite', 'privateArtifactRead']);
  if (!batch.authority || Object.entries(batch.authority).some(([key, value]) => allowedTrue.has(key) ? value !== true : value !== false)) throw new Error('foundation native-artifact inventory authority changed');
  if (batch.summary.artifactSelections !== 0 || batch.summary.permissionEvaluations !== 0 || batch.summary.evidenceEligibilityEvaluations !== 0 || batch.summary.adapterExecutions !== 0 || batch.summary.nativeSourceExecutions !== 0 || batch.summary.evidenceAdmissions !== 0 || batch.summary.operationalFitsClaimed !== 0) throw new Error('foundation native-artifact inventory evidence ceiling changed');
  if (adapterRequestBatch && capabilityInventory && declarationInventory && !same(buildBatch(adapterRequestBatch, capabilityInventory, declarationInventory, options), batch)) throw new Error('foundation native-artifact inventory batch content changed');
  if (runDir) {
    const disk = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    if (!same(disk, batch)) throw new Error('foundation native-artifact inventory batch file changed');
  }
  return true;
}

function loadCurrentAdapterRequestBatch(options = {}) {
  if (options.adapterRequestBatch) {
    OutputAdapterPlanner.verifyBatch(options.adapterRequestBatch);
    return options.adapterRequestBatch;
  }
  const root = path.resolve(options.root || ROOT);
  const status = JSON.parse(fs.readFileSync(path.resolve(options.statusPath || path.join(root, 'STATUS.json')), 'utf8'));
  const batchId = (status.foundationDevelopmentCapabilityOutputAdapterPlannerEvidence || {}).currentBatchId;
  if (!/^foundation-capability-output-adapters-[a-f0-9]{24}$/.test(String(batchId || ''))) throw new Error('foundation native-artifact inventory current adapter request batch id is missing');
  const runDir = boundedChild(path.resolve(options.adapterRequestStateDir || DEFAULT_ADAPTER_REQUEST_STATE_DIR), batchId);
  const batch = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
  OutputAdapterPlanner.verifyBatch(batch, null, null, runDir);
  return batch;
}

function run(options = {}) {
  loadPolicy(options);
  const root = path.resolve(options.root || ROOT);
  const adapterRequestBatch = loadCurrentAdapterRequestBatch(options);
  const capabilityInventory = options.capabilityInventory || CapabilitySurvey.collectInventory(Object.assign({}, options, { capabilityDir: options.capabilityDir || path.join(root, 'capabilities') }));
  const declarationInventory = options.declarationInventory || collectInventoryDeclarations(options, capabilityInventory);
  const batch = buildBatch(adapterRequestBatch, capabilityInventory, declarationInventory, options);
  const stateDir = path.resolve(options.stateDir || path.join(root, 'state', 'foundation-capability-native-artifact-inventory-runs'));
  fs.mkdirSync(stateDir, { recursive: true });
  const runDir = path.join(stateDir, batch.batchId);
  if (fs.existsSync(runDir)) {
    const existing = JSON.parse(fs.readFileSync(path.join(runDir, 'batch.json'), 'utf8'));
    verifyBatch(existing, adapterRequestBatch, capabilityInventory, declarationInventory, runDir, options);
    if (existing.batchDigest !== batch.batchDigest) throw new Error('foundation native-artifact inventory batch identity collision');
    return { batch: existing, runDir, reused: true };
  }
  const stageDir = path.join(stateDir, `.stage-${batch.batchId}-${process.pid}`);
  if (fs.existsSync(stageDir)) throw new Error(`foundation native-artifact inventory staging directory already exists: ${stageDir}`);
  fs.mkdirSync(stageDir, { recursive: true });
  fs.writeFileSync(path.join(stageDir, 'batch.json'), json(batch), { flag: 'wx' });
  verifyBatch(batch, adapterRequestBatch, capabilityInventory, declarationInventory, stageDir, options);
  const commit = ImmutableBatchStore.commitDirectory(stageDir, runDir);
  return { batch, runDir, reused: commit.reused };
}

module.exports = {
  ORGAN_ID, DECLARATION_SCHEMA, BATCH_SCHEMA, STATUS, INVENTORY_SOURCE_PATH, ENVELOPE_ADAPTER_SOURCE_PATH, TRANSPORT_SOURCE_PATH, DEFAULT_CAPABILITY_DIR, DEFAULT_ADAPTER_REQUEST_STATE_DIR, DEFAULT_STATE_DIR,
  MAX_DECLARATION_BYTES, ALLOWED_ROOT_PREFIXES, stable, digest, sourceSha256, loadPolicy, validateFileRule, verifiedCapabilityMap,
  validateInventoryDeclaration, collectInventoryDeclarations, matchesFileRule, enumerateRoot, envelopeBoundaryState, inspectMatchedFile,
  scanDeclaredRoot, heldResult, inspectRequestKind, expectedSummary, buildBatch, verifyBatch,
  loadCurrentAdapterRequestBatch, run
};
