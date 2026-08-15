'use strict';

const fs = require('fs');
const path = require('path');
const ImmutableStore = require('../kernel/immutable-batch-store');
const Components = require('../modules/ai-organ-archive/core/dormant-organ-component-protocol');

const ORGAN_ID = 'axm.mirror.organ/specialist-mirror-structural-exam-v2';
const EXAM_SCHEMA = 'axm.mirror.specialist-mirror-structural-exam/v2';
const SETTINGS_SCHEMA = 'axm.mirror.specialist-mirror-settings/v1';
const GENERATION_SCHEMA = 'axm.mirror.specialist-mirror-composition-generation/v2';
const COMPOSITION_ALGORITHM = 'axm.mirror.specialist-composition-algorithm/v2';
const ROOT = path.resolve(__dirname, '..');
const REQUIRED_LIMITS = Object.freeze([
  'NO_WRITE_TO_MIRROR_SOURCE',
  'NO_READ_OF_MIRROR_PRIVATE_STATE',
  'NO_RUNTIME_OR_STARTUP_AUTHORITY',
  'NO_PERMISSION_OR_CANON_CHANGE',
  'NO_AUTOMATIC_RETURN_PATH_TO_MIRROR',
  'NO_SELF_CERTIFICATION',
  'FAILED_GENERATIONS_REMAIN_EVIDENCE'
]);
const SOURCE_PATHS = Object.freeze([
  'organs/specialist-mirror-structural-exam-organ.js',
  'modules/ai-organ-archive/core/dormant-organ-component-protocol.js',
  'modules/ai-organ-archive/core/specialist-mirror-incubator.js',
  'modules/ai-organ-archive/contracts/specialist-mirror-generation-v2.schema.json',
  'contracts/specialist-mirror-structural-exam-v2.schema.json'
]);
const CLONE_BOUNDARY = Object.freeze({
  parentMirrorSourceChanged: false,
  parentMirrorStateRead: false,
  parentMirrorRuntimeChanged: false,
  archivedOrgansLoadedOrExecuted: false,
  candidateBodyAssembled: false,
  automaticReturnPathToMirror: false
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function json(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function digest(value) { return Components.digest(stable(value)); }
function same(left, right) { return JSON.stringify(stable(left)) === JSON.stringify(stable(right)); }
function sha256Bytes(bytes) { return require('crypto').createHash('sha256').update(bytes).digest('hex'); }
function unique(values) { return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right)); }
function finding(code, detail) { return { code, detail: String(detail || '').slice(0, 500) }; }

function examAuthority() {
  return {
    readArchivedMetadata: true,
    writePrivateExamEvidence: true,
    loadOrgan: false,
    executeOrgan: false,
    connectOrgan: false,
    assembleCandidate: false,
    admitOrgan: false,
    installOrgan: false,
    startOrgan: false,
    grantPermission: false,
    promoteRuntime: false,
    writeParentMirror: false,
    changeCanon: false,
    worldAction: false
  };
}

function sourceLineage(root = ROOT) {
  return SOURCE_PATHS.map(sourcePath => {
    const bytes = fs.readFileSync(path.join(root, sourcePath));
    return { path: sourcePath, bytes: bytes.length, sha256: sha256Bytes(bytes) };
  });
}

function validateSettings(settings) {
  if (!settings || settings.schema !== SETTINGS_SCHEMA) throw new Error('specialist structural exam requires v1 settings');
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(settings.specialistId || '')) throw new Error('specialist structural exam settings identity is invalid');
  if (!settings.composition || !Number.isInteger(settings.composition.maxOrgansPerCandidate) || settings.composition.maxOrgansPerCandidate < 1 || settings.composition.maxOrgansPerCandidate > 64) throw new Error('specialist structural exam component cap is invalid');
  if (!Array.isArray(settings.composition.requiredOrganSourcePaths) || settings.composition.requiredOrganSourcePaths.some(value => !/^organs\/[a-z0-9][a-z0-9-]*-organ\.js$/.test(value))) throw new Error('specialist structural exam required organ paths are invalid');
  if (!settings.direction || !Array.isArray(settings.direction.desiredCapabilities)) throw new Error('specialist structural exam direction is absent');
  if (!Array.isArray(settings.limits) || REQUIRED_LIMITS.some(limit => !settings.limits.includes(limit))) throw new Error('specialist structural exam required boundary is absent');
  if (!settings.authority || Object.values(settings.authority).some(value => value !== false)) throw new Error('specialist structural exam refuses settings with authority');
  return settings;
}

