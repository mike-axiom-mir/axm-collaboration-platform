'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Generator = require('./deterministic-game-candidate-generator-v1');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; process.stdout.write('PASS ' + name + '\n'); }
  catch (error) { process.stderr.write('FAIL ' + name + ': ' + error.message + '\n'); throw error; }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function fileBytes(result, name) {
  const file = result.packet.moduleBundle.files.find((item) => item.path === name);
  assert(file, 'missing file ' + name);
  const bytes = Buffer.from(file.content, 'base64');
  assert.strictEqual(file.sha256, require('crypto').createHash('sha256').update(bytes).digest('hex'));
  return bytes;
}
function generatedApi(result) {
  const sandbox = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(fileBytes(result, 'game.js').toString('utf8'), sandbox, { filename: 'generated-twin-reactor-game.js', timeout: 1000 });
  return sandbox.module.exports;
}

const request = Generator.buildCoopExampleRequest();
const result = Generator.generate(request);
const api = generatedApi(result);

test('co-op request and packet bind the exact second recipe', () => {
  assert.strictEqual(request.brief.recipeId, Generator.COOP_RECIPE_ID);
  assert.deepStrictEqual(Generator.SUPPORTED_RECIPE_IDS, [Generator.RECIPE_ID, Generator.COOP_RECIPE_ID]);
  assert.strictEqual(request.brief.session.players, 2);
  assert.strictEqual(result.packet.generator.recipeId, Generator.COOP_RECIPE_ID);
  assert.strictEqual(result.packet.moduleBundle.requiredSeats, 2);
  assert.deepStrictEqual(result.packet.sourceFiles.map((item) => item.path), Generator.REQUIRED_FILES);
  assert.strictEqual(result.packet.candidate.id, 'twin-reactor-coop-native');
  assert.strictEqual(result.packet.candidate.version, 'v0.4');
});

test('co-op generation is byte-identical and fully byte-bound', () => {
  const repeated = Generator.generate(clone(request));
  assert.deepStrictEqual(result, repeated);
  assert.strictEqual(Generator.verifyGeneration(result, request).pass, true);
  let total = 0;
  for (const ref of result.packet.sourceFiles) {
    const bytes = fileBytes(result, ref.path); total += bytes.length;
    assert.strictEqual(ref.byteLength, bytes.length);
    assert.strictEqual(ref.sha256, 'sha256:' + result.packet.moduleBundle.files.find((item) => item.path === ref.path).sha256);
  }
  assert.strictEqual(total, result.packet.resources.sourceBytes);
});

test('legacy one-player packet remains byte-identical to the v2.19 base', () => {
  const legacy = Generator.generate(Generator.buildExampleRequest());
  assert.strictEqual(legacy.packet.packetDigest, 'sha256:3f2548636dc9f6b5836d55faa6fc1569706536595361ac43bf2c19bb12df140d');
  assert.strictEqual(legacy.packet.generator.recipeId, Generator.RECIPE_ID);
  assert.strictEqual(legacy.packet.moduleBundle.requiredSeats, 1);
});

test('recipe, world, and player-count ambiguity fails closed', () => {
  const base = clone(request.brief); delete base.briefDigest;
  for (const mutate of [
    (value) => { value.recipeId = 'unknown-game'; },
    (value) => { value.world.width = 16; },
    (value) => { value.world.height = 10; },
    (value) => { value.session.players = 1; },
    (value) => { value.session.network = 'OPTIONAL'; },
    (value) => { value.session.persistence = 'LOCAL'; }
  ]) {
    const hostile = clone(base); mutate(hostile);
    assert.throws(() => Generator.sealBrief(hostile), /identity|world|scope/);
  }
});

test('generated project, config, manifest, and contract preserve two-seat scope', () => {
  const project = JSON.parse(fileBytes(result, 'game-forge-project.json'));
  const config = JSON.parse(fileBytes(result, 'game.config.json'));
  const manifest = JSON.parse(fileBytes(result, 'sandbox.game.json'));
  const contract = JSON.parse(fileBytes(result, 'module.contract.json'));
  assert.strictEqual(project.world.cells.length, 30 * 17);
  assert.strictEqual(project.version, '0.4.0');
  assert.strictEqual(project.capabilityPlan.schema, 'axm.game-prebuild-plan/v1');
  assert.strictEqual(config.schema, 'axm.local-coop-action-game-config/v1');
  assert.strictEqual(config.session.players, 2);
  assert.notDeepStrictEqual(config.inputs.p1, config.inputs.p2);
  assert.deepStrictEqual(manifest.controls, ['p1-keyboard', 'p2-keyboard', 'visible-lifecycle-buttons']);
  assert(contract.provides.includes('axm.local-two-player-action-coop/v1'));
  assert(contract.provides.includes('axm.deterministic-directional-combat/v1'));
  assert(contract.provides.includes('axm.proximity-coop-bonus/v1'));
  assert(contract.provides.includes('axm.shared-objective-repair-loop/v1'));
  assert(contract.provides.includes('axm.visible-boss-practice-route/v1'));
  assert(contract.provides.includes('axm.asset-aware-game-prebuild/v1'));
  assert(contract.provides.includes('axm.known-repair-before-build/v1'));
  assert(contract.provides.includes('axm.catalog-informed-game-rendering/v1'));
  assert(contract.provides.includes('axm.game-first-experience-flow/v1'));
  assert(contract.provides.includes('axm.staged-review-disclosure/v1'));
  assert.deepStrictEqual(contract.permissions, []);
  assert(contract.boundaries.refuses.includes('hidden-player-seat-merging'));
});

