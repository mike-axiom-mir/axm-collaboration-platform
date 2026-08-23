'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Core = require('./semantic-candidate-generator-v1');

const VERSION = '0.2.0';
const DECISION_SCHEMA = 'axm.game-test-promotion-decision/v1';
const REQUEST_SCHEMA = 'axm.adventure-content-growth-request/v1';
const PACKET_SCHEMA = 'axm.adventure-content-release-packet/v1';
const CONTENT_SCHEMA = 'axm.four-roots-adventure-content/v1';
const GENERATOR_ID = 'axm-native-adventure-content-recipe-engine';
const RECIPE_ID = 'four-roots-adventure-content-v0.2';
const CONTENT_PATH = 'content/adventure-content.v0.2.json';
const INSTALL_TARGET = 'tools/game-hub/game-library/020-four-roots-adventure';
const RECIPE_FILE = path.resolve(__dirname, '..', '..', INSTALL_TARGET, CONTENT_PATH);
const ROOTS = ['truth', 'agency-non-domination', 'continuity', 'wisdom-over-speed'];
const ANCESTOR = Object.freeze({
  candidateId: 'four-roots-run-native',
  candidateVersion: 'v0.1',
  sourceCommit: '41cfa3401cc45bfb890e7fa4ad55b41d24c6c16b',
  requestDigest: 'sha256:d3b129dff29b3c045633513057d88d0fd8155d28711f8cfee4fab1370ac9c86d',
  packetDigest: 'sha256:0f92db03251710f34c8b50ea13d30e2a910336d3d0d6ceb884824d68951416c7',
  bundleDigest: 'sha256:934c6600a6f5e919f0189e6efc0d60c0f35b0e46bbc1096f3c33c9054afe8358',
  liveIterationDigest: 'sha256:9ad3bfe37db7c90e6d98ff24636d1a1b39c04b58ab4714401b1b521de286a408'
});
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const ID = /^[a-z0-9][a-z0-9._-]{1,127}$/;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) { return Core.canonicalJson(value); }
function same(left, right) { return canonical(left) === canonical(right); }
function bytes(value) { return Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8'); }
function hashBuffer(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
function hashValue(value) { return hashBuffer(Buffer.from(canonical(value), 'utf8')); }
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  return value;
}
function exact(value, keys, label) {
  object(value, label);
  const found = Object.keys(value).sort();
  const expected = keys.slice().sort();
  if (!same(found, expected)) throw new Error(label + ' fields must be exactly: ' + expected.join(', '));
}
function boundedText(value, label, max) {
  if (typeof value !== 'string' || value.trim() !== value || value.length < 1 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error(label + ' must be bounded text');
  return value;
}
function portableId(value, label) {
  value = boundedText(value, label, 128);
  if (!ID.test(value)) throw new Error(label + ' must be a portable id');
  return value;
}
function digest(value, label) {
  if (typeof value !== 'string' || !DIGEST.test(value)) throw new Error(label + ' must be a SHA-256 digest');
  return value;
}
function uniqueStrings(values, label, allowed) {
  if (!Array.isArray(values)) throw new Error(label + ' must be an array');
  const seen = new Set();
  return values.map((value, index) => {
    value = portableId(value, label + '[' + index + ']');
    if (seen.has(value)) throw new Error(label + ' contains a duplicate');
    if (allowed && !allowed.has(value)) throw new Error(label + ' references an unknown id: ' + value);
    seen.add(value);
    return value;
  });
}

function normalizeReference(value, label) {
  exact(value, ['id', 'schema', 'sha256'], label);
  return {
    id: portableId(value.id, label + '.id'),
    schema: boundedText(value.schema, label + '.schema', 220),
    sha256: digest(value.sha256, label + '.sha256')
  };
}

function sealDecision(value) {
  exact(value, ['schema', 'decisionId', 'decidedBy', 'decisionSource', 'authenticatedIdentityProven', 'scope', 'source', 'target', 'authorizes', 'refuses', 'publicReuseRights', 'statementDigest', 'authority'], 'promotion decision');
  if (value.schema !== DECISION_SCHEMA || value.decidedBy !== 'MIKE_TOBI' || value.decisionSource !== 'EXPLICIT_IN_THREAD_DIRECTION' || value.authenticatedIdentityProven !== false || value.scope !== 'INTERNAL_WORKSHOP_TEST' || value.authority !== 'RECORDED_HUMAN_DIRECTION') throw new Error('promotion decision identity or scope mismatch');
  exact(value.source, ['candidateId', 'candidateVersion', 'sourceCommit', 'requestDigest', 'packetDigest', 'bundleDigest', 'liveIterationDigest'], 'promotion decision.source');
  if (!same(value.source, ANCESTOR) || !COMMIT.test(value.source.sourceCommit)) throw new Error('promotion decision does not bind the proven v0.1 ancestor');
  exact(value.target, ['slot', 'gameId', 'relativePath', 'status'], 'promotion decision.target');
  if (value.target.slot !== '020' || value.target.gameId !== '020-four-roots-adventure' || value.target.relativePath !== INSTALL_TARGET || value.target.status !== 'TEST') throw new Error('promotion decision target is not exact Workshop TEST slot 020');
  exact(value.authorizes, ['installExactAncestorReference', 'installTrustedAdventureShell', 'materializeExactGeneratedContent', 'preserveRollback'], 'promotion decision.authorizes');
  if (Object.values(value.authorizes).some((entry) => entry !== true)) throw new Error('promotion decision must explicitly authorize each bounded branch action');
  exact(value.refuses, ['canonicalCheckoutOverwrite', 'canon', 'foundationMutation', 'publicRelease', 'selfPromotion'], 'promotion decision.refuses');
  if (Object.values(value.refuses).some((entry) => entry !== true)) throw new Error('promotion decision must retain every refusal');
  exact(value.publicReuseRights, ['state', 'directPublicReuseAllowed'], 'promotion decision.publicReuseRights');
  if (value.publicReuseRights.state !== 'HOLD' || value.publicReuseRights.directPublicReuseAllowed !== false) throw new Error('public reuse rights remain held');
  const core = {
    schema: DECISION_SCHEMA,
    decisionId: portableId(value.decisionId, 'promotion decision.decisionId'),
    decidedBy: 'MIKE_TOBI', decisionSource: 'EXPLICIT_IN_THREAD_DIRECTION', authenticatedIdentityProven: false,
    scope: 'INTERNAL_WORKSHOP_TEST', source: clone(ANCESTOR), target: clone(value.target),
    authorizes: clone(value.authorizes), refuses: clone(value.refuses), publicReuseRights: clone(value.publicReuseRights),
    statementDigest: digest(value.statementDigest, 'promotion decision.statementDigest'), authority: 'RECORDED_HUMAN_DIRECTION'
  };
  return { ...core, decisionDigest: hashValue(core) };
}

function normalizeDecision(value) {
  exact(value, ['schema', 'decisionId', 'decidedBy', 'decisionSource', 'authenticatedIdentityProven', 'scope', 'source', 'target', 'authorizes', 'refuses', 'publicReuseRights', 'statementDigest', 'authority', 'decisionDigest'], 'promotion decision');
  const { decisionDigest, ...core } = value;
  const sealed = sealDecision(core);
  if (sealed.decisionDigest !== digest(decisionDigest, 'promotion decision.decisionDigest') || !same(sealed, value)) throw new Error('promotion decision digest or canonical form mismatch');
  return sealed;
}

function normalizeRootGate(values) {
  if (!Array.isArray(values) || values.length !== ROOTS.length) throw new Error('rootsGate must contain exactly the four roots');
  return values.map((entry, index) => {
    exact(entry, ['root', 'verdict', 'evidenceRefs'], 'rootsGate[' + index + ']');
    if (entry.root !== ROOTS[index] || entry.verdict !== 'PASS') throw new Error('ROOTS_GATE_HOLD:' + ROOTS[index]);
    if (!Array.isArray(entry.evidenceRefs) || entry.evidenceRefs.length < 1 || entry.evidenceRefs.length > 8) throw new Error('root evidence is required');
    return { root: entry.root, verdict: 'PASS', evidenceRefs: entry.evidenceRefs.map((ref, n) => normalizeReference(ref, 'rootsGate[' + index + '].evidenceRefs[' + n + ']')) };
  });
}

function sealRequest(value) {
  exact(value, ['schema', 'id', 'goal', 'decision', 'ancestorPacketRef', 'rootsGate', 'resources', 'reuseRights', 'authority'], 'growth request');
  if (value.schema !== REQUEST_SCHEMA || value.authority !== 'NONE') throw new Error('growth request identity mismatch');
  const decision = normalizeDecision(value.decision);
  const ancestorPacketRef = normalizeReference(value.ancestorPacketRef, 'growth request.ancestorPacketRef');
  if (ancestorPacketRef.id !== ANCESTOR.candidateId || ancestorPacketRef.schema !== 'axm.game-candidate-packet/v1' || ancestorPacketRef.sha256 !== ANCESTOR.packetDigest) throw new Error('growth request ancestor packet drift');
  exact(value.resources, ['maxRecipeBytes', 'maxPacketBytes', 'maxFiles', 'maxRuntimeProcesses', 'maxNetworkRequests'], 'growth request.resources');
  const resources = clone(value.resources);
  if (!Number.isSafeInteger(resources.maxRecipeBytes) || resources.maxRecipeBytes < 1 || resources.maxRecipeBytes > 262144 || !Number.isSafeInteger(resources.maxPacketBytes) || resources.maxPacketBytes < resources.maxRecipeBytes || resources.maxPacketBytes > 1048576 || resources.maxFiles !== 1 || resources.maxRuntimeProcesses !== 0 || resources.maxNetworkRequests !== 0) throw new Error('growth request resources exceed the deterministic content-only envelope');
  exact(value.reuseRights, ['internalWorkshopUse', 'publicDirectReuse'], 'growth request.reuseRights');
  if (value.reuseRights.internalWorkshopUse !== 'MIKE_AUTHORIZED_TEST' || value.reuseRights.publicDirectReuse !== 'HOLD') throw new Error('growth request reuse-rights scope drift');
  const core = {
    schema: REQUEST_SCHEMA, id: portableId(value.id, 'growth request.id'), goal: boundedText(value.goal, 'growth request.goal', 600),
    decision, ancestorPacketRef, rootsGate: normalizeRootGate(value.rootsGate), resources, reuseRights: clone(value.reuseRights), authority: 'NONE'
  };
  return { ...core, requestDigest: hashValue(core) };
}

function normalizeRequest(value) {
  exact(value, ['schema', 'id', 'goal', 'decision', 'ancestorPacketRef', 'rootsGate', 'resources', 'reuseRights', 'authority', 'requestDigest'], 'growth request');
  const { requestDigest, ...core } = value;
  const sealed = sealRequest(core);
  if (sealed.requestDigest !== digest(requestDigest, 'growth request.requestDigest') || !same(sealed, value)) throw new Error('growth request digest or canonical form mismatch');
  return sealed;
}

function validateConditions(value, label, known) {
  exact(value, ['allFlags', 'notFlags', 'allRoots', 'allItems'], label);
  return {
    allFlags: uniqueStrings(value.allFlags, label + '.allFlags'), notFlags: uniqueStrings(value.notFlags, label + '.notFlags'),
    allRoots: uniqueStrings(value.allRoots, label + '.allRoots', known.roots), allItems: uniqueStrings(value.allItems, label + '.allItems', known.items)
  };
}

function validateContent(value) {
  exact(value, ['schema', 'id', 'version', 'status', 'title', 'tagline', 'introMessage', 'ancestor', 'roots', 'items', 'quests', 'zones', 'ending', 'authority', 'limitations'], 'adventure content');
  if (value.schema !== CONTENT_SCHEMA || value.id !== RECIPE_ID || value.version !== VERSION || value.status !== 'TEST' || !same(value.ancestor, ANCESTOR)) throw new Error('adventure content identity or ancestor mismatch');
  boundedText(value.title, 'adventure content.title', 100); boundedText(value.tagline, 'adventure content.tagline', 240); boundedText(value.introMessage, 'adventure content.introMessage', 600);
  if (!Array.isArray(value.roots) || value.roots.length !== 4) throw new Error('adventure content requires four roots');
  const rootIds = new Set();
  value.roots.forEach((root, index) => {
    exact(root, ['id', 'name', 'color', 'description'], 'roots[' + index + ']');
    if (root.id !== ROOTS[index] || !/^#[0-9a-f]{6}$/i.test(root.color)) throw new Error('root identity or color mismatch');
    boundedText(root.name, 'root.name', 80); boundedText(root.description, 'root.description', 240); rootIds.add(root.id);
  });
  if (!Array.isArray(value.items) || value.items.length < 4 || value.items.length > 32) throw new Error('adventure content item count is invalid');
  const itemIds = new Set();
  value.items.forEach((item, index) => {
    exact(item, ['id', 'name', 'description'], 'items[' + index + ']');
    const id = portableId(item.id, 'items[' + index + '].id'); if (itemIds.has(id)) throw new Error('duplicate item id'); itemIds.add(id);
    boundedText(item.name, 'item.name', 80); boundedText(item.description, 'item.description', 240);
  });
  const known = { roots: rootIds, items: itemIds };
  if (!Array.isArray(value.quests) || value.quests.length < 6 || value.quests.length > 16) throw new Error('adventure content quest count is invalid');
  const questIds = new Set();
  value.quests.forEach((quest, index) => {
    exact(quest, ['id', 'title', 'description', 'conditions'], 'quests[' + index + ']');
    const id = portableId(quest.id, 'quest.id'); if (questIds.has(id)) throw new Error('duplicate quest id'); questIds.add(id);
    boundedText(quest.title, 'quest.title', 100); boundedText(quest.description, 'quest.description', 300);
    exact(quest.conditions, ['allFlags', 'allRoots', 'allItems', 'completed'], 'quest.conditions');
    uniqueStrings(quest.conditions.allFlags, 'quest.conditions.allFlags'); uniqueStrings(quest.conditions.allRoots, 'quest.conditions.allRoots', rootIds); uniqueStrings(quest.conditions.allItems, 'quest.conditions.allItems', itemIds);
    if (typeof quest.conditions.completed !== 'boolean') throw new Error('quest.conditions.completed must be boolean');
  });
  if (!Array.isArray(value.zones) || value.zones.length !== 5) throw new Error('adventure content requires exactly five zones');
  const zoneIds = new Set(value.zones.map((zone, index) => portableId(object(zone, 'zones[' + index + ']').id, 'zone.id')));
  if (zoneIds.size !== value.zones.length || !zoneIds.has('crossroads')) throw new Error('zone ids must be unique and include crossroads');
  const actorIds = new Set();
  value.zones.forEach((zone, zoneIndex) => {
    exact(zone, ['id', 'name', 'subtitle', 'accent', 'map', 'spawn', 'actors'], 'zones[' + zoneIndex + ']');
    boundedText(zone.name, 'zone.name', 100); boundedText(zone.subtitle, 'zone.subtitle', 240);
    if (!/^#[0-9a-f]{6}$/i.test(zone.accent) || !Array.isArray(zone.map) || zone.map.length !== 11 || zone.map.some((row) => typeof row !== 'string' || row.length !== 15 || !/^[.#~]+$/.test(row))) throw new Error('zone map or accent is invalid: ' + zone.id);
    exact(zone.spawn, ['x', 'y'], 'zone.spawn');
    if (!Number.isInteger(zone.spawn.x) || !Number.isInteger(zone.spawn.y) || zone.map[zone.spawn.y]?.[zone.spawn.x] !== '.') throw new Error('zone spawn is not passable: ' + zone.id);
    if (!Array.isArray(zone.actors) || zone.actors.length < 1 || zone.actors.length > 16) throw new Error('zone actors are invalid');
    zone.actors.forEach((actor, actorIndex) => {
      exact(actor, ['id', 'label', 'glyph', 'kind', 'x', 'y', 'requires', 'grants', 'travel', 'complete', 'message', 'repeatMessage', 'blockedMessage'], 'actor[' + actorIndex + ']');
      const actorId = portableId(actor.id, 'actor.id'); if (actorIds.has(actorId)) throw new Error('duplicate actor id'); actorIds.add(actorId);
      boundedText(actor.label, 'actor.label', 100); boundedText(actor.glyph, 'actor.glyph', 4); boundedText(actor.kind, 'actor.kind', 30);
      if (!Number.isInteger(actor.x) || !Number.isInteger(actor.y) || zone.map[actor.y]?.[actor.x] !== '.') throw new Error('actor is not on passable terrain: ' + actor.id);
      validateConditions(actor.requires, 'actor.requires', known);
      exact(actor.grants, ['flags', 'roots', 'items'], 'actor.grants');
      uniqueStrings(actor.grants.flags, 'actor.grants.flags'); uniqueStrings(actor.grants.roots, 'actor.grants.roots', rootIds); uniqueStrings(actor.grants.items, 'actor.grants.items', itemIds);
      if (actor.travel !== null) {
        exact(actor.travel, ['zoneId', 'x', 'y'], 'actor.travel');
        if (!zoneIds.has(actor.travel.zoneId) || !Number.isInteger(actor.travel.x) || !Number.isInteger(actor.travel.y)) throw new Error('actor travel target is invalid');
      }
      if (typeof actor.complete !== 'boolean') throw new Error('actor.complete must be boolean');
      boundedText(actor.message, 'actor.message', 700); boundedText(actor.repeatMessage, 'actor.repeatMessage', 400); boundedText(actor.blockedMessage, 'actor.blockedMessage', 400);
    });
  });
  exact(value.ending, ['title', 'message', 'next'], 'ending');
  boundedText(value.ending.title, 'ending.title', 100); boundedText(value.ending.message, 'ending.message', 700); boundedText(value.ending.next, 'ending.next', 300);
  exact(value.authority, ['generatedCodeCanInstall', 'generatedCodeCanPromote', 'generatedCodeCanCanonize', 'runtimeCanModifyFoundation', 'runtimeCanUseOutboundNetwork', 'finalMergeGate'], 'content.authority');
  for (const key of ['generatedCodeCanInstall', 'generatedCodeCanPromote', 'generatedCodeCanCanonize', 'runtimeCanModifyFoundation', 'runtimeCanUseOutboundNetwork']) if (value.authority[key] !== false) throw new Error('content authority escalation: ' + key);
  if (value.authority.finalMergeGate !== 'MIKE_TOBI') throw new Error('final merge gate drift');
  if (!Array.isArray(value.limitations) || value.limitations.length < 5 || value.limitations.length > 24) throw new Error('content limitations are required');
  value.limitations.forEach((entry, index) => boundedText(entry, 'limitations[' + index + ']', 120));
  return clone(value);
}

function readRecipe() {
  const sourceBytes = fs.readFileSync(RECIPE_FILE);
  if (sourceBytes.length > 262144) throw new Error('adventure content recipe exceeds hard byte ceiling');
  const parsed = JSON.parse(sourceBytes.toString('utf8'));
  const content = validateContent(parsed);
  if (!same(content, parsed)) throw new Error('adventure content recipe normalization drift');
  const recipeBytes = Buffer.from(sourceBytes.toString('utf8').replace(/\r\n?/g, '\n'), 'utf8');
  return { content, recipeBytes, sourceByteLength: sourceBytes.length };
}

function generate(input) {
  const request = normalizeRequest(input);
  const { content, recipeBytes, sourceByteLength } = readRecipe();
  if (recipeBytes.length > request.resources.maxRecipeBytes || sourceByteLength > request.resources.maxRecipeBytes) throw new Error('recipe exceeds request maxRecipeBytes');
  const contentDigest = hashBuffer(recipeBytes);
  const core = {
    schema: PACKET_SCHEMA, version: VERSION, status: 'TEST_CONTENT_CANDIDATE', releaseId: RECIPE_ID,
    requestRef: { id: request.id, schema: request.schema, sha256: request.requestDigest },
    decisionRef: { id: request.decision.decisionId, schema: request.decision.schema, sha256: request.decision.decisionDigest },
    ancestorRef: { id: ANCESTOR.candidateId, schema: 'axm.game-candidate-packet/v1', sha256: ANCESTOR.packetDigest },
    generator: { id: GENERATOR_ID, version: VERSION, recipeId: RECIPE_ID, aiUsed: false },
    contentFile: { path: CONTENT_PATH, sha256: contentDigest, byteLength: recipeBytes.length, content: recipeBytes.toString('base64') },
    contentSummary: { zones: content.zones.length, actors: content.zones.reduce((sum, zone) => sum + zone.actors.length, 0), quests: content.quests.length, roots: content.roots.length, hasEnding: Boolean(content.ending) },
    installPlan: { targetRoot: INSTALL_TARGET, materialize: [CONTENT_PATH], overwriteExisting: false, status: 'TEST', canon: false, requiresHostApplication: true },
    declaredAuthority: { permissions: [], networkDomains: [], lifecycleEffects: [] },
    resources: { files: 1, recipeBytes: recipeBytes.length, runtimeProcesses: 0, networkRequests: 0, enforced: true },
    reuseRights: clone(request.reuseRights), limitations: clone(content.limitations),
    truth: { deterministicBytes: true, providerCalled: false, runtimeExecuted: false, workspaceWritten: false, installedByGenerator: false, promotedByGenerator: false, canonChanged: false }, authority: 'NONE'
  };
  const packet = { ...core, packetDigest: hashValue(core) };
  if (bytes(packet).length > request.resources.maxPacketBytes) throw new Error('release packet exceeds maxPacketBytes');
  return { request, packet };
}

function verifyGeneration(result, input) {
  try {
    const rebuilt = generate(input);
    return same(result, rebuilt) ? { pass: true, errors: [] } : { pass: false, errors: ['result differs from deterministic rebuild'] };
  } catch (error) { return { pass: false, errors: [error.message] }; }
}

function buildExampleDecision() {
  const statement = 'Mike directed promotion of the proven Four Roots Run into Workshop TEST and bounded growth into a fuller adventure; CANON and public release remain separate.';
  return sealDecision({
    schema: DECISION_SCHEMA, decisionId: 'mike-four-roots-adventure-test-promotion-20260823', decidedBy: 'MIKE_TOBI',
    decisionSource: 'EXPLICIT_IN_THREAD_DIRECTION', authenticatedIdentityProven: false, scope: 'INTERNAL_WORKSHOP_TEST', source: clone(ANCESTOR),
    target: { slot: '020', gameId: '020-four-roots-adventure', relativePath: INSTALL_TARGET, status: 'TEST' },
    authorizes: { installExactAncestorReference: true, installTrustedAdventureShell: true, materializeExactGeneratedContent: true, preserveRollback: true },
    refuses: { canonicalCheckoutOverwrite: true, canon: true, foundationMutation: true, publicRelease: true, selfPromotion: true },
    publicReuseRights: { state: 'HOLD', directPublicReuseAllowed: false }, statementDigest: hashValue(statement), authority: 'RECORDED_HUMAN_DIRECTION'
  });
}

function buildExampleRequest() {
  const decision = buildExampleDecision();
  return sealRequest({
    schema: REQUEST_SCHEMA, id: 'grow-four-roots-adventure-v0.2',
    goal: 'Generate one immutable, byte-bound adventure content release from the proven Four Roots Run ancestor for a separately installed Workshop TEST shell.',
    decision, ancestorPacketRef: { id: ANCESTOR.candidateId, schema: 'axm.game-candidate-packet/v1', sha256: ANCESTOR.packetDigest },
    rootsGate: ROOTS.map((root) => ({ root, verdict: 'PASS', evidenceRefs: [{ id: 'four-roots-adventure-' + root, schema: 'axm.four-root-technical-review/v1', sha256: hashValue('four-roots-adventure-v0.2:' + root) }] })),
    resources: { maxRecipeBytes: 262144, maxPacketBytes: 1048576, maxFiles: 1, maxRuntimeProcesses: 0, maxNetworkRequests: 0 },
    reuseRights: { internalWorkshopUse: 'MIKE_AUTHORIZED_TEST', publicDirectReuse: 'HOLD' }, authority: 'NONE'
  });
}

module.exports = {
  VERSION, DECISION_SCHEMA, REQUEST_SCHEMA, PACKET_SCHEMA, CONTENT_SCHEMA, GENERATOR_ID, RECIPE_ID, CONTENT_PATH, INSTALL_TARGET, RECIPE_FILE, ROOTS, ANCESTOR,
  clone, canonical, hashBuffer, hashValue, sealDecision, normalizeDecision, sealRequest, normalizeRequest, validateContent, readRecipe, generate, verifyGeneration,
  buildExampleDecision, buildExampleRequest
};