function entryMetrics(entry) {
  return {
    sourceBytes: Number(entry.metrics && entry.metrics.sourceBytes || 0),
    dependencyCount: Number(entry.metrics && entry.metrics.dependencyCount || 0),
    declaredSchemaCount: Number(entry.metrics && entry.metrics.declaredSchemaCount || 0),
    exportedBindingCount: Number(entry.metrics && entry.metrics.exportedBindingCount || 0),
    observedAuthorityTermCount: (entry.authoritySignals || []).reduce((sum, item) => sum + Number(item.count || 0), 0)
  };
}

function examineCandidate(candidate, projection, currentByObject, maximum) {
  const findings = [];
  const selectedItems = Array.isArray(candidate && candidate.archivedOrganObjects) ? candidate.archivedOrganObjects : [];
  const selectedIds = unique(selectedItems.map(item => item && item.archiveObjectId).filter(Boolean));
  if (selectedIds.length !== selectedItems.length) findings.push(finding('SELECTED_IDENTITIES_NOT_UNIQUE', 'Candidate archived organ identities are missing or duplicated.'));
  const requiredIds = unique(selectedItems.filter(item => item.selectionRole === 'EXPLICIT_REQUIRED_ORGAN').map(item => item.archiveObjectId));
  const directionIds = unique(selectedItems.filter(item => item.selectionRole === 'DIRECTION_METADATA_SELECTION').map(item => item.archiveObjectId));
  const requestedIds = unique(requiredIds.concat(directionIds));
  for (const item of selectedItems) {
    if (!['EXPLICIT_REQUIRED_ORGAN', 'DIRECTION_METADATA_SELECTION', 'EXACT_LOCAL_ORGAN_DEPENDENCY_CLOSURE'].includes(item.selectionRole)) findings.push(finding('UNKNOWN_SELECTION_ROLE', item.selectionRole));
    const entry = currentByObject.get(item.archiveObjectId);
    if (!entry) findings.push(finding('ARCHIVE_OBJECT_NOT_CURRENT', item.archiveObjectId));
    else if (item.sourcePath !== entry.sourcePath || item.sourceSha256 !== entry.sourceSha256) findings.push(finding('ARCHIVE_OBJECT_LINEAGE_MISMATCH', item.archiveObjectId));
  }
  let closure = null;
  let graph = null;
  try {
    closure = Components.closeExactOrganDependencies(projection, requestedIds, { maxComponents: maximum });
    if (!candidate.dependencyClosure || !same(candidate.dependencyClosure.result, closure)) findings.push(finding('EXACT_DEPENDENCY_CLOSURE_DIVERGED', candidate.planId));
    if (!same(selectedIds, closure.selectedArchiveObjectIds)) findings.push(finding('SELECTED_SET_DIVERGED_FROM_EXACT_CLOSURE', candidate.planId));
    if (!candidate.dependencyClosure || candidate.dependencyClosure.inferencePolicy !== 'EXACT_CURRENT_CATALOG_SOURCE_PATH_ONLY') findings.push(finding('DEPENDENCY_INFERENCE_POLICY_CHANGED', candidate.planId));
    graph = Components.assessGraph(projection, selectedIds);
    if (!candidate.componentProtocol || !same(candidate.componentProtocol.graph, graph)) findings.push(finding('COMPONENT_GRAPH_DIVERGED', candidate.planId));
    if (candidate.componentProtocol && candidate.componentProtocol.exactDependencyClosureDigest !== closure.closureDigest) findings.push(finding('COMPONENT_CLOSURE_BINDING_DIVERGED', candidate.planId));
  } catch (error) {
    findings.push(finding('RECONSTRUCTION_REFUSED', error.message));
  }
  if (candidate.runtimeState !== 'DORMANT_NOT_ASSEMBLED' || candidate.behaviorClaim !== 'UNTESTED' || candidate.compatibilityClaim !== 'UNTESTED') findings.push(finding('CANDIDATE_CLAIM_CEILING_CHANGED', candidate.planId));
  if (!candidate.assemblyNeeds || candidate.assemblyNeeds.automaticDependencyInference !== false || candidate.assemblyNeeds.exactDependencyClosureApplied !== true) findings.push(finding('ASSEMBLY_DEPENDENCY_BOUNDARY_CHANGED', candidate.planId));
  if (!candidate.componentProtocol || candidate.componentProtocol.executableIdentityAuthority !== false || candidate.componentProtocol.runtimeAdmissionAuthority !== false) findings.push(finding('COMPONENT_PROTOCOL_GAINED_AUTHORITY', candidate.planId));
  if (candidate.componentProtocol && candidate.componentProtocol.sourceProjectionDigest !== projection.projectionDigest) findings.push(finding('COMPONENT_PROJECTION_BINDING_DIVERGED', candidate.planId));
  if (graph && candidate.assemblyNeeds) {
    if (candidate.assemblyNeeds.state !== graph.state || !same(candidate.assemblyNeeds.exactOrganDependencyEdges, graph.dependencyEdges) || !same(candidate.assemblyNeeds.unresolvedSupportReferences, graph.supportReferences) || !same(candidate.assemblyNeeds.unmatchedInputHints, graph.unmatchedInputHints) || !same(candidate.assemblyNeeds.unconsumedOutputHints, graph.unconsumedOutputHints) || !same(candidate.assemblyNeeds.holds, graph.holds)) findings.push(finding('ASSEMBLY_GRAPH_VIEW_DIVERGED', candidate.planId));
  }
  const entries = selectedIds.map(id => currentByObject.get(id)).filter(Boolean);
  const sums = entries.map(entryMetrics).reduce((total, item) => Object.fromEntries(Object.keys(total).map(key => [key, total[key] + item[key]])), { sourceBytes: 0, dependencyCount: 0, declaredSchemaCount: 0, exportedBindingCount: 0, observedAuthorityTermCount: 0 });
  if (!candidate.metrics || candidate.metrics.organCount !== selectedIds.length || candidate.metrics.explicitRequiredOrganCount !== requiredIds.length || candidate.metrics.directionSelectedOrganCount !== directionIds.length || (closure && candidate.metrics.exactDependencyClosureAddedCount !== closure.addedDependencies.length)) findings.push(finding('CANDIDATE_COUNT_METRICS_DIVERGED', candidate.planId));
  for (const [key, value] of Object.entries(sums)) if (!candidate.metrics || candidate.metrics[key] !== value) findings.push(finding('CANDIDATE_STATIC_METRIC_DIVERGED', `${candidate.planId}:${key}`));
  if (candidate.metrics && candidate.metrics.evidenceClass !== 'STATIC_ARCHIVE_METADATA_ONLY') findings.push(finding('CANDIDATE_EVIDENCE_CLASS_CHANGED', candidate.planId));
  const expectedPlanId = `body-plan-${candidate.strategy}-${digest({ ids: selectedIds, requested: requestedIds }).slice(0, 16)}`;
  if (candidate.planId !== expectedPlanId) findings.push(finding('PLAN_ID_DIVERGED', candidate.planId));
  return {
    planId: candidate && candidate.planId || null,
    selectedCount: selectedIds.length,
    explicitRequiredCount: requiredIds.length,
    directionSelectedCount: directionIds.length,
    exactDependencyAddedCount: closure ? closure.addedDependencies.length : null,
    reconstructedClosureDigest: closure && closure.closureDigest || null,
    reconstructedGraphDigest: graph && graph.graphDigest || null,
    reconstructedGraphState: graph && graph.state || 'UNKNOWN_RECONSTRUCTION_FAILED',
    findingCount: findings.length,
    findings,
    state: findings.length ? 'FAIL_DORMANT_STRUCTURE_DIVERGED' : (graph && graph.state.startsWith('HOLD_') ? 'PASS_DORMANT_STRUCTURE_RECONSTRUCTED_WITH_TYPED_HOLD' : 'PASS_DORMANT_STRUCTURE_RECONSTRUCTED')
  };
}

