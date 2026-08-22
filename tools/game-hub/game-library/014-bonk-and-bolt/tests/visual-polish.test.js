'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const modulePath = path.join(__dirname, '..', 'runtime', 'visual-polish.js');
const appPath = path.join(__dirname, '..', 'runtime', 'app.js');
const source = fs.readFileSync(modulePath, 'utf8');
const appSource = fs.readFileSync(appPath, 'utf8');
let checks = 0;

function check(value, message) {
  assert.ok(value, message);
  checks += 1;
}

check(source.includes("import * as THREE from './vendor/three.module.js'"), 'visual module uses the packaged Three.js runtime');
check(source.includes("VISUAL_PASS_ID = 'patchwork-vale-dressing-01'"), 'visual pass has a stable receipt id');
check(source.includes('export function buildWorldDressing'), 'world dressing export exists');
check(source.includes('export function decorateHouse'), 'house decoration export exists');
check(source.includes('function seededRandom'), 'world dressing has a seeded generator');
check(!source.includes('Math.random'), 'world dressing is deterministic and does not use ambient randomness');
check(source.includes('new THREE.InstancedMesh'), 'dense world detail uses bounded instancing');
check(source.includes('layer.setColorAt(index, color)'), 'instance colors are assigned through the Three.js instancing contract');
check(!source.includes('vertexColors: true'), 'instanced color does not depend on a missing geometry color attribute');
check(source.includes("name: 'village-cobbles'"), 'village cobble layer exists');
check(source.includes("name: 'field-grass'"), 'field grass layer exists');
check(source.includes("name: 'low-shrubs'"), 'shrub layer exists');
check(source.includes("name: 'gem-flowers'"), 'flower layer exists');
check(source.includes("name: 'horizon-ridges'"), 'horizon ridge layer exists');
check(source.includes("details.name = 'low-poly-house-details'"), 'houses expose their visual detail group');
check(source.includes('frontWindow(details, -1.15'), 'human and Toon houses gain faceted windows');
check(source.includes("kind === 'robot'"), 'robot houses receive a distinct detail route');
check(source.includes('new THREE.OctahedronGeometry(.22, 0)'), 'robot house beacon uses low-poly geometry');
check(!/https?:\/\//.test(source), 'visual pass has no remote assets or network dependency');
check(appSource.includes("import * as VisualPolish from './visual-polish.js'"), 'game imports the additive visual module');
check(appSource.includes('VisualPolish.decorateHouse(g,kind,color)'), 'house construction applies the detail kit');
check(appSource.includes('VisualPolish.buildWorldDressing(scene,D,save?.seed||14014)'), 'scene construction applies deterministic world dressing');
check(appSource.includes('UI.world.dataset.visualPass=polish.id'), 'live canvas exposes the visual pass receipt');
check(appSource.includes('UI.world.dataset.terrainDetailInstances=String(polish.instances)'), 'live canvas exposes the instance count');
check(appSource.includes('UI.world.dataset.visualDetailDrawCalls=String(polish.drawCalls)'), 'live canvas exposes the added draw-call count');

console.log('Bonk & Bolt visual polish PASS · ' + checks + ' checks');
