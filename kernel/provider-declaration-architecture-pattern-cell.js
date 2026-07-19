'use strict';

const crypto = require('crypto');

const CELL_ID = 'axm.mirror.cell/provider-declaration-architecture-pattern-v1';
const SCHEMA = 'axm.mirror.provider-declaration-architecture-pattern-assessment/v1';
const HYPOTHESES = Object.freeze({
  REUSE_TYPED_SHARED_SERVICE_DECLARATION: 'SHARED_SERVICE_DECLARATION_PATTERN',
  EXTEND_TYPED_ENGINE_OR_REGISTRY_DECLARATION: null,
  NEW_TYPED_PROVIDER_DECLARATION: null
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((output, key) => { output[key] = stable(value[key]); return output; }, {});
}
function digest(value) { return crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(stable(value))).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function clean(value, maximum = 500) { return String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').trim().slice(0, maximum); }
function array(value) { return Array.isArray(value) ? value : []; }
function unique(values) { return Array.from(new Set(values.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))).sort(); }

function schemaId(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return null;
  if (typeof document.schema === 'string' && document.schema) return document.schema;
  if (typeof document.schema_version === 'string' && document.schema_version) return document.schema_version;
  if (typeof document.$id === 'string' && document.$id) return document.$id;
  return null;
}

function classify(document) {
  const schema = schemaId(document);
  if (schema === 'axm.shared-service-contract/v1') return { classification: 'SHARED_SERVICE_DECLARATION_PATTERN', hypothesisId: 'REUSE_TYPED_SHARED_SERVICE_DECLARATION' };
  if (schema === 'axm.shared-engine-contract/v1' && Array.isArray(document.engines)) return { classification: 'ENGINE_REGISTRY_DECLARATION_PATTERN', hypothesisId: 'EXTEND_TYPED_ENGINE_OR_REGISTRY_DECLARATION' };
  if (schema === 'axm.foundation-service-plane/v1' && Array.isArray(document.services)) return { classification: 'FOUNDATION_SERVICE_PLANE_PATTERN', hypothesisId: 'EXTEND_TYPED_ENGINE_OR_REGISTRY_DECLARATION' };
  if (schema === 'axm.foundation-service-integration/v1') return { classification: 'TYPED_SERVICE_INTEGRATION_PATTERN', hypothesisId: 'NEW_TYPED_PROVIDER_DECLARATION' };
  if (typeof document.$schema === 'string' && typeof document.$id === 'string' && /(provider|service|foundation|contract)/i.test(document.$id)) return { classification: 'JSON_SCHEMA_DECLARATION_PATTERN', hypothesisId: 'NEW_TYPED_PROVIDER_DECLARATION' };
  if (schema) return { classification: 'UNRELATED_TYPED_DOCUMENT', hypothesisId: null };
  return { classification: 'UNTYPED_DOCUMENT', hypothesisId: null };
}

function schemaConst(document, keys) {
  for (const key of keys) {
    const property = document && document.properties && document.properties[key];
    if (property && typeof property.const === 'string') return property.const;
  }
  return null;
}

function identities(document, classification) {
  if (!document || typeof document !== 'object') return [];
  if (classification === 'ENGINE_REGISTRY_DECLARATION_PATTERN') return unique(array(document.engines).map(item => item && item.id));
  if (classification === 'FOUNDATION_SERVICE_PLANE_PATTERN') return unique(array(document.services).map(item => typeof item === 'string' ? item : item && item.id));
  if (classification === 'JSON_SCHEMA_DECLARATION_PATTERN') return unique([schemaConst(document, ['id', 'service_id', 'module_id', 'providerIdentity'])]);
  return unique([document.id, document.service_id, document.module_id, document.providerIdentity]);
}

function matchedMembers(document, classification, requirementId) {
  if (classification === 'ENGINE_REGISTRY_DECLARATION_PATTERN') return array(document.engines).filter(item => item && item.id === requirementId);
  if (classification === 'FOUNDATION_SERVICE_PLANE_PATTERN') return array(document.services).filter(item => (typeof item === 'string' ? item : item && item.id) === requirementId).map(item => typeof item === 'string' ? { id: item } : item);
  return [];
}

function selectorValues(document, classification, requirementId) {
  const members = matchedMembers(document, classification, requirementId);
  const sources = members.length ? members : [document];
  const values = [];
  for (const source of sources) {
    values.push(...array(source && source.provides), ...array(source && source.capabilities), ...array(source && source.selectors), ...array(source && source.apis));
    if (source && typeof source.api === 'string') values.push(source.api);
  }
  return unique(values);
}

function explicitImplementation(document) {
  const implementation = document && document.implementation && typeof document.implementation === 'object' ? document.implementation : {};
  return {
    path: clean(implementation.path || document && document.implementationPath, 300) || null,
    sha256: clean(implementation.sha256 || document && document.implementationSha256, 64).toLowerCase() || null
  };
}

function slotFacts(document, classification, requirementId, demandedSelectors) {
  const ids = identities(document, classification);
  const identityMatches = ids.filter(id => id === requirementId).length;
  const selectors = selectorValues(document, classification, requirementId);
  const implementation = explicitImplementation(document);
  const permissions = unique(array(document && document.permissions));
  const boundaryDeclared = !!(document && ((document.boundaries && typeof document.boundaries === 'object') || (document.authority && typeof document.authority === 'object')));
  const registry = ['ENGINE_REGISTRY_DECLARATION_PATTERN', 'FOUNDATION_SERVICE_PLANE_PATTERN'].includes(classification);
  const fieldSlots = {
    schemaVersion: !!(schemaId(document) && (document.version || document.schema_version || document.$id)),
    requirementIdentity: ids.length > 0,
    selectorSet: selectors.length > 0 || array(document && document.provides).length > 0 || array(document && document.capabilities).length > 0,
    implementationPath: !!implementation.path,
    implementationContentDigest: !!implementation.sha256,
    permissionDeclaration: Array.isArray(document && document.permissions),
    boundaryDeclaration: boundaryDeclared,
    registryMembership: registry
  };
  const exactRequirement = identityMatches === 1;
  const selectorCoverage = exactRequirement && demandedSelectors.every(selector => selectors.includes(selector));
  const currentRelations = {
    EXACT_SCHEMA: !!schemaId(document),
    OUTER_REQUIREMENT_BINDING: exactRequirement,
    PROVIDER_IDENTITY_BINDING: exactRequirement,
    SELECTOR_COVERAGE: selectorCoverage,
    IMPLEMENTATION_CONTENT_BINDING: exactRequirement && !!implementation.path && /^[a-f0-9]{64}$/.test(implementation.sha256 || ''),
    PERMISSION_DECLARATION: exactRequirement && permissions.length > 0,
    UNIQUE_REGISTRY_MEMBERSHIP: registry && identityMatches === 1,
    AMBIGUITY_REFUSAL: false,
    SCHEMA_VERSION: exactRequirement && fieldSlots.schemaVersion,
    BOUNDARY_AND_PERMISSION_DECLARATIONS: exactRequirement && boundaryDeclared && permissions.length > 0,
    ALL_CANDIDATE_ARCHITECTURES_FAIL_ONE_OR_MORE_REQUIRED_RELATIONS: false,
    UNKNOWN_PRESERVED_WITHOUT_PROVIDER_INFERENCE: true
  };
  return { ids, identityMatches, selectors, implementation, permissions, fieldSlots, currentRelations };
}

function closedAuthority() {
  return {
    providerIdentityInference: false,
    crossDocumentRelationMerge: false,
    architectureSelection: false,
    architectureEvaluation: false,
    providerCandidateBuild: false,
    providerContractWrite: false,
    declarationWrite: false,
    workshopWrite: false,
    readinessClaim: false,
    availabilityClaim: false,
    install: false,
    automaticStart: false,
    automaticRepair: false,
    permissionGrant: false,
    liveExecution: false,
    trainingAdmission: false,
    toolUse: false,
    networkUse: false,
    worldAction: false,
    semanticTruthWrite: false,
    runtimePromotion: false,
    canonChange: false,
    identityChange: false
  };
}

function evaluate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('provider declaration architecture pattern input is required');
  const allowed = ['relativePath', 'content', 'contentSha256', 'symbolic', 'insideRoot', 'requirementId', 'demandedSelectors', 'hypothesisRequirements'];
  const unexpected = Object.keys(input).filter(key => !allowed.includes(key));
  if (unexpected.length) throw new Error(`unknown critical provider declaration architecture pattern fields: ${unexpected.join(', ')}`);
  const relativePath = clean(input.relativePath, 500).replace(/\\/g, '/');
  const requirementId = clean(input.requirementId, 300);
  const demandedSelectors = unique(array(input.demandedSelectors));
  if (!relativePath || !requirementId) throw new Error('architecture pattern input requires relativePath and requirementId');
  const bytes = Buffer.isBuffer(input.content) ? input.content : Buffer.from(String(input.content == null ? '' : input.content), 'utf8');
  const contentSha256 = clean(input.contentSha256 || digest(bytes), 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(contentSha256) || digest(bytes) !== contentSha256) throw new Error('architecture pattern content digest mismatch');
  let document = null;
  let parseError = null;
  let classification;
  let hypothesisId = null;
  if (input.symbolic === true || input.insideRoot !== true) {
    classification = 'BOUNDARY_REFUSED_DOCUMENT';
  } else {
    try { document = JSON.parse(bytes.toString('utf8')); } catch (error) { parseError = clean(error.message, 300); }
    if (parseError || !document || typeof document !== 'object' || Array.isArray(document)) classification = 'MALFORMED_DOCUMENT';
    else ({ classification, hypothesisId } = classify(document));
  }
  const relevant = !!hypothesisId;
  const suppliedRequirements = input.hypothesisRequirements && typeof input.hypothesisRequirements === 'object' && !Array.isArray(input.hypothesisRequirements) ? input.hypothesisRequirements : {};
  const mustDemonstrate = relevant ? unique(array(suppliedRequirements[hypothesisId])) : [];
  const facts = relevant ? slotFacts(document, classification, requirementId, demandedSelectors) : {
    ids: [], identityMatches: 0, selectors: [], implementation: { path: null, sha256: null }, permissions: [],
    fieldSlots: { schemaVersion: false, requirementIdentity: false, selectorSet: false, implementationPath: false, implementationContentDigest: false, permissionDeclaration: false, boundaryDeclaration: false, registryMembership: false },
    currentRelations: {}
  };
  const demonstrated = mustDemonstrate.filter(relation => facts.currentRelations[relation] === true);
  const missing = mustDemonstrate.filter(relation => facts.currentRelations[relation] !== true);
  const completeCurrentRelationWitness = relevant && mustDemonstrate.length > 0 && missing.length === 0;
  let state = 'NOT_A_PROVIDER_DECLARATION_ARCHITECTURE_PATTERN';
  if (classification === 'BOUNDARY_REFUSED_DOCUMENT' || classification === 'MALFORMED_DOCUMENT') state = 'DOCUMENT_REFUSED';
  else if (completeCurrentRelationWitness) state = 'COMPLETE_CURRENT_RELATION_WITNESS_NOT_ARCHITECTURE_EVALUATED';
  else if (relevant && facts.identityMatches > 0) state = 'PARTIAL_CURRENT_RELATION_WITNESS';
  else if (relevant) state = 'RELEVANT_PATTERN_NO_CURRENT_REQUIREMENT_WITNESS';
  const assessment = {
    schema: SCHEMA,
    cellId: CELL_ID,
    assessmentDigest: null,
    document: {
      relativePath,
      sha256: contentSha256,
      bytes: bytes.length,
      schemaId: document ? schemaId(document) : null,
      parseError,
      insideRoot: input.insideRoot === true,
      symbolic: input.symbolic === true
    },
    classification,
    hypothesisId,
    slots: {
      representable: clone(facts.fieldSlots),
      witnessedProviderIdentities: clone(facts.ids),
      exactRequirementIdentityMatches: facts.identityMatches,
      witnessedSelectors: clone(facts.selectors),
      explicitImplementationPath: facts.implementation.path,
      explicitImplementationSha256: facts.implementation.sha256,
      declaredPermissions: clone(facts.permissions)
    },
    currentRelations: clone(facts.currentRelations),
    mustDemonstrate,
    demonstrated,
    missing,
    completeCurrentRelationWitness,
    state,
    authority: closedAuthority(),
    boundary: 'One document is assessed independently. Fields from different documents are never merged into a provider, a matching slot is not provider fitness, and the assessment cannot select or evaluate architecture, write a declaration, build, run, train, grant, or promote.'
  };
  assessment.assessmentDigest = digest(Object.assign({}, assessment, { assessmentDigest: null }));
  return assessment;
}

function verify(assessment, input) {
  const expected = evaluate(input);
  if (!assessment || assessment.assessmentDigest !== expected.assessmentDigest || JSON.stringify(stable(assessment)) !== JSON.stringify(stable(expected))) throw new Error('provider declaration architecture pattern assessment mismatch');
  return true;
}

module.exports = { CELL_ID, SCHEMA, HYPOTHESES, digest, schemaId, classify, identities, slotFacts, evaluate, verify };
