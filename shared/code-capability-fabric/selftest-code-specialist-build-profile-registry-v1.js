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

test('catalog identity is exact', () => assert.strictEqual(Registry.CATALOG.schema, Registry.CATALOG_SCHEMA));
test('catalog digest rebuilds exactly', () => { const core = clone(Registry.CATALOG); delete core.catalogDigest; assert.strictEqual(Registry.CATALOG.catalogDigest, Registry.sha256Value(core)); });
test('catalog normalization is byte deterministic', () => assert.strictEqual(Registry.canonicalJson(Registry.CATALOG), Registry.canonicalJson(Registry.normalizeCatalog(clone(Registry.CATALOG)))));
test('loaded catalog and profiles are immutable', () => assert(Object.isFrozen(Registry.CATALOG) && Registry.CATALOG.profiles.every(Object.isFrozen)));
test('catalog contains exactly the three bounded proven lanes', () => assert.deepStrictEqual(Registry.CATALOG.profiles.map((row) => row.id), ['code-family.bounded-python-record-transform', 'code-family.json-schema-validator', 'code-family.static-html-page']));
test('JSON profile digest rebuilds exactly', () => assert.strictEqual(jsonProfile.profileDigest, Registry.sha256Value(profileCore(jsonProfile))));
test('HTML profile digest rebuilds exactly', () => assert.strictEqual(htmlProfile.profileDigest, Registry.sha256Value(profileCore(htmlProfile))));
test('Python profile digest rebuilds exactly', () => assert.strictEqual(pythonProfile.profileDigest, Registry.sha256Value(profileCore(pythonProfile))));
test('JSON mode resolves exactly', () => assert.strictEqual(Registry.resolveMode(jsonProfile.mode).profileRef.sha256, jsonProfile.profileDigest));
test('HTML mode resolves exactly', () => assert.strictEqual(Registry.resolveMode(htmlProfile.mode).profileRef.sha256, htmlProfile.profileDigest));
test('Python mode resolves exactly', () => assert.strictEqual(Registry.resolveMode(pythonProfile.mode).profileRef.sha256, pythonProfile.profileDigest));
test('unknown mode does not fall back', () => assert.strictEqual(Registry.resolveMode('ONE_EXACT_UNIVERSAL_SPECIALIST'), null));
test('JSON profile is ready for repository review', () => assert.strictEqual(Registry.assessProfile(jsonProfile).status, 'READY_FOR_PROFILE_REGISTRY_REVIEW'));
test('HTML profile is ready for repository review', () => assert.strictEqual(Registry.assessProfile(htmlProfile).status, 'READY_FOR_PROFILE_REGISTRY_REVIEW'));
test('Python profile is ready for repository review', () => assert.strictEqual(Registry.assessProfile(pythonProfile).status, 'READY_FOR_PROFILE_REGISTRY_REVIEW'));
test('Python profile binds the exact Python recipe and application specialist', () => assert.strictEqual(pythonProfile.capability.recipeRef.id, 'bounded-python-record-transform') && assert.strictEqual(pythonProfile.specialistOrganRef.id, 'organ.code.application-logic'));
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
test('specialist-language alias collision is refused', () => { const draft = clone(Registry.CATALOG); delete draft.catalogDigest; const extraCore = profileCore(draft.profiles[0]); extraCore.id = 'code-family.duplicate-binding'; extraCore.mode = 'ONE_EXACT_DUPLICATE_BINDING'; draft.profiles.push(Registry.sealProfile(extraCore)); assert.throws(() => Registry.sealCatalog(draft), /specialist-language bindings must be unique/i); });
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
