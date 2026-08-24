#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Builder = require('./code-specialist-capability-builder-v1');
const IntentAdapter = require('./code-specialist-organ-intent-adapter-v1');
const CapabilityFabric = require('../capability-fabric');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + '\n' + (error.stack || error) + '\n'); process.exitCode = 1; }
}
function clone(value) { return Builder.clone(value); }
function resealOuter(value) { const draft = clone(value); delete draft.requestDigest; return Builder.sealRequest(draft); }
function changed(base, mutate) { const next = clone(base); mutate(next); return resealOuter(next); }
function held(base, mutate, status) { const result = Builder.generate(changed(base, mutate)); assert.strictEqual(result.status, status); assert.strictEqual(result.detachedCandidate, null); return result; }

const base = Builder.buildExampleRequest();
const result = Builder.generate(base);
const candidate = result.detachedCandidate;
const markupBase = Builder.buildMarkupExampleRequest();
const markupResult = Builder.generate(markupBase);
const markupCandidate = markupResult.detachedCandidate;
const sourcePath = path.join(__dirname, 'code-specialist-capability-builder-v1.js');
const requestSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'code-specialist-capability-build-request.schema.json'), 'utf8'));
const resultSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'code-specialist-capability-candidate.schema.json'), 'utf8'));
const capabilityRecipeSchema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'capability-fabric', 'schemas', 'capability-recipe.schema.json'), 'utf8'));
const candidatePackageSchema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'capability-fabric', 'schemas', 'candidate-package.schema.json'), 'utf8'));