function examine(input, options = {}) {
  const settings = validateSettings(clone(input && input.settings));
  const generation = clone(input && input.generation);
  const catalog = clone(input && input.catalog);
  const catalogDigest = input && input.catalogDigest;
  const generationDigest = input && input.generationDigest;
  if (!generation || generation.schema !== GENERATION_SCHEMA || generation.specialistId !== settings.specialistId) throw new Error('specialist structural exam generation identity changed');
  if (digest(generation) !== generationDigest) throw new Error('specialist structural exam generation digest does not reproduce');
  if (digest(catalog) !== catalogDigest) throw new Error('specialist structural exam catalog digest does not reproduce');
  if (generation.settingsDigest !== digest(settings) || generation.parentCatalogDigest !== catalogDigest) throw new Error('specialist structural exam subject bindings changed');
  const generationFindings = [];
  const expectedProtocolBindings = {
    generationSchema: GENERATION_SCHEMA,
    componentSchema: Components.COMPONENT_SCHEMA,
    projectionSchema: Components.PROJECTION_SCHEMA,
    graphSchema: Components.GRAPH_SCHEMA,
    dependencyClosureSchema: Components.CLOSURE_SCHEMA
  };
  if (generation.compositionAlgorithm !== COMPOSITION_ALGORITHM || !same(generation.protocolBindings, expectedProtocolBindings)) generationFindings.push(finding('GENERATION_PROTOCOL_BINDING_DIVERGED', generation.generationId));
  const expectedGenerationId = `generation-${digest({ specialistId: settings.specialistId, settingsDigest: generation.settingsDigest, parentCatalogDigest: catalogDigest, trigger: generation.trigger, compositionAlgorithm: generation.compositionAlgorithm, protocolBindings: generation.protocolBindings }).slice(0, 24)}`;
  if (generation.generationId !== expectedGenerationId) generationFindings.push(finding('GENERATION_ID_DIVERGED', generation.generationId));
  if (!same(generation.cloneBoundary, CLONE_BOUNDARY)) generationFindings.push(finding('CLONE_BOUNDARY_DIVERGED', generation.generationId));
  const projection = Components.projectCatalog(catalog, catalogDigest);
  const current = catalog.entries.filter(entry => entry.current === true);
  const currentByObject = new Map(current.map(entry => [entry.archiveObjectId, entry]));
  const currentByPath = new Map(current.map(entry => [entry.sourcePath, entry]));
  const requestedRequiredPaths = unique(settings.composition.requiredOrganSourcePaths);
  const missingRequiredPaths = requestedRequiredPaths.filter(sourcePath => !currentByPath.has(sourcePath));
  const expectedRequiredResolution = {
    requestedSourcePaths: requestedRequiredPaths,
    resolved: requestedRequiredPaths.filter(sourcePath => currentByPath.has(sourcePath)).map(sourcePath => {
      const entry = currentByPath.get(sourcePath);
      return { sourcePath, archiveObjectId: entry.archiveObjectId, sourceSha256: entry.sourceSha256 };
    }),
    missingSourcePaths: missingRequiredPaths,
    selectionAuthority: 'EXPLICIT_SETTINGS_ONLY',
    semanticFitnessProof: false
  };
  if (!same(generation.requiredOrganResolution, expectedRequiredResolution)) generationFindings.push(finding('REQUIRED_ORGAN_RESOLUTION_DIVERGED', generation.generationId));
  const candidates = (Array.isArray(generation.candidates) ? generation.candidates : []).map(candidate => examineCandidate(candidate, projection, currentByObject, settings.composition.maxOrgansPerCandidate));
  const preferred = candidates.find(item => item.planId === generation.preferredForIsolatedExam) || null;
  if (generation.preferredForIsolatedExam !== null && !preferred) generationFindings.push(finding('PREFERRED_PLAN_ABSENT', generation.preferredForIsolatedExam));
  const anyFailure = generationFindings.length > 0 || candidates.some(item => item.findingCount > 0);
  const preferredHeld = !!(preferred && preferred.reconstructedGraphState.startsWith('HOLD_'));
  const expectedStatus = missingRequiredPaths.length ? 'EXPERIMENTAL_REQUIRED_ORGAN_HOLD' : (preferred ? (preferredHeld ? 'EXPERIMENTAL_COMPONENT_GRAPH_HOLD' : 'EXPERIMENTAL_READY_FOR_ISOLATED_EXAM') : 'KNOWN_FAIL_NO_ARCHIVED_METADATA_MATCH');
  if (generation.status !== expectedStatus) generationFindings.push(finding('GENERATION_STATUS_DIVERGED', `${generation.status} != ${expectedStatus}`));
  let verdict = 'PASS_DORMANT_STRUCTURE_RECONSTRUCTED_READY_FOR_BEHAVIORAL_EXAM';
  if (anyFailure || generationFindings.length) verdict = 'FAIL_SPECIALIST_GENERATION_STRUCTURE_DIVERGED';
  else if (missingRequiredPaths.length) verdict = 'PASS_DORMANT_STRUCTURE_RECONSTRUCTED_WITH_TYPED_HOLD';
  else if (!preferred) verdict = 'PASS_NO_CANDIDATE_KNOWN_FAIL_RECONSTRUCTED';
  else if (preferredHeld) verdict = 'PASS_DORMANT_STRUCTURE_RECONSTRUCTED_WITH_TYPED_HOLD';
  const lineage = sourceLineage(options.root || ROOT);
  const examId = `specialist-mirror-structural-exam-${digest({ generationDigest, settingsDigest: generation.settingsDigest, catalogDigest, sourceLineage: lineage }).slice(0, 24)}`;
  const basis = {
    schema: EXAM_SCHEMA,
    examId,
    status: 'TEST',
    subject: {
      specialistId: settings.specialistId,
      generationId: generation.generationId,
      generationDigest,
      settingsDigest: generation.settingsDigest,
      catalogDigest,
      projectionDigest: projection.projectionDigest
    },
    sourceLineage: lineage,
    candidates,
    summary: {
      candidateCount: candidates.length,
      reconstructedCandidateCount: candidates.filter(item => item.findingCount === 0).length,
      typedHoldCount: candidates.filter(item => item.state === 'PASS_DORMANT_STRUCTURE_RECONSTRUCTED_WITH_TYPED_HOLD').length,
      generationFindingCount: generationFindings.length,
      generationFindings,
      organExecutions: 0,
      automaticConnections: 0,
      candidateAssemblies: 0,
      runtimeStarts: 0,
      permissionGrants: 0,
      parentMirrorWrites: 0,
      behaviorClaimsProven: 0,
      compatibilityClaimsProven: 0,
      semanticFitnessClaimsProven: 0
    },
    verdict,
    nextGate: verdict === 'PASS_DORMANT_STRUCTURE_RECONSTRUCTED_READY_FOR_BEHAVIORAL_EXAM' ? 'AUTHOR_AND_RUN_A_SEPARATE_BEHAVIORAL_EXAM_WITHOUT_ASSEMBLY_OR_PROMOTION' : (verdict === 'FAIL_SPECIALIST_GENERATION_STRUCTURE_DIVERGED' ? 'REPAIR_OR_SUPERSEDE_THE_DIVERGED_GENERATION' : 'PRESERVE_AND_RESOLVE_TYPED_HOLDS_OR_METADATA_GAPS'),
    authority: examAuthority(),
    boundary: 'This exam independently reconstructs exact dormant identities, dependency closure, graph state, hashes, and zero-authority boundaries. It does not prove semantic fitness, English ability, interpretation quality, behavior, compatibility, safety in runtime, assembly readiness, admission, promotion, or CANON.'
  };
  return Object.assign({}, basis, { examDigest: digest(basis) });
}