test('asset capability snapshot and prebuild plan are byte-bound candidate data', () => {
  const snapshot = JSON.parse(fileBytes(result, 'asset-capability-snapshot.json'));
  const plan = JSON.parse(fileBytes(result, 'prebuild-plan.json'));
  const receipt = JSON.parse(fileBytes(result, 'candidate.receipt.json'));
  assert.strictEqual(snapshot.schema, 'axm.asset-factory-capability-snapshot/v1');
  assert.strictEqual(plan.schema, 'axm.game-prebuild-plan/v1');
  assert.strictEqual(result.packet.assetCapabilitySnapshotRef.sha256, result.packet.sourceFiles.find((item) => item.path === 'asset-capability-snapshot.json').sha256);
  assert.strictEqual(result.packet.prebuildPlanRef.sha256, result.packet.sourceFiles.find((item) => item.path === 'prebuild-plan.json').sha256);
  assert.strictEqual(receipt.prebuild.snapshotRef.sha256, snapshot.snapshotDigest);
  assert.strictEqual(receipt.prebuild.planRef.sha256, plan.planDigest);
});

test('experience flow is built before source and byte-bound into every candidate layer', () => {
  const flow = JSON.parse(fileBytes(result, 'experience-flow-plan.json'));
  const config = JSON.parse(fileBytes(result, 'game.config.json'));
  const project = JSON.parse(fileBytes(result, 'game-forge-project.json'));
  const manifest = JSON.parse(fileBytes(result, 'sandbox.game.json'));
  const receipt = JSON.parse(fileBytes(result, 'candidate.receipt.json'));
  assert.strictEqual(flow.schema, 'axm.game-experience-flow-plan/v1');
  assert.deepStrictEqual(flow.scenes.map((item) => item.id), ['LOBBY', 'MISSION_INTRO', 'ACTIVE_PLAY', 'WAVE_TRANSITION', 'WARDEN_INTRO', 'PAUSED', 'VICTORY', 'DEFEAT']);
  assert.strictEqual(result.packet.experienceFlowPlanRef.sha256, result.packet.sourceFiles.find((item) => item.path === 'experience-flow-plan.json').sha256);
  assert.strictEqual(config.experience.planDigest, flow.planDigest);
  assert.strictEqual(project.experiencePlan.sha256, flow.planDigest);
  assert.strictEqual(manifest.experienceFlowPlan, 'experience-flow-plan.json');
  assert.strictEqual(receipt.prebuild.experienceFlowRef.sha256, flow.planDigest);
  assert.strictEqual(result.packet.generator.experienceDirected, true);
  assert.strictEqual(result.packet.truth.experienceFlowPlanned, true);
});

test('game-first page stages technical truth instead of pinning a test panel beside play', () => {
  const html = fileBytes(result, 'index.html').toString('utf8');
  assert.match(html, /id="scene-overlay"/);
  assert.match(html, /id="transition-banner"/);
  assert.match(html, /<details id="review-drawer"/);
  assert.match(html, /Review build truth/);
  assert.doesNotMatch(html, /class="layout"/);
  assert.doesNotMatch(html, /class="panel"/);
  assert.doesNotMatch(html, /class="asset-strip"/);
});

test('known repairs and selected visual system exist before game source bytes', () => {
  const config = JSON.parse(fileBytes(result, 'game.config.json'));
  const plan = JSON.parse(fileBytes(result, 'prebuild-plan.json'));
  assert(config.prebuild.appliedRepairs.includes('projectile-spawn-and-swept-collision-v1'));
  assert(plan.repairs.every((item) => item.state === 'APPLIED_BEFORE_BUILD'));
  assert.strictEqual(config.visual.stylePresetId, 'arcade-neon-circuit');
  assert.strictEqual(config.visual.treatmentId, 'aetherglass-cinematic');
  assert.deepStrictEqual(config.visual.effectIds, ['glow', 'gradientBorder', 'scanlines', 'spotlight', 'vignette']);
});