test('example request is sealed under the v1.9 identity', () => assert.strictEqual(base.schema, Builder.REQUEST_SCHEMA));
test('request version is exact', () => assert.strictEqual(base.version, Builder.VERSION));
test('request digest rebuilds exactly', () => assert.strictEqual(base.requestDigest, Builder.sha256Value(Object.fromEntries(Object.entries(base).filter(([key]) => key !== 'requestDigest')))));
test('example produces one detached candidate', () => assert.strictEqual(result.status, 'COMPLETE_DETACHED_CANDIDATE'));
test('result schema is exact', () => assert.strictEqual(result.schema, Builder.RESULT_SCHEMA));
test('result digest rebuilds exactly', () => assert.strictEqual(result.resultDigest, Builder.sha256Value(Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'resultDigest')))));
test('identical input produces byte-identical result', () => assert.strictEqual(Builder.canonicalJson(result), Builder.canonicalJson(Builder.generate(base))));
test('result verifies through an exact independent rebuild', () => assert.deepStrictEqual(Builder.verify(result, base), { pass: true, errors: [] }));
test('selected specialist is exactly data-schema', () => assert.strictEqual(result.specialistContext.specialistOrganRef.id, 'organ.code.data-schema'));
test('selected artifact is exactly game-schema', () => assert.strictEqual(result.specialistContext.artifactRef.id, 'game-schema'));
test('specialist intent plan lineage is byte-bound', () => assert.strictEqual(result.specialistContext.intentPlanRef.sha256, base.intentAdapterPlan.planDigest));
test('organ intent lineage is byte-bound', () => assert.strictEqual(result.specialistContext.organIntentRef.sha256, base.intentAdapterPlan.organIntent.intentDigest));
test('build-profile lineage is byte-bound', () => assert.deepStrictEqual(result.specialistContext.buildProfileRef, base.selection.buildProfileRef));
test('selected language is bound to the build profile', () => assert.strictEqual(result.specialistContext.languageId, 'json'));
test('consent binds the exact intent plan', () => assert.strictEqual(result.consentRef.subject.intentPlanDigest, base.intentAdapterPlan.planDigest));
test('consent binds the exact capability request', () => assert.strictEqual(result.consentRef.subject.capabilityRequestDigest, base.capabilityBuildRequest.requestDigest));
test('consent binds the exact catalog', () => assert.strictEqual(result.consentRef.subject.catalogDigest, result.catalogRef.sha256));
test('consent binds the exact recipe', () => assert.strictEqual(result.consentRef.subject.recipeDigest, result.recipeRef.digest));
test('consent binds the exact build-profile catalog', () => assert.strictEqual(result.consentRef.subject.buildProfileCatalogDigest, result.buildProfileCatalogRef.sha256));
test('consent binds the exact build profile', () => assert.strictEqual(result.consentRef.subject.buildProfileDigest, result.specialistContext.buildProfileRef.sha256));
test('consent is only tier 1', () => assert.strictEqual(result.consentRef.tier, 'TIER_1_DETACHED_CANDIDATE'));
test('consent replay is not overclaimed', () => assert.strictEqual(result.consentRef.replayState, 'UNVERIFIED_SINGLE_USE_CLAIM'));
test('human identity authentication is not overclaimed', () => assert.strictEqual(result.truth.authenticatedHumanIdentityProven, false));
test('replay prevention is not overclaimed', () => assert.strictEqual(result.truth.consentReplayPreventionProven, false));
test('target recipe identity is exact', () => assert.deepStrictEqual(result.recipeRef, Builder.TARGET_RECIPE));
test('build request source is Code Fabric', () => assert.strictEqual(base.capabilityBuildRequest.source.kind, 'CODE_FABRIC'));
test('build request source binds the intent result', () => assert.strictEqual(base.capabilityBuildRequest.source.ref, base.intentAdapterPlan.planDigest));
test('build plan is READY', () => assert.strictEqual(result.buildPlan.status, 'READY'));
test('build plan recipe is exact', () => assert.deepStrictEqual(result.buildPlan.recipeRef, Builder.TARGET_RECIPE));
test('candidate package is EXPERIMENTAL', () => assert.strictEqual(candidate.package.status, 'EXPERIMENTAL'));
test('candidate is one HAND', () => assert.strictEqual(candidate.package.capabilityKind, 'HAND'));
test('candidate package binds the build request', () => assert.strictEqual(candidate.package.requestDigest, base.capabilityBuildRequest.requestDigest));
test('candidate package binds the catalog', () => assert.strictEqual(candidate.package.catalogDigest, result.catalogRef.sha256));
test('candidate package binds the recipe', () => assert.deepStrictEqual(candidate.package.recipeRef, Builder.TARGET_RECIPE));
test('candidate package has a sha256 digest', () => assert(/^sha256:[a-f0-9]{64}$/.test(candidate.package.packageDigest)));
test('candidate passes Capability Fabric structural verification', () => assert(CapabilityFabric.verifyCandidate(candidate).ok));
test('candidate contains generated capability source as inert text', () => assert.strictEqual(typeof candidate.files['capability.js'], 'string'));
test('candidate contains an emitted selftest as inert text', () => assert.strictEqual(typeof candidate.files['selftest.js'], 'string'));
test('candidate contains a byte-bound module bundle', () => assert.strictEqual(typeof candidate.files['module-bundle.json'], 'string'));
test('candidate file count is measured', () => assert.strictEqual(candidate.package.files.length, Object.keys(candidate.files).length));
test('candidate byte count stays inside consented resources', () => assert(candidate.package.totalBytes <= base.resourceEnvelope.maxCandidateBytes));
test('candidate file count stays inside consented resources', () => assert(candidate.package.files.length <= base.resourceEnvelope.maxCandidateFiles));
test('candidate paths pass portable Windows-aware checks', () => assert(Builder.validateCandidatePaths(Object.keys(candidate.files)).pass));
test('output bytes are self-measured', () => assert.strictEqual(result.resourceObservation.outputBytes, Builder.jsonBytes(result)));
test('input bytes are measured', () => assert.strictEqual(result.resourceObservation.inputBytes, Builder.jsonBytes(base)));
test('two deterministic build passes are disclosed', () => assert.strictEqual(result.resourceObservation.buildPasses, 2));
test('trusted native builder invocation is disclosed', () => assert.strictEqual(result.truth.nativeBuilderInvoked, true));
test('transient candidate bytes are disclosed', () => assert.strictEqual(result.truth.candidateBytesGeneratedTransiently, true));
test('no child process was spawned', () => assert.strictEqual(result.resourceObservation.processesSpawned, 0));
test('no provider was called', () => assert.strictEqual(result.resourceObservation.providerCalled, false));
test('no network was used', () => assert.strictEqual(result.resourceObservation.networkUsed, false));
test('no workspace content was read', () => assert.strictEqual(result.resourceObservation.workspaceRead, false));
test('no workspace content was written', () => assert.strictEqual(result.resourceObservation.workspaceWritten, false));
test('candidate was not executed', () => assert.strictEqual(result.resourceObservation.candidateExecuted, false));
test('generated selftest was not executed', () => assert.strictEqual(result.resourceObservation.generatedSelftestExecuted, false));
test('runtime evidence remains UNKNOWN', () => assert.strictEqual(result.evidence.runtimeBehavior, 'UNKNOWN'));
test('emitted selftest evidence says not run', () => assert.strictEqual(result.evidence.emittedSelftest, 'EMITTED_NOT_RUN'));
test('organ intent is not called implementation proof', () => assert.strictEqual(result.truth.organIntentProvesImplementationSemantics, false));
test('specialist profile is not called capability proof', () => assert.strictEqual(result.truth.specialistProfileProvesCapability, false));
test('candidate runtime is not called proven', () => assert.strictEqual(result.truth.candidateRuntimeProven, false));
test('candidate remains detached', () => assert.strictEqual(result.truth.candidateDetached, true));
test('candidate is not installed', () => assert.strictEqual(result.truth.installed, false));
test('candidate is not integrated', () => assert.strictEqual(result.truth.integrated, false));
test('candidate is not published', () => assert.strictEqual(result.truth.published, false));
test('candidate is not promoted', () => assert.strictEqual(result.truth.promoted, false));
test('candidate cannot change CANON', () => assert.strictEqual(result.truth.canonChanged, false));
test('Mike remains final merge gate', () => assert.strictEqual(result.truth.mikeFinalMergeGatePreserved, true));
test('direct reuse remains on hold', () => assert.strictEqual(result.reuseRights.mode, 'RESEARCH_ONLY_DIRECT_REUSE_HOLD'));
test('public copying remains unauthorized', () => assert.strictEqual(result.reuseRights.publicCopyAuthorized, false));
test('capability gap report is READY only for this exact rung', () => assert.deepStrictEqual(result.capabilityGapReport.missingCapabilities, []));
test('next gate is exact candidate review before sandbox decision', () => assert.strictEqual(result.nextGate, 'HUMAN_REVIEW_EXACT_CANDIDATE_BYTES_BEFORE_SEPARATE_SANDBOX_DECISION'));

