#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = __dirname;
const workshop = path.resolve(root, '..', '..');
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks += 1; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks += 1; };
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const readJson = (file) => JSON.parse(read(file));

async function main() {
  const manifest = readJson('manifest.json');
  const contract = readJson('module.contract.json');
  equal(manifest.id, 'local-3d-game-runtime', 'Manifest ID');
  equal(contract.id, manifest.id, 'Contract identity');
  equal(contract.version, manifest.version, 'Contract version');
  equal(manifest.category, 'Play', 'Hub category');
  check(Array.isArray(manifest.permissions) && manifest.permissions.length === 0, 'No permissions are silently requested');
  check(new Set(contract.provides).size === contract.provides.length, 'Provided capabilities are unique');
  check(manifest.actions.length >= 4 && manifest.accepts.length === 2 && manifest.produces.length === 2, 'Hub machine metadata is populated');
  for (const refusal of ['runtime-external-network-dependency', 'full-3d-physics-or-collision-claim', 'persistence-claim', 'automatic-publication', 'ps3-or-higher-asset-quality-claim']) {
    check(contract.boundaries.refuses.includes(refusal), `Boundary refuses ${refusal}`);
  }

  const sources = ['index.html', 'styles.css', 'app.js', 'native-renderer.mjs', 'native-glb.mjs', 'native-math.mjs', 'runtime-core.mjs'].map(read).join('\n');
  const executableSources = ['app.js', 'native-renderer.mjs', 'native-glb.mjs', 'native-math.mjs', 'runtime-core.mjs'].map(read).join('\n');
  check(!/from\s+['\"]three['\"]|THREE\.|<script[^>]+three(?:\.min)?\.js/i.test(executableSources), 'No Three.js dependency');
  check(!/https?:\/\//i.test(sources), 'No external runtime URL');
  check(!/cdn|unpkg|jsdelivr/i.test(sources), 'No CDN dependency');
  check(/getContext\(['\"]webgl2['\"]/.test(sources), 'Renderer requests WebGL2');
  check(/drawElements/.test(sources), 'Renderer performs indexed GPU drawing');
  check(/QUALITY_PRESETS/.test(sources) && /PS2_BASELINE/.test(sources) && /PS3_PREVIEW/.test(sources), 'Native renderer exposes bounded render quality profiles');
  check(/uVignette/.test(sources) && /uGrain/.test(sources) && /uHighlightLift/.test(sources), 'Native shader owns the adopted presentation effects');
  check(/render-presentation-only/.test(sources), 'Quality evidence refuses an asset-quality implication');
  check(/Presentation profile only/.test(read('index.html')), 'Human UI explains the render-profile boundary');
  check(/uJoints\[/.test(sources) && /jointMatrices/.test(sources), 'Renderer contains a real skinning route');
  check(/fixed 60 Hz deterministic game state/i.test(read('README.md')), 'README names deterministic clock');
  check(/Full 3D collision and physics belong to module #17/.test(read('index.html')), 'Visible boundary names the separate physics route');
  check(/NO RUNTIME NETWORK/.test(read('index.html')), 'Visible offline boundary');
  check(/bufferedUntil\.set\(event\.code, performance\.now\(\) \+ 120\)/.test(read('app.js')), 'Quick keyboard taps survive the fixed-step boundary');
  check(/canvas\.dataset\.playerX/.test(read('app.js')), 'Machine-readable live position evidence is exposed on the canvas');
  check(/time: game\.elapsed/.test(read('app.js')) && !/time: now \/ 1000/.test(read('app.js')), 'World animation follows deterministic simulation time');
  check(/externalTextureDigests/.test(read('app.js')) && /cross-origin texture URI refused/.test(read('native-renderer.mjs')), 'External pack textures require declared digests and same-origin loading');
  const productionCell = readJson('p0-production-cell.json');
  equal(productionCell.schema, 'axm.p0-production-cell/v1', 'P0 cell schema');
  equal(productionCell.modules.length, 10, 'All ten P0 modules connect to the runtime cell');
  equal(new Set(productionCell.modules.map((module) => module.id)).size, 10, 'P0 module identities are unique');
  equal(productionCell.libraryPromotion, 'off', 'Connected candidates do not imply library promotion');

  const glb = await import(pathToFileURL(path.join(root, 'native-glb.mjs')).href);
  const runtime = await import(pathToFileURL(path.join(root, 'runtime-core.mjs')).href);
  const fixtures = [
    {
      file: path.join(workshop, 'tools', 'ps2-asset-forge', 'proof', 'exports', 'storefront-technical-proof.glb'),
      sha: 'AFCB7802418930DEE6F8B7A410F1C78CE401D4C6F8B728336E99F62458237222',
      summary: { scenes: 1, nodes: 42, meshes: 28, primitives: 28, materials: 16, textures: 10, images: 10, skins: 0, animations: 0 }
    },
    {
      file: path.join(workshop, 'tools', 'ps2-asset-forge', 'proof', 'exports', 'animated-pedestrian.glb'),
      sha: 'B448863767B1A770D70EFD45F04DDDF1BBA93B7855D1DBA7A9A6456115685D63',
      summary: { scenes: 1, nodes: 108, meshes: 13, primitives: 13, materials: 13, textures: 0, images: 0, skins: 13, animations: 22 }
    },
    {
      file: path.join(workshop, 'tools', 'ps2-asset-forge', 'assets', 'kenney', 'city-commercial', 'models', 'building-g.glb'),
      sha: '9A28FA2FDFAC07492EE95589882213CFD6EB32D6752CB3B2F5404604C676D27A',
      summary: { scenes: 1, nodes: 1, meshes: 1, primitives: 1, materials: 1, textures: 1, images: 1, skins: 0, animations: 0 },
      texture: { file: path.join(workshop, 'tools', 'ps2-asset-forge', 'assets', 'kenney', 'city-commercial', 'models', 'Textures', 'colormap.png'), sha: '191BEC3889AAACA5018380038FECC129EBB5C2182879A099B7B538B3FA050B5D' }
    },
    {
      file: path.join(workshop, 'tools', 'ps2-asset-forge', 'assets', 'kenney', 'car-kit', 'models', 'hatchback-sports.glb'),
      sha: 'BD5C9D4C3B4BDD254A66B8426563A68B1487AE7A5076DF3A2488E6FFED7BE64F',
      summary: { scenes: 1, nodes: 5, meshes: 5, primitives: 5, materials: 1, textures: 1, images: 1, skins: 0, animations: 0 },
      texture: { file: path.join(workshop, 'tools', 'ps2-asset-forge', 'assets', 'kenney', 'car-kit', 'models', 'Textures', 'colormap.png'), sha: 'F3622A03A20C6696065CAE9CBE391351BE873508AF190C2EBD1D420C055787A5' }
    },
    {
      file: path.join(workshop, 'tools', 'ps2-asset-forge', 'assets', 'kenney', 'retro-urban', 'models', 'tree-large.glb'),
      sha: '2B17134078E452CFD4A074FD628E86DE0789F71E5215D6111FCFC98B15F3FD0C',
      summary: { scenes: 1, nodes: 1, meshes: 1, primitives: 1, materials: 1, textures: 1, images: 1, skins: 0, animations: 0 },
      texture: { file: path.join(workshop, 'tools', 'ps2-asset-forge', 'assets', 'kenney', 'retro-urban', 'models', 'Textures', 'treeA.png'), sha: '8445833D6AEF70E984BC8BEAE80389F407FE7CAF556D4909DA965E8919E36B0A' }
    }
  ];
  const parsed = [];
  for (const fixture of fixtures) {
    check(fs.existsSync(fixture.file), `${path.basename(fixture.file)} exists`);
    const bytes = fs.readFileSync(fixture.file);
    equal(crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase(), fixture.sha, `${path.basename(fixture.file)} exact digest`);
    const model = glb.parseGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    equal(glb.structuralSummary(model), fixture.summary, `${path.basename(fixture.file)} structure`);
    if (fixture.texture) {
      const textureBytes = fs.readFileSync(fixture.texture.file);
      equal(crypto.createHash('sha256').update(textureBytes).digest('hex').toUpperCase(), fixture.texture.sha, `${path.basename(fixture.texture.file)} exact external texture digest`);
      check(typeof model.document.images[0].uri === 'string', `${path.basename(fixture.file)} declares its local texture URI`);
    }
    parsed.push(model);
  }

  const pedestrian = parsed[1];
  const idleIndex = pedestrian.document.animations.findIndex((animation) => /Man_Idle$/.test(animation.name || ''));
  check(idleIndex >= 0, 'Idle animation is discoverable');
  const animatedScene = glb.createRuntimeScene(pedestrian);
  glb.setAnimation(animatedScene, idleIndex);
  glb.applyAnimation(animatedScene, 0.12);
  const poseA = animatedScene.nodes.map((node) => [...node.translation, ...node.rotation]);
  glb.applyAnimation(animatedScene, 0.47);
  const poseB = animatedScene.nodes.map((node) => [...node.translation, ...node.rotation]);
  check(poseA.some((pose, index) => pose.some((value, axis) => Math.abs(value - poseB[index][axis]) > 1e-7)), 'Animation changes a sampled node pose over time');
  const skinnedNode = animatedScene.nodes.find((node) => node.skin !== undefined);
  check(!!skinnedNode, 'Animated fixture contains a skinned mesh node');
  const joints = glb.jointMatrices(animatedScene, skinnedNode.index, 64);
  equal(joints.length, 64 * 16, 'Skin palette has 64 matrices');
  check(Array.from(joints).every(Number.isFinite), 'Skin palette is finite');

  const inputSequence = Array.from({ length: 180 }, (_, index) => ({ forward: index < 120 ? 1 : 0, right: index >= 120 ? 1 : 0, sprint: index % 17 === 0, yaw: Math.PI }));
  const replay = () => inputSequence.reduce((state, input) => runtime.stepGame(state, input, runtime.FIXED_DELTA), runtime.startGame(runtime.createGameState('same-seed')));
  equal(runtime.stateDigestPayload(replay()), runtime.stateDigestPayload(replay()), 'Same seed and input replay deterministically');
  let state = runtime.startGame(runtime.createGameState('completion-proof'));
  for (const beacon of state.beacons) {
    state = { ...state, player: { ...state.player, x: beacon.x, z: beacon.z } };
    state = runtime.stepGame(state, {}, runtime.FIXED_DELTA);
  }
  equal(state.phase, 'complete', 'All three proximity checks produce completion');
  equal(state.outcome.kind, 'district-survey-complete', 'Completion produces typed outcome');
  const frozen = runtime.togglePause(runtime.startGame(runtime.createGameState('pause-proof')));
  equal(runtime.stepGame(frozen, { forward: 1 }, runtime.FIXED_DELTA), frozen, 'Paused simulation remains frozen');

  console.log(`Local 3D Game Runtime self-test passed ${checks} checks.`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