test('asset declarations never become produced-artifact or provider-execution claims', () => {
  const snapshot = JSON.parse(fileBytes(result, 'asset-capability-snapshot.json'));
  const plan = JSON.parse(fileBytes(result, 'prebuild-plan.json'));
  const receipt = JSON.parse(fileBytes(result, 'candidate.receipt.json'));
  assert(snapshot.declaredHands.every((item) => item.artifactProduced === false));
  assert(plan.assetRoutes.every((item) => item.artifactProduced === false));
  assert.strictEqual(receipt.truth.assetProviderExecuted, false);
  assert.strictEqual(receipt.truth.assetArtifactsProduced, false);
  assert.strictEqual(result.truth.assetProviderExecuted, false);
  assert.strictEqual(result.truth.assetArtifactsProduced, false);
});

test('generated source exposes a deterministic pure engine and no ambient host dependency', () => {
  assert.strictEqual(typeof api.createEngine, 'function');
  const source = fileBytes(result, 'game.js').toString('utf8');
  for (const forbidden of [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /localStorage/, /sessionStorage/, /indexedDB/, /\beval\s*\(/, /new\s+Function/, /Math\.random/, /Date\.now/, /process\.env/, /child_process/]) assert.strictEqual(forbidden.test(source), false, String(forbidden));
  assert.strictEqual(result.truth.providerCalled, false);
  assert.strictEqual(result.truth.candidateCodeExecuted, false);
  assert.strictEqual(result.truth.workspaceWritten, false);
  assert.strictEqual(result.truth.networkUsed, false);
});

test('P1 and P2 movement are independently addressable', () => {
  const engine = api.createEngine(); engine.start();
  const before = engine.snapshot();
  engine.step({ 'p1-right': true }); const p1 = engine.snapshot();
  assert(p1.players[0].x > before.players[0].x);
  assert.strictEqual(p1.players[1].x, before.players[1].x);
  engine.step({ 'p2-left': true }); const p2 = engine.snapshot();
  assert(p2.players[1].x < p1.players[1].x);
  assert.strictEqual(p2.players[0].x, p1.players[0].x);
});

test('both seats can attack and score without merging identities', () => {
  const p1Engine = api.createEngine('FINAL_WAVE');
  p1Engine.step({ 'p1-attack': true });
  assert.strictEqual(p1Engine.snapshot().players[0].score, 1);
  assert.strictEqual(p1Engine.snapshot().players[1].score, 0);
  const p2Engine = api.createEngine('FINAL_WAVE_P2');
  p2Engine.step({ 'p2-attack': true });
  assert.strictEqual(p2Engine.snapshot().players[0].score, 0);
  assert.strictEqual(p2Engine.snapshot().players[1].score, 1);
});

test('directional bolts expose an exact proximity-link damage bonus', () => {
  const linked = api.createEngine('LINK_DAMAGE');
  linked.step({ 'p1-attack': true });
  assert.strictEqual(linked.snapshot().linked, true);
  assert.strictEqual(linked.snapshot().enemies[0].hp, 1);
  const separated = api.createEngine('LINK_DAMAGE_SEPARATED');
  separated.step({ 'p1-attack': true });
  assert.strictEqual(separated.snapshot().linked, false);
  assert.strictEqual(separated.snapshot().enemies[0].hp, 2);
});

test('repair cores restore bounded shared reactor health through a visible player pickup', () => {
  const engine = api.createEngine('REPAIR_CORE');
  engine.step({});
  const state = engine.snapshot();
  assert.strictEqual(state.reactor.health, 76);
  assert.strictEqual(state.repairCores.length, 0);
  assert.strictEqual(state.players[0].cores, 1);
  assert.match(state.message, /restored the reactor/i);
});

test('wave-three Warden is typed, durable, and inside the same enemy ceiling', () => {
  const state = api.createEngine('WARDEN').snapshot();
  assert.strictEqual(state.enemies.length, 1);
  assert.strictEqual(state.enemies[0].kind, 'warden');
  assert.strictEqual(state.enemies[0].hp, 8);
  assert.strictEqual(state.enemies[0].maxHp, 8);
  assert.strictEqual(state.reactor.health, 76);
});

test('a bolt spawned inside the Warden hits instead of tunneling past it', () => {
  const engine = api.createEngine('WARDEN_OVERLAP');
  engine.step({ 'p1-attack': true });
  assert.strictEqual(engine.snapshot().enemies[0].hp, 6);
});

test('dash is bounded by an exact cooldown', () => {
  const normal = api.createEngine(); normal.start();
  const dashed = api.createEngine(); dashed.start();
  const x = normal.snapshot().players[0].x;
  normal.step({ 'p1-right': true });
  dashed.step({ 'p1-right': true, 'p1-dash': true });
  assert(dashed.snapshot().players[0].x - x > normal.snapshot().players[0].x - x);
  const afterDash = dashed.snapshot().players[0].x;
  dashed.step({ 'p1-right': true, 'p1-dash': true });
  assert.strictEqual(dashed.snapshot().players[0].x - afterDash, 3);
});

test('nearby partner revives while a downed player cannot self-revive', () => {
  const engine = api.createEngine('REVIVE');
  engine.step({ 'p2-attack': true });
  assert.strictEqual(engine.snapshot().players[1].reviveProgress, 0);
  for (let index = 0; index < 36; index += 1) engine.step({ 'p1-attack': true });
  const state = engine.snapshot();
  assert.strictEqual(state.players[1].down, false);
  assert.strictEqual(state.players[1].hp, 1);
  assert.match(state.message, /revived/i);
});

test('distant attack cannot revive a partner', () => {
  const engine = api.createEngine('REVIVE');
  for (let index = 0; index < 55; index += 1) engine.step({ 'p1-left': true });
  for (let index = 0; index < 40; index += 1) engine.step({ 'p1-attack': true });
  assert.strictEqual(engine.snapshot().players[1].down, true);
  assert.strictEqual(engine.snapshot().players[1].reviveProgress, 0);
});

test('reactor loss and both-downed loss produce one shared defeat', () => {
  for (const scenario of ['REACTOR_LOSS', 'BOTH_DOWN']) {
    const engine = api.createEngine(scenario); engine.step({});
    const state = engine.snapshot();
    assert.strictEqual(state.phase, 'DEFEAT');
    assert.strictEqual(state.sharedOutcome, 'DEFEAT');
  }
});

test('clearing the final wave produces one shared victory', () => {
  const engine = api.createEngine('FINAL_WAVE');
  engine.step({ 'p1-attack': true });
  for (let index = 0; index < 42; index += 1) engine.step({});
  const state = engine.snapshot();
  assert.strictEqual(state.phase, 'VICTORY');
  assert.strictEqual(state.sharedOutcome, 'VICTORY');
  assert.strictEqual(state.players.length, 2);
});

test('identical two-seat traces replay identically and stay inside the entity cap', () => {
  const trace = [
    { 'p1-right': true, 'p2-left': true }, { 'p1-up': true, 'p2-down': true },
    { 'p1-attack': true }, { 'p2-attack': true }, { 'p1-dash': true, 'p1-right': true }, {}
  ];
  const left = api.createEngine(), right = api.createEngine(); left.start(); right.start();
  for (let repeat = 0; repeat < 40; repeat += 1) for (const input of trace) { left.step(input); right.step(clone(input)); }
  assert.deepStrictEqual(left.snapshot(), right.snapshot());
  assert(left.snapshot().enemies.length <= 18);
  assert(left.snapshot().projectiles.length <= 24);
  assert(left.snapshot().repairCores.length <= 6);
});

test('pause freezes simulation and reset returns exact ready state', () => {
  const engine = api.createEngine(); engine.start(); engine.step({ 'p1-right': true }); engine.pause();
  const paused = engine.snapshot(); engine.step({ 'p1-right': true, 'p2-left': true });
  assert.deepStrictEqual(engine.snapshot(), paused);
  engine.reset(); const reset = engine.snapshot();
  assert.strictEqual(reset.phase, 'READY'); assert.strictEqual(reset.tick, 0);
  assert.strictEqual(reset.reactor.health, 100); assert.strictEqual(reset.enemies.length, 0);
});

test('candidate retains reuse, installation, promotion, and CANON holds', () => {
  const gap = JSON.parse(fileBytes(result, 'installation-gap.json'));
  assert.strictEqual(result.packet.reuseRights.state, 'RESEARCH_ONLY_HOLD');
  assert.deepStrictEqual(result.packet.declaredAuthority, { permissions: [], networkDomains: [], lifecycleEffects: [] });
  assert.strictEqual(result.packet.truth.installed, false);
  assert.strictEqual(result.packet.truth.integrated, false);
  assert.strictEqual(result.packet.truth.promoted, false);
  assert.strictEqual(result.packet.truth.canonChanged, false);
  assert.strictEqual(gap.installAllowed, false);
  assert.strictEqual(gap.nextGate, 'MIKE_INSTALLATION_DECISION');
});

test('schema files stay closed and enumerate exactly the two admitted recipes', () => {
  const briefSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'game-generation-brief.schema.json'), 'utf8'));
  const packetSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'game-candidate-packet.schema.json'), 'utf8'));
  assert.strictEqual(briefSchema.additionalProperties, false);
  assert.deepStrictEqual(briefSchema.properties.recipeId.enum, Generator.SUPPORTED_RECIPE_IDS);
  assert.deepStrictEqual(packetSchema.properties.generator.properties.recipeId.enum, Generator.SUPPORTED_RECIPE_IDS);
});

process.stdout.write('PASS local co-op action game recipe (' + passed + ' cases)\n');
