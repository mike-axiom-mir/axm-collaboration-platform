'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rendererPath = path.join(__dirname, '..', 'runtime', 'bloomvale-three.js');
const source = fs.readFileSync(rendererPath, 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'runtime', 'app.js'), 'utf8');
const stylesSource = fs.readFileSync(path.join(__dirname, '..', 'runtime', 'styles.css'), 'utf8');
let checks = 0;

function check(value, message) {
  assert.ok(value, message);
  checks += 1;
}

check(source.includes("canvas.getContext('webgl'"), 'renderer keeps the native WebGL entry point');
check(source.includes("canvas.dataset.renderer = 'webgl-low-poly'"), 'renderer identifies its low-poly route');
check(source.includes("canvas.dataset.palette = '16-step-channel-quantized'"), 'renderer reports its quantized palette');
check(source.includes("canvas.dataset.visualPass = 'bloomvale-depth-02'"), 'visual pass has a stable receipt id');
check(source.includes("{ alpha: true, antialias: false"), 'transparent WebGL composition keeps the 2D semantic ink visible');
check(source.includes("gl.clearColor(.025, .055, .09, 0)"), 'WebGL clear remains transparent for hybrid composition');
check(source.includes('function pyramid('), 'pyramid mesh primitive exists');
check(source.includes('function octahedron('), 'octahedron mesh primitive exists');
check(source.includes('function flatRing('), 'ground-ring mesh primitive exists');
check(source.includes('function addActor('), 'defenders receive dynamic low-poly meshes');
check(source.includes('function addEnemy('), 'enemies receive dynamic low-poly meshes');
check(source.includes('function addProjectile('), 'projectiles receive dynamic low-poly meshes');
check(source.includes('function addPickup('), 'pickups receive dynamic low-poly meshes');
check(source.includes("enemy.kind === 'sprinter'"), 'sprinter has a distinct silhouette');
check(source.includes("enemy.kind === 'bruiser'"), 'bruiser has a distinct silhouette');
check(source.includes("enemy.kind === 'siphon'"), 'siphon has a distinct silhouette');
check(source.includes("enemy.kind === 'crown'"), 'Ink Crown has a distinct silhouette');
check(source.includes('enemy.windupUntil'), 'authoritative attack windups drive 3D telegraphs');
check(source.includes('state.counterReadyUntil'), 'authoritative Prism Counter state drives 3D feedback');
check(source.includes('canvas.dataset.dynamicActors'), 'actor counts are exposed for live verification');
check(source.includes('canvas.dataset.dynamicEnemies'), 'enemy counts are exposed for live verification');
check(source.includes('canvas.dataset.dynamicProjectiles'), 'projectile counts are exposed for live verification');
check(source.includes('canvas.dataset.dynamicPickups'), 'pickup counts are exposed for live verification');
check(source.includes('canvas.dataset.vertices'), 'live vertex count is exposed for live verification');
check(!/https?:\/\//.test(source), 'renderer does not pull remote assets or dependencies');
check(!/THREE\.|BABYLON\.|new Image\(/.test(source), 'renderer remains self-contained and asset-free');
check(appSource.includes('if (!stage3d.available) {\n        drawBeacon'), 'Canvas gameplay sprites remain the WebGL failure fallback');
check(appSource.includes('drawEffects(time);\n      drawAim();'), 'semantic feedback and aiming remain on the Canvas overlay');
check(/#world3d\s*\{[^}]*z-index:\s*2;/s.test(stylesSource), 'WebGL gameplay pieces compose above the illustrated map');
check(/#world3d\s*\{[^}]*pointer-events:\s*none;/s.test(stylesSource), 'WebGL composition cannot intercept player input');

console.log('Toonfall 3D polish selftest PASS (' + checks + ' checks)');
