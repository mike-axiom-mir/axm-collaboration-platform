#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Registry = require('./code-specialist-build-profile-registry-v1');
const Router = require('./code-specialization-router-v1');
const RecipeCatalog = require('../capability-fabric/recipes/catalog.json');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + '\n' + (error.stack || error) + '\n'); process.exitCode = 1; }
}
function clone(value) { return Registry.clone(value); }
function profileCore(profile) { const draft = clone(profile); delete draft.profileDigest; return draft; }
function organRef(id) {
  const organ = Router.CATALOG.specialistOrgans.find((row) => row.id === id);
  if (!organ) throw new Error('missing example organ ' + id);
  return { id: organ.id, schema: 'axm.code-specialist-organ-profile/v1', version: organ.version, sha256: Registry.sha256Value(organ) };
}
function pythonProposal() {
  const draft = profileCore(Registry.CATALOG.profiles[0]);
  draft.id = 'code-family.python-module';
  draft.mode = 'ONE_EXACT_PYTHON_APPLICATION_LOGIC_SPECIALIST';
  draft.specialistOrganRef = organRef('organ.code.application-logic');
  draft.languageIds = ['python'];
  draft.capability = {
    family: 'python-module',
    recipeRef: {
      id: 'bounded-python-module', version: '0.1.0', digest: Registry.sha256Value('missing-python-recipe'),
      builderId: 'bounded-python-module-v1', builderDigest: Registry.sha256Value('missing-python-builder'), capabilityKind: 'HAND'
    }
  };
  draft.exampleArtifactId = 'python-module';
  draft.gates = { specialist: 'SELECT_EXACT_PYTHON_APPLICATION_LOGIC_SPECIALIST_AND_REPLAN', recipe: 'ADD_SOURCE_REVIEWED_BOUNDED_PYTHON_RECIPE', request: 'REPAIR_EXACT_HUMAN_REVIEWED_PYTHON_REQUEST' };
  draft.gaps = { specialist: 'code.specialist.python.application-logic.exact-lane', recipe: 'capability.recipe.bounded-python-module.exact', request: 'capability.build-request.python-module.exact' };
  draft.evidence = { visualBehavior: 'NOT_APPLICABLE', requiredKinds: ['DETERMINISTIC_BEHAVIOR', 'STATIC_STRUCTURE'] };
  return Registry.sealProfile(draft);
}

const sourcePath = path.join(__dirname, 'code-specialist-build-profile-registry-v1.js');
const profileSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'code-specialist-build-profile.schema.json'), 'utf8'));
const catalogSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'code-specialist-build-profile-catalog.schema.json'), 'utf8'));
const assessmentSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'code-specialist-build-profile-assessment.schema.json'), 'utf8'));
const jsonProfile = Registry.CATALOG.profiles.find((row) => row.id === 'code-family.json-schema-validator');
const htmlProfile = Registry.CATALOG.profiles.find((row) => row.id === 'code-family.static-html-page');
const pythonProfile = Registry.CATALOG.profiles.find((row) => row.id === 'code-family.bounded-python-record-transform');
const javascriptProfile = Registry.CATALOG.profiles.find((row) => row.id === 'code-family.bounded-javascript-record-transform');
const recordQueryProfile = Registry.CATALOG.profiles.find((row) => row.id === 'code-family.bounded-record-query');
const fsmDefinitionProfile = Registry.CATALOG.profiles.find((row) => row.id === 'code-family.bounded-portable-fsm-definition');
const adapterProfile = Registry.CATALOG.profiles.find((row) => row.id === 'code-family.closed-object-contract-adapter');
const cssProfile = Registry.CATALOG.profiles.find((row) => row.id === 'code-family.bounded-css-token-stylesheet');
const svgProfile = Registry.CATALOG.profiles.find((row) => row.id === 'code-family.svg-status-badge');