test('markup example request is sealed under the v1.9 identity', () => assert.strictEqual(markupBase.version, Builder.VERSION));
test('markup example produces one detached candidate', () => assert.strictEqual(markupResult.status, 'COMPLETE_DETACHED_CANDIDATE'));
test('markup result verifies through an exact independent rebuild', () => assert.deepStrictEqual(Builder.verify(markupResult, markupBase), { pass: true, errors: [] }));
test('markup generation is byte-identical for identical input', () => assert.strictEqual(Builder.canonicalJson(markupResult), Builder.canonicalJson(Builder.generate(markupBase))));
test('markup selection binds the exact markup-structure specialist', () => assert.strictEqual(markupResult.specialistContext.specialistOrganRef.id, 'organ.code.markup-structure'));
test('markup selection binds the exact game-index artifact', () => assert.strictEqual(markupResult.specialistContext.artifactRef.id, 'game-index'));
test('markup selection binds the exact HTML build profile and language', () => assert.strictEqual(markupResult.specialistContext.buildProfileRef.id, 'code-family.static-html-page') && assert.strictEqual(markupResult.specialistContext.languageId, 'html'));
test('markup candidate binds the exact admitted HTML recipe', () => assert.deepStrictEqual(markupResult.recipeRef, Builder.MARKUP_TARGET_RECIPE));
test('markup build request is human reviewed and Code Fabric bound', () => assert.strictEqual(markupBase.capabilityBuildRequest.humanReviewed, true) && assert.strictEqual(markupBase.capabilityBuildRequest.source.kind, 'CODE_FABRIC'));
test('markup build request binds the exact intent plan', () => assert.strictEqual(markupBase.capabilityBuildRequest.source.ref, markupBase.intentAdapterPlan.planDigest));
test('markup consent binds the exact recipe digest', () => assert.strictEqual(markupResult.consentRef.subject.recipeDigest, Builder.MARKUP_TARGET_RECIPE.digest));
test('markup candidate is EXPERIMENTAL', () => assert.strictEqual(markupCandidate.package.status, 'EXPERIMENTAL'));
test('markup candidate remains structurally verified', () => assert(CapabilityFabric.verifyCandidate(markupCandidate).ok));
test('markup candidate contains inert generated capability text', () => assert.strictEqual(typeof markupCandidate.files['capability.js'], 'string'));
test('markup candidate contains an emitted but unrun selftest', () => assert.strictEqual(markupResult.evidence.emittedSelftest, 'EMITTED_NOT_RUN'));
test('markup generated source declares an HTML document', () => assert(markupCandidate.files['capability.js'].includes('<!doctype html>')));
test('markup generated source declares language and viewport structure', () => assert(markupCandidate.files['capability.js'].includes('<html lang=') && markupCandidate.files['capability.js'].includes('name=\\\"viewport\\\"')));
test('markup generated source contains semantic header and main structure', () => assert(markupCandidate.files['capability.js'].includes('<header>') && markupCandidate.files['capability.js'].includes('<main id=\\\"content\\\">')));
test('markup generated source contains the reviewed escaping rules', () => assert(markupCandidate.files['capability.js'].includes('&amp;') && markupCandidate.files['capability.js'].includes('&lt;') && markupCandidate.files['capability.js'].includes('&#39;')));
test('markup generated source contains no script element', () => assert(!/<script\b/i.test(markupCandidate.files['capability.js'])));
test('markup generated source contains no inline event attribute', () => assert(!/\son[a-z]+\s*=/i.test(markupCandidate.files['capability.js'])));
test('markup generated source imports no filesystem or child process', () => assert(!/require\(['"](?:fs|node:fs|child_process|node:child_process)['"]\)/.test(markupCandidate.files['capability.js'])));
test('markup generated source contains no fetch or dynamic evaluation', () => assert(!/\bfetch\s*\(|new Function|\beval\s*\(/.test(markupCandidate.files['capability.js'])));
test('markup runtime remains UNKNOWN because candidate was not run', () => assert.strictEqual(markupResult.evidence.runtimeBehavior, 'UNKNOWN'));
test('markup visual behavior remains UNKNOWN because no browser render occurred', () => assert.strictEqual(markupResult.evidence.visualBehavior, 'UNKNOWN'));
test('markup candidate and generated selftest were not executed', () => assert.strictEqual(markupResult.resourceObservation.candidateExecuted, false) && assert.strictEqual(markupResult.resourceObservation.generatedSelftestExecuted, false));
test('markup candidate grants no authority or permissions', () => { assert(Object.values(markupCandidate.package.authority).every((value) => value === false)); assert.deepStrictEqual(JSON.parse(markupCandidate.files['module.contract.json']).permissions, []); });
test('markup candidate remains detached and unintegrated', () => assert.strictEqual(markupResult.truth.candidateDetached, true) && assert.strictEqual(markupResult.truth.integrated, false));
test('markup output stays inside the exact candidate resource ceiling', () => assert(markupCandidate.package.totalBytes <= markupBase.resourceEnvelope.maxCandidateBytes && markupCandidate.package.files.length <= markupBase.resourceEnvelope.maxCandidateFiles));
test('markup visual limitation is retained', () => assert(markupResult.limitations.includes('HTML_VISUAL_ACCESSIBILITY_AND_INTERACTION_BEHAVIOR_NOT_PROVEN')));

test('root HOLD stops before intent verification and build', () => {
  const originalVerify = IntentAdapter.verify, originalBuild = CapabilityFabric.build;
  let verified = 0, built = 0;
  IntentAdapter.verify = function () { verified += 1; return originalVerify.apply(this, arguments); };
  CapabilityFabric.build = function () { built += 1; return originalBuild.apply(this, arguments); };
  try { const heldResult = held(base, (next) => { next.rootsGate[0].verdict = 'HOLD'; }, 'ROOTS_HOLD'); assert.strictEqual(heldResult.evidence.intentRebuild, 'NOT_RUN'); assert.strictEqual(verified, 0); assert.strictEqual(built, 0); }
  finally { IntentAdapter.verify = originalVerify; CapabilityFabric.build = originalBuild; }
});
test('root FAIL stops before candidate generation', () => assert.strictEqual(held(base, (next) => { next.rootsGate[2].verdict = 'FAIL'; }, 'ROOTS_HOLD').truth.candidateGenerated, false));
test('root order drift is refused', () => assert.throws(() => changed(base, (next) => next.rootsGate.reverse()), /root order/i));
test('unknown request fields are refused', () => assert.throws(() => changed(base, (next) => { next.surprise = true; }), /fields mismatch/i));
test('request digest drift is refused', () => { const next = clone(base); next.id = 'changed-id'; assert.throws(() => Builder.generate(next), /digest mismatch/i); });
test('forged intent plan is held', () => held(base, (next) => { next.intentAdapterPlan.truth.canonChanged = true; }, 'INTENT_LINEAGE_HOLD'));
test('stale intent plan status is held', () => held(base, (next) => { next.intentAdapterPlan.status = 'ROOTS_HOLD'; }, 'INTENT_LINEAGE_HOLD'));
test('specialist digest drift is held', () => held(base, (next) => { next.selection.specialistOrganRef.sha256 = Builder.sha256Value('drift'); }, 'SPECIALIST_HOLD'));
test('build profile digest drift is held', () => held(base, (next) => { next.selection.buildProfileRef.sha256 = Builder.sha256Value('drift'); }, 'SPECIALIST_HOLD'));
test('artifact selection drift is held', () => held(base, (next) => { next.selection.artifactId = 'game-rules'; }, 'SPECIALIST_HOLD'));
test('application-logic specialist remains an unsupported typed hold', () => {
  const next = clone(base), intentRequest = IntentAdapter.buildExampleRequest(), intentPlan = IntentAdapter.plan(intentRequest);
  next.intentAdapterRequest = intentRequest; next.intentAdapterPlan = intentPlan;
  next.selection = { artifactId: intentPlan.specialistContext.artifactPlan.artifactRef.id, specialistOrganRef: intentPlan.specialistContext.selectedLane.organRef, buildProfileRef: clone(base.selection.buildProfileRef), mode: 'ONE_EXACT_DATA_SCHEMA_SPECIALIST' };
  const heldResult = Builder.generate(resealOuter(next)); assert.strictEqual(heldResult.status, 'SPECIALIST_HOLD'); assert(heldResult.capabilityGapReport.missingCapabilities.includes('code.specialist.data-schema.exact-lane'));
});
test('markup lane cannot be relabelled as the data-schema mode', () => held(markupBase, (next) => { next.selection.mode = 'ONE_EXACT_DATA_SCHEMA_SPECIALIST'; }, 'SPECIALIST_HOLD'));
test('data-schema lane cannot be relabelled as the markup mode', () => held(base, (next) => { next.selection.mode = 'ONE_EXACT_MARKUP_STRUCTURE_SPECIALIST'; }, 'SPECIALIST_HOLD'));
test('unsupported selection mode is refused before planning', () => assert.throws(() => changed(markupBase, (next) => { next.selection.mode = 'UNIVERSAL_CODE_SPECIALIST'; }), /selection mode/i));
test('unreviewed markup build request is held', () => held(markupBase, (next) => { const draft = clone(next.capabilityBuildRequest); delete draft.requestDigest; next.capabilityBuildRequest = CapabilityFabric.sealRequest(draft, false); }, 'BUILD_REQUEST_HOLD'));
test('markup recipe substitution is held', () => held(markupBase, (next) => { const catalog = CapabilityFabric.loadCatalog(), recipe = catalog.recipes.find((row) => row.id === 'svg-status-badge'), draft = clone(recipe.exampleRequest); draft.source = { kind: 'CODE_FABRIC', ref: next.intentAdapterPlan.planDigest }; next.capabilityBuildRequest = CapabilityFabric.sealRequest(draft, true); }, 'BUILD_REQUEST_HOLD'));
test('markup family drift is held', () => held(markupBase, (next) => { const draft = clone(next.capabilityBuildRequest); delete draft.requestDigest; draft.family = 'creation-hand'; next.capabilityBuildRequest = CapabilityFabric.sealRequest(draft, true); }, 'BUILD_REQUEST_HOLD'));
test('markup parameter expansion is held by the exact build plan', () => held(markupBase, (next) => { const draft = clone(next.capabilityBuildRequest); delete draft.requestDigest; draft.parameters.inlineScript = 'alert(1)'; next.capabilityBuildRequest = CapabilityFabric.sealRequest(draft, true); next.consent.subject.capabilityRequestDigest = next.capabilityBuildRequest.requestDigest; }, 'BUILD_PLAN_HOLD'));
test('markup language outside the reviewed contract is held by the build plan', () => held(markupBase, (next) => { const draft = clone(next.capabilityBuildRequest); delete draft.requestDigest; draft.parameters.language = 'en-us<script>'; next.capabilityBuildRequest = CapabilityFabric.sealRequest(draft, true); next.consent.subject.capabilityRequestDigest = next.capabilityBuildRequest.requestDigest; }, 'BUILD_PLAN_HOLD'));
test('markup section ceiling expansion is held by the build plan', () => held(markupBase, (next) => { const draft = clone(next.capabilityBuildRequest); delete draft.requestDigest; draft.parameters.maxSections = 25; next.capabilityBuildRequest = CapabilityFabric.sealRequest(draft, true); next.consent.subject.capabilityRequestDigest = next.capabilityBuildRequest.requestDigest; }, 'BUILD_PLAN_HOLD'));
test('markup native builder refusal becomes a typed candidate hold', () => { const heldResult = held(markupBase, (next) => { const draft = clone(next.capabilityBuildRequest); delete draft.requestDigest; draft.parameters.defaultIntro = 'unsafe\u0000intro'; next.capabilityBuildRequest = CapabilityFabric.sealRequest(draft, true); next.consent.subject.capabilityRequestDigest = next.capabilityBuildRequest.requestDigest; }, 'CANDIDATE_HOLD'); assert.strictEqual(heldResult.holds[0].code, 'NATIVE_BUILDER_REFUSAL'); assert.strictEqual(heldResult.truth.candidateBytesGeneratedTransiently, false); });
test('markup consent recipe drift is held', () => held(markupBase, (next) => { next.consent.subject.recipeDigest = Builder.sha256Value('wrong-markup-recipe'); }, 'CONSENT_HOLD'));
test('markup candidate byte overflow becomes a typed hold', () => held(markupBase, (next) => { next.resourceEnvelope.maxCandidateBytes = 1; }, 'CANDIDATE_HOLD'));
test('markup candidate tampering fails exact result verification', () => { const tampered = clone(markupResult); tampered.detachedCandidate.files['capability.js'] += '\n// drift'; delete tampered.resultDigest; tampered.resultDigest = Builder.sha256Value(tampered); assert.strictEqual(Builder.verify(tampered, markupBase).pass, false); });
test('markup catalog lineage drift becomes a recipe hold', () => {
  const original = CapabilityFabric.loadCatalog;
  CapabilityFabric.loadCatalog = function () { const catalog = clone(original()); const recipe = catalog.recipes.find((row) => row.id === 'static-accessible-html-page'); recipe.recipeDigest = Builder.sha256Value('markup-drift'); return catalog; };
  try { assert.strictEqual(Builder.generate(markupBase).status, 'RECIPE_HOLD'); }
  finally { CapabilityFabric.loadCatalog = original; }
});
test('unreviewed capability request is held', () => held(base, (next) => { const draft = clone(next.capabilityBuildRequest); delete draft.requestDigest; next.capabilityBuildRequest = CapabilityFabric.sealRequest(draft, false); }, 'BUILD_REQUEST_HOLD'));
test('wrong recipe is held', () => held(base, (next) => { const catalog = CapabilityFabric.loadCatalog(), recipe = catalog.recipes.find((row) => row.id === 'pure-json-transform'), draft = clone(recipe.exampleRequest); draft.source = { kind: 'CODE_FABRIC', ref: next.intentAdapterPlan.planDigest }; next.capabilityBuildRequest = CapabilityFabric.sealRequest(draft, true); }, 'BUILD_REQUEST_HOLD'));
test('external build-request source is held', () => held(base, (next) => { const draft = clone(next.capabilityBuildRequest); delete draft.requestDigest; draft.source.kind = 'EXTERNAL'; next.capabilityBuildRequest = CapabilityFabric.sealRequest(draft, true); }, 'BUILD_REQUEST_HOLD'));
test('build-request source lineage drift is held', () => held(base, (next) => { const draft = clone(next.capabilityBuildRequest); delete draft.requestDigest; draft.source.ref = Builder.sha256Value('wrong-intent'); next.capabilityBuildRequest = CapabilityFabric.sealRequest(draft, true); }, 'BUILD_REQUEST_HOLD'));
test('consent intent digest drift is held', () => held(base, (next) => { next.consent.subject.intentPlanDigest = Builder.sha256Value('wrong-intent'); }, 'CONSENT_HOLD'));
test('consent request digest drift is held', () => held(base, (next) => { next.consent.subject.capabilityRequestDigest = Builder.sha256Value('wrong-request'); }, 'CONSENT_HOLD'));
test('consent catalog digest drift is held', () => held(base, (next) => { next.consent.subject.catalogDigest = Builder.sha256Value('wrong-catalog'); }, 'CONSENT_HOLD'));
test('consent recipe digest drift is held', () => held(base, (next) => { next.consent.subject.recipeDigest = Builder.sha256Value('wrong-recipe'); }, 'CONSENT_HOLD'));
test('consent build-profile catalog drift is held', () => held(base, (next) => { next.consent.subject.buildProfileCatalogDigest = Builder.sha256Value('wrong-profile-catalog'); }, 'CONSENT_HOLD'));
test('consent build-profile digest drift is held', () => held(base, (next) => { next.consent.subject.buildProfileDigest = Builder.sha256Value('wrong-profile'); }, 'CONSENT_HOLD'));
test('tier escalation is refused', () => assert.throws(() => changed(base, (next) => { next.consent.tier = 'TIER_2_SANDBOX_EXECUTION'; }), /tier/i));
test('revoked consent is refused', () => assert.throws(() => changed(base, (next) => { next.consent.revoked = true; }), /revocation/i));
test('invalid replay state is refused', () => assert.throws(() => changed(base, (next) => { next.consent.replayState = 'PROVEN'; }), /replay state/i));
test('malformed nonce is refused', () => assert.throws(() => changed(base, (next) => { next.consent.nonce = 'short'; }), /nonce/i));
test('expired-at-evaluation consent is refused', () => assert.throws(() => changed(base, (next) => { next.consent.expiresAt = next.consent.evaluatedAt; }), /validity window/i));
test('consent longer than 24 hours is refused', () => assert.throws(() => changed(base, (next) => { next.consent.expiresAt = '2026-08-25T21:00:00.000Z'; }), /24 hours/i));
test('candidate-count expansion is refused', () => assert.throws(() => changed(base, (next) => { next.consent.scope.candidateCount = 2; }), /scope/i));
test('candidate-execution consent is refused', () => assert.throws(() => changed(base, (next) => { next.consent.scope.candidateExecution = true; }), /scope/i));
test('workspace-write consent is refused', () => assert.throws(() => changed(base, (next) => { next.consent.scope.workspaceWrite = true; }), /scope/i));
test('permission expansion is refused', () => assert.throws(() => changed(base, (next) => { next.consent.scope.permissions = ['filesystem-write']; }), /permission/i));
test('network expansion is refused', () => assert.throws(() => changed(base, (next) => { next.consent.scope.networkDomains = ['example.test']; }), /network/i));
test('installation consent is refused', () => assert.throws(() => changed(base, (next) => { next.consent.scope.install = true; }), /scope/i));
test('integration consent is refused', () => assert.throws(() => changed(base, (next) => { next.consent.scope.integrate = true; }), /scope/i));
test('publication consent is refused', () => assert.throws(() => changed(base, (next) => { next.consent.scope.publish = true; }), /scope/i));
test('promotion consent is refused', () => assert.throws(() => changed(base, (next) => { next.consent.scope.promote = true; }), /scope/i));
test('CANON consent is refused', () => assert.throws(() => changed(base, (next) => { next.consent.scope.canon = true; }), /scope/i));
test('direct-reuse expansion is refused', () => assert.throws(() => changed(base, (next) => { next.reuseRights.directReuseAuthorized = true; }), /reuse-rights/i));
test('public-copy expansion is refused', () => assert.throws(() => changed(base, (next) => { next.reuseRights.publicCopyAuthorized = true; }), /reuse-rights/i));
test('external-source claim is refused', () => assert.throws(() => changed(base, (next) => { next.reuseRights.externalSourceBytesIncluded = true; }), /reuse-rights/i));
test('third build pass is refused', () => assert.throws(() => changed(base, (next) => { next.resourceEnvelope.maxBuildPasses = 3; }), /resource authority/i));
test('second attempt is refused', () => assert.throws(() => changed(base, (next) => { next.resourceEnvelope.maxAttempts = 2; }), /resource authority/i));
test('child process authority is refused', () => assert.throws(() => changed(base, (next) => { next.resourceEnvelope.maxProcesses = 1; }), /resource authority/i));
test('nonzero cost authority is refused', () => assert.throws(() => changed(base, (next) => { next.resourceEnvelope.maxCostMinorUnits = 1; }), /resource authority/i));
test('input byte overflow is refused before build', () => assert.throws(() => Builder.generate(changed(base, (next) => { next.resourceEnvelope.maxInputBytes = 1; })), /maxInputBytes/i));
test('output byte overflow is refused', () => assert.throws(() => Builder.generate(changed(base, (next) => { next.resourceEnvelope.maxOutputBytes = 1; })), /maxOutputBytes/i));
test('candidate byte budget produces a typed hold', () => { const heldResult = held(base, (next) => { next.resourceEnvelope.maxCandidateBytes = 1; }, 'CANDIDATE_HOLD'); assert.strictEqual(heldResult.capabilityGapReport.overall, 'DEGRADED'); assert.strictEqual(heldResult.resourceObservation.buildPasses, 2); assert.strictEqual(heldResult.truth.candidateBytesGeneratedTransiently, true); });
test('candidate file budget produces a typed hold', () => held(base, (next) => { next.resourceEnvelope.maxCandidateFiles = 1; }, 'CANDIDATE_HOLD'));
test('catalog drift produces a typed recipe hold', () => {
  const original = CapabilityFabric.loadCatalog;
  CapabilityFabric.loadCatalog = function () { const catalog = clone(original()); catalog.catalogDigest = Builder.sha256Value('drifted-catalog'); return catalog; };
  try { assert.strictEqual(Builder.generate(base).status, 'RECIPE_HOLD'); }
  finally { CapabilityFabric.loadCatalog = original; }
});
test('build-plan authority drift is held before candidate build', () => {
  const original = CapabilityFabric.planBuild;
  CapabilityFabric.planBuild = function () { const plan = clone(original.apply(this, arguments)); plan.authority.promoted = true; return plan; };
  try { assert.strictEqual(Builder.generate(base).status, 'BUILD_PLAN_HOLD'); }
  finally { CapabilityFabric.planBuild = original; }
});
test('tampered candidate bytes fail result verification', () => { const tampered = clone(result); tampered.detachedCandidate.files['capability.js'] += '\n// drift'; delete tampered.resultDigest; tampered.resultDigest = Builder.sha256Value(tampered); assert.strictEqual(Builder.verify(tampered, base).pass, false); });
test('tampered result authority fails verification', () => { const tampered = clone(result); tampered.truth.promoted = true; delete tampered.resultDigest; tampered.resultDigest = Builder.sha256Value(tampered); assert.strictEqual(Builder.verify(tampered, base).pass, false); });
test('drive-qualified candidate paths are refused', () => assert.strictEqual(Builder.validateCandidatePaths(['C:/candidate.js']).pass, false));
test('UNC-like candidate paths are refused', () => assert.strictEqual(Builder.validateCandidatePaths(['//server/share.js']).pass, false));
test('backslash candidate paths are refused', () => assert.strictEqual(Builder.validateCandidatePaths(['folder\\candidate.js']).pass, false));
test('alternate data streams are refused', () => assert.strictEqual(Builder.validateCandidatePaths(['candidate.js:stream']).pass, false));
test('NUL path aliases are refused', () => assert.strictEqual(Builder.validateCandidatePaths(['candidate\0.js']).pass, false));
test('parent traversal is refused', () => assert.strictEqual(Builder.validateCandidatePaths(['../candidate.js']).pass, false));
test('dot traversal is refused', () => assert.strictEqual(Builder.validateCandidatePaths(['./candidate.js']).pass, false));
test('Windows reserved device names are refused', () => assert.strictEqual(Builder.validateCandidatePaths(['CON']).pass, false));
test('Windows reserved device basenames with extensions are refused', () => assert.strictEqual(Builder.validateCandidatePaths(['aux.json']).pass, false));
test('trailing-dot aliases are refused', () => assert.strictEqual(Builder.validateCandidatePaths(['candidate.js.']).pass, false));
test('trailing-space aliases are refused', () => assert.strictEqual(Builder.validateCandidatePaths(['candidate.js ']).pass, false));
test('case-fold path collisions are refused', () => assert.strictEqual(Builder.validateCandidatePaths(['A.js', 'a.js']).pass, false));
test('portable nested paths remain accepted', () => assert.strictEqual(Builder.validateCandidatePaths(['src/candidate.js', 'tests/candidate.test.js']).pass, true));
test('module contract is TEST', () => assert.strictEqual(Builder.MODULE_CONTRACT.status, 'TEST'));
test('module contract grants no permissions', () => assert.deepStrictEqual(Builder.MODULE_CONTRACT.permissions, []));
test('module contract declares no writes', () => assert.deepStrictEqual(Builder.MODULE_CONTRACT.boundaries.writes, []));
test('module contract refuses generated selftest execution', () => assert(Builder.MODULE_CONTRACT.boundaries.refuses.includes('generated-selftest-execution')));
test('module contract refuses candidate execution', () => assert(Builder.MODULE_CONTRACT.boundaries.refuses.includes('candidate-execution')));
test('module contract refuses installation', () => assert(Builder.MODULE_CONTRACT.boundaries.refuses.includes('installation')));
test('module contract refuses CANON change', () => assert(Builder.MODULE_CONTRACT.boundaries.refuses.includes('canon-change')));
test('request schema is closed', () => assert.strictEqual(requestSchema.additionalProperties, false));
test('result schema is closed', () => assert.strictEqual(resultSchema.additionalProperties, false));
test('active recipe schema knows the admitted validator builder', () => assert(capabilityRecipeSchema.properties.builderId.enum.includes('closed-json-schema-validator-v1')));
test('active recipe schema knows the admitted HTML page builder', () => assert(capabilityRecipeSchema.properties.builderId.enum.includes('static-accessible-html-page-v1')));
test('candidate package schema knows the admitted validator builder', () => assert(candidatePackageSchema.$defs ? candidatePackageSchema.properties.recipeRef.properties.builderId.enum.includes('closed-json-schema-validator-v1') : false));
test('candidate package schema knows the admitted HTML page builder', () => assert(candidatePackageSchema.properties.recipeRef.properties.builderId.enum.includes('static-accessible-html-page-v1')));
test('candidate package schema knows the admitted review-skill builder', () => assert(candidatePackageSchema.properties.recipeRef.properties.builderId.enum.includes('bounded-review-procedure-skill-v1')));
test('request schema admits a profile-resolved mode token', () => assert.strictEqual(requestSchema.properties.selection.properties.mode.pattern, '^[A-Z][A-Z0-9_]{2,127}$'));
test('request schema requires an exact build-profile reference', () => assert(requestSchema.properties.selection.required.includes('buildProfileRef')));
test('result schema accepts registered recipe refs while runtime code resolves exact bytes', () => assert.strictEqual(resultSchema.$defs.recipeRef.properties.digest.$ref, 'semantic-common.schema.json#/$defs/digest'));
test('result schema preserves UNKNOWN visual evidence for markup', () => assert(resultSchema.$defs.evidence.properties.visualBehavior.enum.includes('UNKNOWN')));
test('source contains no filesystem module import', () => assert(!/require\(['"](?:fs|node:fs)['"]\)/.test(fs.readFileSync(sourcePath, 'utf8'))));
test('source contains no child-process module import', () => assert(!/require\(['"](?:child_process|node:child_process)['"]\)/.test(fs.readFileSync(sourcePath, 'utf8'))));
test('source contains no fetch call', () => assert(!/\bfetch\s*\(/.test(fs.readFileSync(sourcePath, 'utf8'))));
test('source never invokes generated candidate text', () => assert(!/new Function|\beval\s*\(|vm\.(?:run|compile)/.test(fs.readFileSync(sourcePath, 'utf8'))));

if (!process.exitCode) process.stdout.write('Code specialist capability builder v1.9 selftest: ' + passed + ' PASS\n');
