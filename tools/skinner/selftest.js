#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
let failures = 0;
function test(condition, message) {
  if (condition) console.log('PASS ' + message);
  else { failures++; console.error('FAIL ' + message); }
}

test(manifest.id === 'skinner' && manifest.version === 'v0.3', 'Skinner manifest exposes the upgraded compatibility route');
test(contract.schema === 'axm.module-contract/v1' && contract.id === 'skinner', 'Skinner declares a module contract');
test(contract.provides.includes('aetherglass-visual-composition-editing'), 'module contract declares Aetherglass editing');
test(/shared\/aetherglass\/src\/axm-aetherglass\.js/.test(html), 'route loads the verified Aetherglass core');
test(/shared\/aetherglass\/src\/axm-luminous-layer-forge\.js/.test(html), 'route loads Luminous Layer Forge');
test(/shared\/aetherglass\/axm-skin-bridge\.js/.test(html), 'route loads the owned skin bridge');
test((html.match(/data-visual-option=/g) || []).length === 12, 'route exposes all twelve allowlisted visual option groups');
test((html.match(/data-visual-range=/g) || []).length === 3, 'route exposes all three bounded visual gains');
test((html.match(/data-visual-boolean=/g) || []).length === 5, 'route exposes all five visual toggles');
test(/paintAetherglass/.test(html) && /AXMSkinAetherglass\.apply/.test(html), 'live preview routes through the reversible bridge');
test(/class="studio-header skin-intro"/.test(html) && /class="canvas-bar"/.test(html), 'route exposes the modern Skin Studio shell and canvas chrome');
test(/class="pv-metrics"/.test(html) && /SKIN STUDIO 2026/.test(html), 'live preview keeps the modern workbench hierarchy');
test(/:has\(#applyBtn\)/.test(html) && /@media\(max-width:680px\)/.test(html), 'workbench provides a responsive commit surface');
test(contract.provides.includes('style-fabric-to-skinner-safe-mapping'), 'module contract declares the Style Fabric safety adapter');
test(/style-fabric-bridge\.mjs/.test(html), 'route loads the Style Fabric adapter module');
test(/shared\/style-fabric\/studio\//.test(html), 'route links the full local Style Fabric composer');
test(/id="fabricPrimary"/.test(html) && /id="fabricSecondary"/.test(html) && /id="fabricApply"/.test(html), 'route exposes preskin selection, deterministic fusion, and explicit staging');
test(/styleFabric:styleFabricReceipt/.test(html) && /skinFingerprint/.test(html), 'Style Fabric source receipts persist only with the staged Skinner checkpoint');
test(/zero authority writes/.test(html) && /only Apply to hub persists it/.test(html), 'route keeps Style Fabric staging separate from Hub commit');
test(/updatedAt:new Date\(\)\.toISOString\(\)/.test(html), 'skin checkpoints carry an ordering timestamp across direct and Studio routes');
test(/axm\.skinner\.state\.v2/.test(html) && /persistCheckpoint/.test(html) && /restoreCheckpoint/.test(html), 'direct and embedded routes share one canonical local checkpoint');
test(/version:'v0\.3'/.test(html), 'Hub handshake advertises Skinner v0.3');

if (failures) process.exit(1);
console.log('AXM Skinner selftest: PASS');