test('catalog identity is exact', () => assert.strictEqual(Registry.CATALOG.schema, Registry.CATALOG_SCHEMA));
test('catalog digest rebuilds exactly', () => { const core = clone(Registry.CATALOG); delete core.catalogDigest; assert.strictEqual(Registry.CATALOG.catalogDigest, Registry.sha256Value(core)); });
test('catalog normalization is byte deterministic', () => assert.strictEqual(Registry.canonicalJson(Registry.CATALOG), Registry.canonicalJson(Registry.normalizeCatalog(clone(Registry.CATALOG)))));
test('loaded catalog and profiles are immutable', () => assert(Object.isFrozen(Registry.CATALOG) && Registry.CATALOG.profiles.every(Object.isFrozen)));
test('catalog contains exactly the nine bounded reviewed lanes', () => assert.deepStrictEqual(Registry.CATALOG.profiles.map((row) => row.id), ['code-family.bounded-css-token-stylesheet', 'code-family.bounded-javascript-record-transform', 'code-family.bounded-portable-fsm-definition', 'code-family.bounded-python-record-transform', 'code-family.bounded-record-query', 'code-family.closed-object-contract-adapter', 'code-family.json-schema-validator', 'code-family.static-html-page', 'code-family.svg-status-badge']));
test('JSON profile digest rebuilds exactly', () => assert.strictEqual(jsonProfile.profileDigest, Registry.sha256Value(profileCore(jsonProfile))));
test('HTML profile digest rebuilds exactly', () => assert.strictEqual(htmlProfile.profileDigest, Registry.sha256Value(profileCore(htmlProfile))));
test('Python profile digest rebuilds exactly', () => assert.strictEqual(pythonProfile.profileDigest, Registry.sha256Value(profileCore(pythonProfile))));
test('JavaScript profile digest rebuilds exactly', () => assert.strictEqual(javascriptProfile.profileDigest, Registry.sha256Value(profileCore(javascriptProfile))));
test('record-query profile digest rebuilds exactly', () => assert.strictEqual(recordQueryProfile.profileDigest, Registry.sha256Value(profileCore(recordQueryProfile))));
test('portable-FSM-definition profile digest rebuilds exactly', () => assert.strictEqual(fsmDefinitionProfile.profileDigest, Registry.sha256Value(profileCore(fsmDefinitionProfile))));
test('contract-adapter profile digest rebuilds exactly', () => assert.strictEqual(adapterProfile.profileDigest, Registry.sha256Value(profileCore(adapterProfile))));
test('CSS profile digest rebuilds exactly', () => assert.strictEqual(cssProfile.profileDigest, Registry.sha256Value(profileCore(cssProfile))));
test('SVG profile digest rebuilds exactly', () => assert.strictEqual(svgProfile.profileDigest, Registry.sha256Value(profileCore(svgProfile))));
test('JSON mode resolves exactly', () => assert.strictEqual(Registry.resolveMode(jsonProfile.mode).profileRef.sha256, jsonProfile.profileDigest));
test('HTML mode resolves exactly', () => assert.strictEqual(Registry.resolveMode(htmlProfile.mode).profileRef.sha256, htmlProfile.profileDigest));
test('Python mode resolves exactly', () => assert.strictEqual(Registry.resolveMode(pythonProfile.mode).profileRef.sha256, pythonProfile.profileDigest));
test('JavaScript mode resolves exactly', () => assert.strictEqual(Registry.resolveMode(javascriptProfile.mode).profileRef.sha256, javascriptProfile.profileDigest));
test('record-query mode resolves exactly', () => assert.strictEqual(Registry.resolveMode(recordQueryProfile.mode).profileRef.sha256, recordQueryProfile.profileDigest));
test('portable-FSM-definition mode resolves exactly', () => assert.strictEqual(Registry.resolveMode(fsmDefinitionProfile.mode).profileRef.sha256, fsmDefinitionProfile.profileDigest));
test('contract-adapter mode resolves exactly', () => assert.strictEqual(Registry.resolveMode(adapterProfile.mode).profileRef.sha256, adapterProfile.profileDigest));
test('CSS mode resolves exactly', () => assert.strictEqual(Registry.resolveMode(cssProfile.mode).profileRef.sha256, cssProfile.profileDigest));
test('SVG mode resolves exactly', () => assert.strictEqual(Registry.resolveMode(svgProfile.mode).profileRef.sha256, svgProfile.profileDigest));
test('unknown mode does not fall back', () => assert.strictEqual(Registry.resolveMode('ONE_EXACT_UNIVERSAL_SPECIALIST'), null));
test('JSON profile is ready for repository review', () => assert.strictEqual(Registry.assessProfile(jsonProfile).status, 'READY_FOR_PROFILE_REGISTRY_REVIEW'));
test('HTML profile is ready for repository review', () => assert.strictEqual(Registry.assessProfile(htmlProfile).status, 'READY_FOR_PROFILE_REGISTRY_REVIEW'));
test('Python profile is ready for repository review', () => assert.strictEqual(Registry.assessProfile(pythonProfile).status, 'READY_FOR_PROFILE_REGISTRY_REVIEW'));
test('JavaScript profile is ready for repository review', () => assert.strictEqual(Registry.assessProfile(javascriptProfile).status, 'READY_FOR_PROFILE_REGISTRY_REVIEW'));
test('record-query profile is ready for repository review', () => assert.strictEqual(Registry.assessProfile(recordQueryProfile).status, 'READY_FOR_PROFILE_REGISTRY_REVIEW'));
test('portable-FSM-definition profile is ready for repository review', () => assert.strictEqual(Registry.assessProfile(fsmDefinitionProfile).status, 'READY_FOR_PROFILE_REGISTRY_REVIEW'));
test('contract-adapter profile is ready for repository review', () => assert.strictEqual(Registry.assessProfile(adapterProfile).status, 'READY_FOR_PROFILE_REGISTRY_REVIEW'));
test('CSS profile is ready for repository review', () => assert.strictEqual(Registry.assessProfile(cssProfile).status, 'READY_FOR_PROFILE_REGISTRY_REVIEW'));
test('SVG profile is ready for repository review', () => assert.strictEqual(Registry.assessProfile(svgProfile).status, 'READY_FOR_PROFILE_REGISTRY_REVIEW'));
test('Python profile binds the exact Python recipe and application specialist', () => assert.strictEqual(pythonProfile.capability.recipeRef.id, 'bounded-python-record-transform') && assert.strictEqual(pythonProfile.specialistOrganRef.id, 'organ.code.application-logic'));
test('JavaScript profile binds the exact hardened recipe, application specialist, and language', () => assert.strictEqual(javascriptProfile.capability.recipeRef.id, 'pure-json-transform') && assert.strictEqual(javascriptProfile.capability.recipeRef.version, '1.1.0') && assert.strictEqual(javascriptProfile.specialistOrganRef.id, 'organ.code.application-logic') && assert.deepStrictEqual(javascriptProfile.languageIds, ['javascript']));
test('JavaScript recipe and builder digests match the active catalog exactly', () => { const recipe = RecipeCatalog.recipes.find((row) => row.id === 'pure-json-transform'); assert.strictEqual(javascriptProfile.capability.recipeRef.digest, recipe.recipeDigest); assert.strictEqual(javascriptProfile.capability.recipeRef.builderDigest, recipe.builderDigest); });
test('record-query profile binds exact application Organ, JavaScript language, recipe, artifact, and builder lineage', () => { const recipe = RecipeCatalog.recipes.find((row) => row.id === 'bounded-record-query'); assert.strictEqual(recordQueryProfile.specialistOrganRef.id, 'organ.code.application-logic'); assert.deepStrictEqual(recordQueryProfile.languageIds, ['javascript']); assert.strictEqual(recordQueryProfile.exampleArtifactId, 'javascript-record-query'); assert.strictEqual(recordQueryProfile.capability.recipeRef.id, recipe.id); assert.strictEqual(recordQueryProfile.capability.recipeRef.digest, recipe.recipeDigest); assert.strictEqual(recordQueryProfile.capability.recipeRef.builderId, 'bounded-record-query-v1'); assert.strictEqual(recordQueryProfile.capability.recipeRef.builderDigest, recipe.builderDigest); });
test('portable-FSM-definition profile binds exact application Organ, JavaScript language, recipe, artifact, and builder lineage', () => { const recipe = RecipeCatalog.recipes.find((row) => row.id === 'bounded-portable-fsm-definition'); assert.strictEqual(fsmDefinitionProfile.specialistOrganRef.id, 'organ.code.application-logic'); assert.deepStrictEqual(fsmDefinitionProfile.languageIds, ['javascript']); assert.strictEqual(fsmDefinitionProfile.exampleArtifactId, 'javascript-portable-fsm-definition'); assert.strictEqual(fsmDefinitionProfile.capability.recipeRef.id, recipe.id); assert.strictEqual(fsmDefinitionProfile.capability.recipeRef.digest, recipe.recipeDigest); assert.strictEqual(fsmDefinitionProfile.capability.recipeRef.builderId, 'bounded-portable-fsm-definition-v1'); assert.strictEqual(fsmDefinitionProfile.capability.recipeRef.builderDigest, recipe.builderDigest); });
test('four JavaScript application abilities remain distinct through exact bindings', () => { const profiles = Registry.CATALOG.profiles.filter((row) => row.specialistOrganRef.id === 'organ.code.application-logic' && row.languageIds.includes('javascript')); assert.strictEqual(profiles.length, 4); assert.strictEqual(new Set(profiles.map((row) => row.mode)).size, 4); assert.strictEqual(new Set(profiles.map((row) => row.capability.recipeRef.id)).size, 4); assert.strictEqual(new Set(profiles.map((row) => row.exampleArtifactId)).size, 4); assert.strictEqual(new Set(profiles.map((row) => row.profileDigest)).size, 4); });
test('contract-adapter profile binds exact JavaScript application Organ, artifact, recipe, and builder lineage', () => { const recipe = RecipeCatalog.recipes.find((row) => row.id === 'closed-object-contract-adapter'); assert.strictEqual(adapterProfile.specialistOrganRef.id, 'organ.code.application-logic'); assert.deepStrictEqual(adapterProfile.languageIds, ['javascript']); assert.strictEqual(adapterProfile.exampleArtifactId, 'javascript-contract-adapter'); assert.strictEqual(adapterProfile.capability.recipeRef.id, recipe.id); assert.strictEqual(adapterProfile.capability.recipeRef.digest, recipe.recipeDigest); assert.strictEqual(adapterProfile.capability.recipeRef.builderId, 'closed-object-contract-adapter-v2'); assert.strictEqual(adapterProfile.capability.recipeRef.builderDigest, recipe.builderDigest); });
test('two JavaScript application lanes remain distinct through exact mode, recipe, artifact, and profile digests', () => { assert.strictEqual(adapterProfile.specialistOrganRef.id, javascriptProfile.specialistOrganRef.id); assert.deepStrictEqual(adapterProfile.languageIds, javascriptProfile.languageIds); assert.notStrictEqual(adapterProfile.mode, javascriptProfile.mode); assert.notStrictEqual(adapterProfile.capability.recipeRef.id, javascriptProfile.capability.recipeRef.id); assert.notStrictEqual(adapterProfile.exampleArtifactId, javascriptProfile.exampleArtifactId); assert.notStrictEqual(adapterProfile.profileDigest, javascriptProfile.profileDigest); });
test('Python and JavaScript share application logic only through distinct exact language and recipe bindings', () => assert.strictEqual(pythonProfile.specialistOrganRef.id, javascriptProfile.specialistOrganRef.id) && assert.notDeepStrictEqual(pythonProfile.languageIds, javascriptProfile.languageIds) && assert.notStrictEqual(pythonProfile.capability.recipeRef.id, javascriptProfile.capability.recipeRef.id));
test('CSS profile binds the exact CSS recipe and style specialist', () => assert.strictEqual(cssProfile.capability.recipeRef.id, 'bounded-css-token-stylesheet') && assert.strictEqual(cssProfile.specialistOrganRef.id, 'organ.code.style-presentation') && assert.deepStrictEqual(cssProfile.languageIds, ['css']));
test('CSS profile keeps visual and motion evidence unproven', () => assert.strictEqual(cssProfile.evidence.visualBehavior, 'UNKNOWN') && assert(cssProfile.evidence.requiredKinds.includes('VISUAL_APPEARANCE')) && assert(cssProfile.evidence.requiredKinds.includes('MOTION_TIMING')));
test('SVG profile binds exact markup Organ, language, and hardened recipe', () => assert.strictEqual(svgProfile.specialistOrganRef.id, 'organ.code.markup-structure') && assert.deepStrictEqual(svgProfile.languageIds, ['svg']) && assert.strictEqual(svgProfile.capability.recipeRef.id, 'svg-status-badge') && assert.strictEqual(svgProfile.capability.recipeRef.version, '1.1.0'));
test('SVG profile keeps browser, visual, and accessibility evidence unproven', () => assert.strictEqual(svgProfile.evidence.visualBehavior, 'UNKNOWN') && assert(svgProfile.evidence.requiredKinds.includes('VISUAL_APPEARANCE')) && assert(svgProfile.evidence.requiredKinds.includes('ACCESSIBILITY')));
test('HTML and SVG may share markup Organ only through distinct exact language bindings', () => assert.strictEqual(htmlProfile.specialistOrganRef.id, svgProfile.specialistOrganRef.id) && assert.notDeepStrictEqual(htmlProfile.languageIds, svgProfile.languageIds));
test('SVG recipe and builder digests match the active catalog exactly', () => { const recipe = RecipeCatalog.recipes.find((row) => row.id === 'svg-status-badge'); assert.strictEqual(svgProfile.capability.recipeRef.digest, recipe.recipeDigest); assert.strictEqual(svgProfile.capability.recipeRef.builderDigest, recipe.builderDigest); });
test('assessment digest rebuilds exactly', () => { const assessment = Registry.assessProfile(htmlProfile), core = clone(assessment); delete core.assessmentDigest; assert.strictEqual(assessment.assessmentDigest, Registry.sha256Value(core)); });
test('ready assessment does not self-register', () => assert.strictEqual(Registry.assessProfile(htmlProfile).registered, false));
test('ready assessment does not execute', () => assert.strictEqual(Registry.assessProfile(htmlProfile).executed, false));
test('ready assessment requires four-root review and Mike merge', () => assert.strictEqual(Registry.assessProfile(htmlProfile).nextGate, 'FOUR_ROOT_REVIEW_AND_MIKE_MERGE_DECISION_REQUIRED'));
test('Python proposal is classified but held on its missing exact recipe', () => { const result = Registry.assessProfile(pythonProposal()); assert.strictEqual(result.status, 'CAPABILITY_GAPS'); assert(result.holds.some((row) => row.code === 'RECIPE_NOT_FOUND')); assert(result.capabilityGapReport.missingCapabilities.includes('capability.recipe.bounded-python-module.exact')); });
test('Python gap does not pretend implementation exists', () => assert.strictEqual(Registry.assessProfile(pythonProposal()).capabilityGapReport.truth.implementationAvailableForEveryGap, false));
test('Python gap grants no authority', () => assert.strictEqual(Registry.assessProfile(pythonProposal()).authority, 'NONE'));
test('unknown language produces a typed taxonomy gap', () => { const draft = profileCore(pythonProposal()); draft.languageIds = ['imaginary-language']; const result = Registry.assessProfile(Registry.sealProfile(draft)); assert(result.holds.some((row) => row.code === 'LANGUAGE_ID_UNKNOWN')); });
test('language-specialist mismatch is held', () => { const draft = profileCore(jsonProfile); draft.languageIds = ['python']; const result = Registry.assessProfile(Registry.sealProfile(draft)); assert(result.holds.some((row) => row.code === 'LANGUAGE_SPECIALIST_MISMATCH')); });
test('specialist digest drift is held', () => { const draft = profileCore(jsonProfile); draft.specialistOrganRef.sha256 = Registry.sha256Value('drift'); const result = Registry.assessProfile(Registry.sealProfile(draft)); assert(result.holds.some((row) => row.code === 'SPECIALIST_LINEAGE_DRIFT')); });
test('missing specialist is held', () => { const draft = profileCore(jsonProfile); draft.specialistOrganRef.id = 'organ.code.missing'; draft.specialistOrganRef.sha256 = Registry.sha256Value('missing'); const result = Registry.assessProfile(Registry.sealProfile(draft)); assert(result.holds.some((row) => row.code === 'SPECIALIST_NOT_FOUND')); });
test('recipe digest drift is held', () => { const draft = profileCore(jsonProfile); draft.capability.recipeRef.digest = Registry.sha256Value('drift'); const result = Registry.assessProfile(Registry.sealProfile(draft)); assert(result.holds.some((row) => row.code === 'RECIPE_LINEAGE_OR_REVIEW_DRIFT')); });
test('recipe builder digest drift is held', () => { const draft = profileCore(jsonProfile); draft.capability.recipeRef.builderDigest = Registry.sha256Value('drift'); const result = Registry.assessProfile(Registry.sealProfile(draft)); assert(result.holds.some((row) => row.code === 'RECIPE_LINEAGE_OR_REVIEW_DRIFT')); });
test('forged recipe catalog digest is held', () => { const catalog = clone(RecipeCatalog); catalog.catalogDigest = Registry.sha256Value('forged'); const result = Registry.assessProfile(jsonProfile, Router.CATALOG, catalog); assert(result.holds.some((row) => row.code === 'RECIPE_CATALOG_DIGEST_DRIFT')); });
test('inactive recipe is held', () => { const catalog = clone(RecipeCatalog); catalog.recipes.find((row) => row.id === jsonProfile.capability.recipeRef.id).activation = 'REVIEW_CANDIDATE'; const result = Registry.assessProfile(jsonProfile, Router.CATALOG, catalog); assert(result.holds.some((row) => row.code === 'RECIPE_LINEAGE_OR_REVIEW_DRIFT')); });
test('ambiguous recipe versions fail closed', () => { const catalog = clone(RecipeCatalog); catalog.recipes.push(clone(catalog.recipes.find((row) => row.id === jsonProfile.capability.recipeRef.id))); const result = Registry.assessProfile(jsonProfile, Router.CATALOG, catalog); assert(result.holds.some((row) => row.code === 'RECIPE_VERSION_AMBIGUITY')); });
test('ambiguous specialist versions fail closed', () => { const catalog = clone(Router.CATALOG); catalog.specialistOrgans.push(clone(catalog.specialistOrgans.find((row) => row.id === jsonProfile.specialistOrganRef.id))); const result = Registry.assessProfile(jsonProfile, catalog, RecipeCatalog); assert(result.holds.some((row) => row.code === 'SPECIALIST_VERSION_AMBIGUITY')); });
test('profile digest drift is refused', () => { const draft = clone(jsonProfile); draft.profileDigest = Registry.sha256Value('drift'); assert.throws(() => Registry.normalizeProfile(draft), /profile digest mismatch/i); });
test('unknown profile fields are refused', () => { const draft = profileCore(jsonProfile); draft.provider = 'hidden'; assert.throws(() => Registry.sealProfile(draft), /fields mismatch/i); });
test('permission expansion is refused', () => { const draft = profileCore(jsonProfile); draft.boundary.permissions = ['filesystem-write']; assert.throws(() => Registry.sealProfile(draft), /boundary exceeds/i); });
test('network expansion is refused', () => { const draft = profileCore(jsonProfile); draft.boundary.networkDomains = ['example.test']; assert.throws(() => Registry.sealProfile(draft), /boundary exceeds/i); });
test('candidate execution expansion is refused', () => { const draft = profileCore(jsonProfile); draft.boundary.candidateExecution = true; assert.throws(() => Registry.sealProfile(draft), /boundary exceeds/i); });
test('installation expansion is refused', () => { const draft = profileCore(jsonProfile); draft.boundary.install = true; assert.throws(() => Registry.sealProfile(draft), /boundary exceeds/i); });
test('CANON expansion is refused', () => { const draft = profileCore(jsonProfile); draft.boundary.canon = true; assert.throws(() => Registry.sealProfile(draft), /boundary exceeds/i); });
test('duplicate profile mode is refused', () => { const draft = clone(Registry.CATALOG); delete draft.catalogDigest; const extra = clone(draft.profiles[0]); extra.id = 'code-family.duplicate-mode'; extra.profileDigest = Registry.sealProfile(profileCore(extra)).profileDigest; draft.profiles.push(extra); assert.throws(() => Registry.sealCatalog(draft), /profile modes must be unique/i); });
test('exact specialist-language-recipe-artifact binding collision is refused', () => { const draft = clone(Registry.CATALOG); delete draft.catalogDigest; const extraCore = profileCore(draft.profiles[0]); extraCore.id = 'code-family.duplicate-binding'; extraCore.mode = 'ONE_EXACT_DUPLICATE_BINDING'; draft.profiles.push(Registry.sealProfile(extraCore)); assert.throws(() => Registry.sealCatalog(draft), /exact specialist-language-recipe-artifact bindings must be unique/i); });
test('same specialist and language may expose multiple abilities only through distinct exact bindings', () => { const draft = clone(Registry.CATALOG); delete draft.catalogDigest; const sealed = Registry.sealCatalog(draft); assert.strictEqual(sealed.profiles.filter((row) => row.specialistOrganRef.id === 'organ.code.application-logic' && row.languageIds.includes('javascript')).length, 4); });
test('catalog digest drift is refused', () => { const draft = clone(Registry.CATALOG); draft.catalogDigest = Registry.sha256Value('drift'); assert.throws(() => Registry.normalizeCatalog(draft), /catalog digest mismatch/i); });
test('catalog does not claim a complete language universe', () => assert.strictEqual(Registry.CATALOG.truth.completeCodeFamilyUniverseClaimed, false));
test('catalog profiles do not prove runtime', () => assert.strictEqual(Registry.CATALOG.truth.profileProvesRuntime, false));
test('catalog cannot auto-register recipes', () => assert.strictEqual(Registry.CATALOG.truth.automaticRecipeAdmission, false));
test('catalog requires Mike final merge gate', () => assert.strictEqual(Registry.CATALOG.truth.mikeFinalMergeGateRequired, true));
test('profile schema is closed', () => assert.strictEqual(profileSchema.additionalProperties, false));
test('catalog schema is closed', () => assert.strictEqual(catalogSchema.additionalProperties, false));
test('assessment schema is closed', () => assert.strictEqual(assessmentSchema.additionalProperties, false));
test('module contract declares no writes', () => assert.deepStrictEqual(Registry.MODULE_CONTRACT.boundaries.writes, []));
test('module contract refuses automatic registration', () => assert(Registry.MODULE_CONTRACT.boundaries.refuses.includes('automatic-registration')));
test('module contract refuses candidate execution', () => assert(Registry.MODULE_CONTRACT.boundaries.refuses.includes('candidate-execution')));
test('module contract refuses installation and CANON change', () => assert(Registry.MODULE_CONTRACT.boundaries.refuses.includes('installation')) && assert(Registry.MODULE_CONTRACT.boundaries.refuses.includes('canon-change')));
test('source imports no filesystem module', () => assert(!/require\(['"](?:fs|node:fs)['"]\)/.test(fs.readFileSync(sourcePath, 'utf8'))));
test('source imports no child process module', () => assert(!/require\(['"](?:child_process|node:child_process)['"]\)/.test(fs.readFileSync(sourcePath, 'utf8'))));
test('source contains no provider or network call', () => assert(!/\bfetch\s*\(|https?\.|provider\.call/.test(fs.readFileSync(sourcePath, 'utf8'))));

if (!process.exitCode) process.stdout.write('Code specialist build profile registry v1 selftest: ' + passed + ' PASS\n');
