#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Bridge = require('./code-recipe-fabric-bridge-v1');
const Semantic = require('./semantic-candidate-generator-v1');

let checks = 0;

function check(value, message) {
  assert.ok(value, message);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function rejects(fn, pattern, message) {
  assert.throws(fn, pattern);
  checks += 1;
  process.stdout.write('PASS ' + message + '\n');
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function hexDigest(value) { return Bridge.digestValue(value).slice('sha256:'.length); }

function schemaObjectNodesAreClosed(value) {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.every(schemaObjectNodesAreClosed);
  if (value.type === 'object' && value.additionalProperties !== false) return false;
  return Object.values(value).every(schemaObjectNodesAreClosed);
}

function schemaRefsResolve(file) {
  const cache = new Map();
  function read(name) {
    if (!cache.has(name)) cache.set(name, JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')));
    return cache.get(name);
  }
  function visit(value, current, seen) {
    if (!value || typeof value !== 'object') return true;
    if (Array.isArray(value)) return value.every((item) => visit(item, current, seen));
    if (typeof value.$ref === 'string') {
      const parts = value.$ref.split('#');
      const targetName = parts[0] || current;
      const fragment = parts[1] || '';
      const key = targetName + '#' + fragment;
      if (!seen.has(key)) {
        let cursor = read(targetName);
        if (fragment) {
          for (const part of fragment.replace(/^\//, '').split('/').filter(Boolean)) {
            cursor = cursor && cursor[part.replace(/~1/g, '/').replace(/~0/g, '~')];
          }
          if (cursor === undefined) return false;
        }
        const next = new Set(seen);
        next.add(key);
        if (!visit(cursor, targetName, next)) return false;
      }
    }
    return Object.values(value).every((item) => visit(item, current, seen));
  }
  return visit(read(file), file, new Set([file + '#']));
}

function requestCore(request, mutate) {
  const value = clone(request);
  delete value.requestDigest;
  mutate(value);
  return value;
}

function resealPacket(value, mutate = () => {}) {
  const packet = clone(value);
  delete packet.packetDigest;
  mutate(packet);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    packet.packetDigest = Bridge.digestValue(packet);
    const bytes = Bridge.jsonBytes(packet).length;
    if (bytes === packet.resourceObservation.packetBytes) return packet;
    delete packet.packetDigest;
    packet.resourceObservation.packetBytes = bytes;
  }
  throw new Error('test packet byte measurement did not converge');
}

const schemaFiles = [
  ['code-recipe-selection-request.schema.json', Bridge.REQUEST_SCHEMA],
  ['code-recipe-selection-packet.schema.json', Bridge.PACKET_SCHEMA]
];
check(schemaFiles.every(([file, schema]) => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')).$id === schema),
  'recipe bridge schemas bind exact public identities');
check(schemaFiles.every(([file]) => schemaObjectNodesAreClosed(JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')))),
  'recipe bridge schema object nodes are closed');
check(schemaFiles.every(([file]) => schemaRefsResolve(file)), 'recipe bridge local schema references resolve');

const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module-code-recipe-fabric-bridge-v1.contract.json'), 'utf8'));
check(contract.status === 'TEST' && contract.permissions.length === 0 && contract.boundaries.writes.length === 0 &&
  Bridge.canonicalJson(contract.rootsGate) === Bridge.canonicalJson(Bridge.ROOTS),
  'recipe bridge contract is permissionless, write-free TEST');
check(['automatic-recipe-selection', 'authenticated-human-selection-claim', 'snippet-execution', 'provider-call', 'network-use', 'direct-reuse-authorization', 'installation', 'integration', 'promotion', 'canon-change']
  .every((item) => contract.boundaries.refuses.includes(item)), 'recipe bridge contract preserves selection, execution, rights, and lifecycle holds');
const bridgeSource = fs.readFileSync(path.join(__dirname, 'code-recipe-fabric-bridge-v1.js'), 'utf8');
check(!/child_process|execSync|spawnSync|\beval\s*\(|new\s+Function|\bfetch\s*\(|XMLHttpRequest|require\(['"](?:https?|net|tls|vm)['"]\)/.test(bridgeSource),
  'bridge source exposes no execution, dynamic-code, or network entry point');
check(!/process\.env|process\.cwd|os\.homedir/.test(bridgeSource), 'bridge source does not inherit host environment or workspace location');

const installed = Bridge.loadInstalledCatalog();
check(installed.recipes.length === 1000 && installed.results.length === 1000, 'exact installed Foundry pack and audit each contain 1,000 bound records');
check(installed.pack.truth.recipeSetSha256 === '008368d22758baa0796262b9520b47e0f330700ed1e7bec5a29d1ed3e6067cd1',
  'installed 1,000-recipe set has the expected canonical digest');
check(installed.pack.truth.snippetsExecuted === false && installed.audit.truth.snippetsExecuted === false,
  'installed Foundry evidence says snippets were never executed');

const reference = Bridge.selectInstalledForTest(['CC-0001'], 'REFERENCE_ONLY');
check(Bridge.canonicalJson(Bridge.selectInstalled(reference.request)) === Bridge.canonicalJson(reference),
  'installed selection entry point requires and accepts a complete sealed request');
rejects(() => Bridge.selectInstalled(['CC-0001']), /plain object/i,
  'installed selection entry point cannot mint root decisions from a bare identity list');
check(reference.packet.selectedRecipes.length === 1 && reference.packet.selectedRecipes[0].snippet === null,
  'reference-only selection emits metadata and digest without snippet text');
check(reference.packet.selectionRequest.selectedSourceIds[0] === 'CC-0001' && reference.packet.requestRef.sha256 === reference.request.requestDigest,
  'selection packet embeds and binds its complete exact request');
check(reference.packet.reuseRights.state === 'RESEARCH_ONLY_HOLD' && reference.packet.reuseRights.directReuseAllowed === false,
  'reference-only selection preserves the direct-reuse hold');
check(reference.packet.truth.recipesSelectedAutomatically === false && reference.packet.truth.editorialRankTreatedAsQuality === false,
  'selection makes no automatic or editorial-rank quality choice');
check(reference.packet.truth.candidateGenerated === false && reference.packet.truth.candidateExecuted === false && reference.packet.truth.installed === false && reference.packet.truth.canonChanged === false,
  'selection grants no generation, execution, install, or CANON authority');
check(reference.packet.resourceObservation.processesSpawned === 0 && reference.packet.resourceObservation.networkUsed === false,
  'selection observes zero spawned processes and zero network use');
check(Bridge.canonicalJson(Bridge.normalizeInstalledSelectionPacket(reference.packet)) === Bridge.canonicalJson(reference.packet),
  'installed selection packet survives strict installed-lineage revalidation');

const heldReference = Bridge.selectInstalledForTest(['CC-0031'], 'REFERENCE_ONLY');
check(heldReference.packet.selectedRecipes[0].reviewState === 'STRUCTURE_HOLD' && heldReference.packet.selectedRecipes[0].snippet === null,
  'structurally held recipe remains inspectable only as an inert reference');
const unsupportedReference = Bridge.selectInstalledForTest(['CC-0037'], 'REFERENCE_ONLY');
check(unsupportedReference.packet.selectedRecipes[0].syntaxEvidence.status === 'CONTEXT_UNSUPPORTED',
  'unsupported syntax context remains visible in reference-only evidence');
const unavailableReference = Bridge.selectInstalledForTest(['CC-0081'], 'REFERENCE_ONLY');
check(unavailableReference.packet.selectedRecipes[0].syntaxEvidence.status === 'VERIFIER_UNAVAILABLE',
  'missing verifier remains visible instead of becoming a pass');

const research = Bridge.selectInstalledForTest(['CC-0001'], 'DETACHED_RESEARCH_CONTEXT');
const researchRecipe = research.packet.selectedRecipes[0];
check(researchRecipe.snippet === installed.recipeMap.get('CC-0001').snippet && researchRecipe.syntaxEvidence.status === 'SYNTAX_PASS',
  'detached research mode emits only the exact parse-passing installed snippet');
check(researchRecipe.snippetRef.byteLength === Buffer.byteLength(researchRecipe.snippet, 'utf8') && researchRecipe.snippetRef.sha256.startsWith('sha256:'),
  'research snippet is byte-length and digest bound');
check(research.packet.truth.snippetsIncluded === true && research.packet.truth.snippetsExecuted === false && research.packet.truth.syntaxPassIsCorrectnessProof === false,
  'included snippet remains unexecuted and parse-only');
rejects(() => Bridge.selectInstalledForTest(['CC-0031'], 'DETACHED_RESEARCH_CONTEXT'), /RECIPE_REVIEW_HOLD/i,
  'structurally held recipe cannot enter detached research context');
rejects(() => Bridge.selectInstalledForTest(['CC-0037'], 'DETACHED_RESEARCH_CONTEXT'), /RECIPE_SYNTAX_EVIDENCE_HOLD/i,
  'unsupported syntax context cannot enter detached research context');
rejects(() => Bridge.selectInstalledForTest(['CC-0081'], 'DETACHED_RESEARCH_CONTEXT'), /RECIPE_SYNTAX_EVIDENCE_HOLD/i,
  'recipe without an installed verifier cannot enter detached research context');

const orderedA = Bridge.selectInstalledForTest(['CC-0081', 'CC-0001'], 'REFERENCE_ONLY');
const orderedB = Bridge.selectInstalledForTest(['CC-0001', 'CC-0081'], 'REFERENCE_ONLY');
check(Bridge.canonicalJson(orderedA) === Bridge.canonicalJson(orderedB), 'input ordering cannot change deterministic selection bytes');
check(orderedA.packet.selectedRecipes.map((item) => item.sourceId).join(',') === 'CC-0001,CC-0081',
  'selected recipe identities use deterministic source-id order');
rejects(() => Bridge.buildExampleInstalledRequest(['CC-0001', 'CC-0001']), /duplicates/i, 'duplicate recipe identity is rejected');
rejects(() => Bridge.selectInstalledForTest(['CC-9999']), /missing/i, 'unknown but well-formed recipe identity is rejected during selection');
rejects(() => Bridge.buildExampleInstalledRequest(Array.from({ length: 17 }, (_, index) => 'CC-' + String(index + 1).padStart(4, '0'))), /bounded array/i,
  'selection count above the fixed ceiling is rejected');
for (const alias of ['cc-0001', '../CC-0001', 'C:/CC-0001', '\\\\server\\CC-0001', 'CC-0001:stream', 'CON']) {
  rejects(() => Bridge.buildExampleInstalledRequest([alias]), /invalid identity/i, 'path or Windows alias is rejected as a recipe identity: ' + JSON.stringify(alias));
}

for (const verdict of ['HOLD', 'FAIL']) {
  rejects(() => Bridge.sealRequest(requestCore(reference.request, (value) => { value.rootsGate[0].verdict = verdict; })), /ROOTS_GATE_HOLD/i,
    'four-root ' + verdict + ' stops recipe selection');
}
rejects(() => Bridge.sealRequest(requestCore(reference.request, (value) => { value.rootsGate.reverse(); })), /exact AXM root order/i,
  'four-root order drift is rejected');
rejects(() => Bridge.sealRequest(requestCore(reference.request, (value) => { value.authority = 'INSTALL'; })), /authority mismatch/i,
  'selection request cannot grant itself authority');
rejects(() => Bridge.sealRequest(requestCore(reference.request, (value) => { value.resourceEnvelope.maxProcesses = 1; })), /zero-process/i,
  'selection request cannot spawn a process');
rejects(() => Bridge.sealRequest(requestCore(reference.request, (value) => { value.resourceEnvelope.maxAttempts = 2; })), /one zero-process/i,
  'selection request cannot expand attempts');

const forgedPack = clone(installed.pack);
forgedPack.recipes[0].snippet += '\n';
forgedPack.truth.recipeSetSha256 = hexDigest(forgedPack.recipes);
const auditForForgedPack = clone(installed.audit);
auditForForgedPack.source.recipeSetSha256 = forgedPack.truth.recipeSetSha256;
auditForForgedPack.source.packSha256 = hexDigest(forgedPack);
rejects(() => Bridge.buildSelection(forgedPack, auditForForgedPack, reference.request), /catalog digest drifted/i,
  're-digested catalog-byte drift cannot impersonate the installed catalog');
const forgedAudit = clone(installed.audit);
forgedAudit.results[0].message += ' forged';
forgedAudit.resultSetSha256 = hexDigest(forgedAudit.results);
rejects(() => Bridge.buildSelection(installed.pack, forgedAudit, reference.request), /catalog digest drifted/i,
  're-digested audit drift cannot impersonate the installed audit');
const mismatchedAudit = clone(installed.audit);
mismatchedAudit.results[0].recipeId = 'recipe-0000000000000000';
mismatchedAudit.resultSetSha256 = hexDigest(mismatchedAudit.results);
rejects(() => Bridge.verifyCatalog(installed.pack, mismatchedAudit), /audit record does not match recipe/i,
  'audit-to-recipe identity mismatch fails closed');

rejects(() => Bridge.normalizeSelectionPacket(resealPacket(research.packet, (value) => { value.selectedRecipes[0].snippet += ' drift'; })), /snippet digest mismatch/i,
  'snippet byte drift is rejected even when the outer packet is re-digested');
rejects(() => Bridge.normalizeInstalledSelectionPacket(resealPacket(reference.packet, (value) => { value.selectedRecipes[0].title += ' forged'; })), /installed Foundry bytes/i,
  'forged recipe metadata is rejected against installed bytes after outer re-digest');
rejects(() => Bridge.normalizeSelectionPacket(resealPacket(reference.packet, (value) => { value.reuseRights.directReuseAllowed = true; })), /reuse-rights ceiling/i,
  'packet cannot self-authorize direct reuse');
rejects(() => Bridge.normalizeSelectionPacket(resealPacket(reference.packet, (value) => { value.truth.sourceClaimsVerified = true; })), /truth ceiling/i,
  'packet cannot self-verify source claims');
rejects(() => Bridge.normalizeSelectionPacket(resealPacket(reference.packet, (value) => { value.truth.snippetsExecuted = true; })), /truth ceiling/i,
  'packet cannot claim snippet execution');
rejects(() => Bridge.normalizeSelectionPacket(resealPacket(reference.packet, (value) => { value.truth.installed = true; })), /truth ceiling/i,
  'packet cannot claim installation');
rejects(() => Bridge.normalizeSelectionPacket(resealPacket(reference.packet, (value) => { value.truth.canonChanged = true; })), /truth ceiling/i,
  'packet cannot claim a CANON change');
rejects(() => Bridge.normalizeSelectionPacket(resealPacket(reference.packet, (value) => { value.requestRef.sha256 = 'sha256:' + 'f'.repeat(64); })), /request reference drifted/i,
  'packet cannot detach itself from its embedded selection request');
rejects(() => Bridge.normalizeSelectionPacket(resealPacket(reference.packet, (value) => {
  const core = clone(value.selectionRequest);
  delete core.requestDigest;
  core.selectedSourceIds = ['CC-0002'];
  value.selectionRequest = Bridge.sealRequest(core);
  value.requestRef = { id: value.selectionRequest.id, schema: Bridge.REQUEST_SCHEMA, sha256: value.selectionRequest.requestDigest };
})), /do not match the byte-bound request/i, 'packet recipe list cannot drift from the embedded request');
rejects(() => Bridge.normalizeSelectionPacket(resealPacket(reference.packet, (value) => {
  const core = clone(value.selectionRequest);
  delete core.requestDigest;
  core.resourceEnvelope.maxSelectedSnippetBytes = 1;
  value.selectionRequest = Bridge.sealRequest(core);
  value.requestRef = { id: value.selectionRequest.id, schema: Bridge.REQUEST_SCHEMA, sha256: value.selectionRequest.requestDigest };
})), /exceeds its byte-bound request resources/i, 'packet observations cannot exceed embedded resource ceilings');
const packetByteDrift = clone(reference.packet);
packetByteDrift.resourceObservation.packetBytes += 1;
rejects(() => Bridge.normalizeSelectionPacket(packetByteDrift), /digest|byte observation/i, 'packet byte-count drift is rejected');
const extraField = clone(reference.packet);
extraField.approved = true;
rejects(() => Bridge.normalizeSelectionPacket(extraField), /fields must be exactly/i, 'unknown emitted record fields are rejected');

const baseRequest = Semantic.buildExampleRequest();
const baseGeneration = Semantic.generate(baseRequest);
const semanticCore = clone(baseRequest);
delete semanticCore.requestDigest;
semanticCore.codeRecipeSelection = research.packet;
const selectedRequest = Semantic.sealRequest(semanticCore);
const selectedGeneration = Semantic.generate(selectedRequest);
const selectedAgain = Semantic.generate(clone(selectedRequest));
const selectionRef = Bridge.selectionPacketRef(research.packet);
check(Semantic.canonicalJson(selectedGeneration) === Semantic.canonicalJson(selectedAgain),
  'semantic generation with exact recipe context remains deterministic');
check(selectedGeneration.packets[0].lineageRefs.some((item) => Semantic.canonicalJson(item) === Semantic.canonicalJson(selectionRef)),
  'native candidate lineage binds the exact recipe selection packet');
check(selectedGeneration.reviewCards[0].sourcesUsed.some((item) => Semantic.canonicalJson(item) === Semantic.canonicalJson(selectionRef)),
  'Review Inbox data exposes the exact recipe selection source');
check(selectedGeneration.packets[0].limitations.includes('CODE_RECIPE_CONTEXT_NOT_APPLIED_TO_GENERATED_SOURCE') && selectedGeneration.packets[0].limitations.includes('CODE_RECIPE_DIRECT_REUSE_NOT_AUTHORIZED'),
  'candidate states that recipe context was neither applied nor reuse-authorized');
check(Semantic.sha256Value(selectedGeneration.packets[0].moduleBundle) === Semantic.sha256Value(baseGeneration.packets[0].moduleBundle),
  'v1 recipe context cannot silently rewrite generated candidate source');
check(Semantic.verifyGeneration(selectedGeneration, selectedRequest).pass, 'recipe-bound semantic result verifies by deterministic rebuild');
rejects(() => Semantic.sealRequest(requestCore(selectedRequest, (value) => { value.codeRecipeSelection.selectedRecipes[0].title += ' drift'; })), /digest|canonical|installed Foundry bytes/i,
  'semantic request rejects recipe packet drift');
const forgedInstalledPacket = resealPacket(reference.packet, (value) => { value.selectedRecipes[0].title += ' forged'; });
rejects(() => Semantic.sealRequest(requestCore(baseRequest, (value) => { value.codeRecipeSelection = forgedInstalledPacket; })), /installed Foundry bytes/i,
  'semantic generator rechecks installed catalog bytes instead of trusting a self-consistent packet');

process.stdout.write('CODE RECIPE FABRIC BRIDGE SELFTEST PASS (' + checks + ' checks)\n');