function verifyExam(exam) {
  if (!exam || exam.schema !== EXAM_SCHEMA || !/^specialist-mirror-structural-exam-[a-f0-9]{24}$/.test(exam.examId || '')) throw new Error('specialist structural exam shape changed');
  const basis = clone(exam);
  delete basis.examDigest;
  if (digest(basis) !== exam.examDigest) throw new Error('specialist structural exam digest changed');
  if (!exam.authority || Object.entries(exam.authority).some(([key, value]) => !['readArchivedMetadata', 'writePrivateExamEvidence'].includes(key) && value !== false)) throw new Error('specialist structural exam gained authority');
  if (exam.summary.organExecutions !== 0 || exam.summary.automaticConnections !== 0 || exam.summary.candidateAssemblies !== 0 || exam.summary.parentMirrorWrites !== 0) throw new Error('specialist structural exam effect boundary changed');
  return true;
}

function sealExam(outputRoot, exam) {
  verifyExam(exam);
  const root = path.resolve(outputRoot);
  fs.mkdirSync(root, { recursive: true });
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('specialist structural exam root must be one real directory');
  const destination = path.join(root, exam.examId);
  const bytes = json(exam);
  if (fs.existsSync(destination)) {
    if (fs.readFileSync(path.join(destination, 'exam.json'), 'utf8') !== bytes) throw new Error('immutable specialist structural exam diverged');
    return { state: 'REUSED_EXACT_SPECIALIST_STRUCTURAL_EXAM', created: false, writes: 0, directory: destination, exam };
  }
  const stage = path.join(root, `.stage-${process.pid}-${exam.examId}`);
  if (fs.existsSync(stage)) throw new Error('specialist structural exam staging directory exists');
  fs.mkdirSync(stage);
  fs.writeFileSync(path.join(stage, 'exam.json'), bytes, { encoding: 'utf8', flag: 'wx' });
  const committed = ImmutableStore.commitDirectory(stage, destination);
  return { state: committed.reused ? 'REUSED_EXACT_SPECIALIST_STRUCTURAL_EXAM' : 'SEALED_NEW_SPECIALIST_STRUCTURAL_EXAM', created: !committed.reused, writes: committed.reused ? 0 : 1, directory: destination, exam };
}

module.exports = { ORGAN_ID, EXAM_SCHEMA, REQUIRED_LIMITS, examAuthority, sourceLineage, validateSettings, examineCandidate, examine, verifyExam, sealExam };
