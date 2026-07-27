#!/usr/bin/env node
'use strict';

// Deterministic Studio integration review using the local Discovery Engine's
// seam vocabulary. This is a verifier, not a claim of independent validation.
const fs = require('fs');
const path = require('path');
const Discovery = require('../discovery-engine/discovery-core.js');
const Packs = require('../discovery-engine/review-packs.js');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const shell = read('studio-shell.js');
const html = read('index.html');
const engine = read('engine.html');
const vault = read('../asset-vault/index.html');
const manifest = JSON.parse(read('manifest.json'));
const contract = JSON.parse(read('module.contract.json'));

const checks = [
  ['Shell save reaches artwork storage and reports real failure', shell.includes("type:'axm-studio-save'") && engine.includes("type:'axm-studio-saved',ok:false") && shell.includes('Artwork save failed')],
  ['Save stays unavailable until the canvas engine is ready', html.includes('id="saveWorkspace"') && html.includes('disabled') && shell.includes("$('saveWorkspace').disabled=false")],
  ['Specialist modes are lazy and preserve the shared canvas', html.includes('data-src="../ui-ux-builder') && shell.includes('ensureFrame')],
  ['Asset Vault distinguishes available from connected', html.includes('Asset Vault available') && shell.includes('Asset Vault connected')],
  ['Asset Vault has a gated, versioned image-to-layer route', vault.includes("gate('send-to-studio'") && vault.includes("schema:'axm.studio-asset/v1'") && shell.includes("msg.schema!=='axm.studio-asset/v1'") && engine.includes("e.data.schema==='axm.studio-asset/v1'")],
  ['Imported asset provenance survives project save/reload', engine.includes("NL.sourceAsset={schema:'axm.studio-asset/v1'") && engine.includes('sourceAsset:l.sourceAsset||null') && engine.includes('L.sourceAsset=ld.sourceAsset||null')],
  ['Shared Creation Hands are embedded once and require an explicit versioned handoff', (html.match(/id="handsFrame"/g) || []).length === 1 && shell.includes("'/shared/asset-hands/index.html?'+params.toString()") && shell.includes("host:'studio'") && shell.includes("msg.type!=='axm-asset-hand-result'") && shell.includes("msg.schema!=='axm.asset-hand-result/v1'") && shell.includes('result.technical.pass!==true')],
  ['Composition hand results reuse the existing bounded Studio draw engine', shell.includes("item.metadata.schema==='axm.drawpacket/v1'") && engine.includes('axm-studio-apply-hand-drawpacket') && engine.includes('applyDrawPacket(JSON.stringify(e.data.packet||{}))')],
  ['Target canvas, recipe and validation survive image and draw-packet handoffs', shell.includes('result.target_canvas') && shell.includes('result.creation_recipe') && shell.includes('result.validation_receipt') && engine.includes('targetCanvas:asset.targetCanvas||null')],
  ['Raster and SVG artifacts use distinct checked Studio paths', shell.includes("artifact.mime==='image/svg+xml'&&artifact.format==='SVG'") && shell.includes("/^image\\/(?:png|jpeg|webp)$/")],
  ['Mirror has a bounded, native-candidate, receipt-producing Studio route', engine.includes('runMirrorStudioSession') && engine.includes('/axm/v1/organs/studio-candidates') && engine.includes('No human visual brief was supplied') && engine.includes('axm.studio.mirror.last-receipt.v1')],
  ['Vector edits participate in undo and redo', engine.includes('vectorUndoStack') && engine.includes("currentStudioMode==='vector'?vectorUndo()")],
  ['Pixel frames preserve layer state and resist stale loads', engine.includes('layerMetaSnapshot') && engine.includes('frameLoadToken')],
  ['Destructive frame deletion requires confirmation', engine.includes("confirm('Delete frame")],
  ['Command Deck uses schema-checked named controls and preserves existing confirmation gates', html.includes('id="commandDeck"') && html.includes('../../shared/visual-actions/visual-actions.js') && shell.includes('actionRegistry.dispatch') && engine.includes('VISUAL_ACTION_BUTTONS') && engine.includes("msg.schema!=='axm.visual-action/v1'") && contract.boundaries.refuses.includes('bypassing-existing-destructive-confirmation')],
  ['Canvas readiness is explicit and narrow layouts preserve canvas, tools and panels', engine.includes("type:'axm-studio-canvas-ready'") && shell.includes('function onCanvasReady()') && engine.includes('@media(max-width:720px)') && engine.includes('flex-direction:column')],
  ['Studio contract exposes all ten modes, Visual Actions, canvas-aware provider and capability-extension handoffs', manifest.version === 'v2.7' && contract.version === 'v2.7' && contract.handoffs.accepts.includes('axm.studio-asset/v1') && contract.handoffs.accepts.includes('axm.asset-hand-result/v1') && contract.handoffs.accepts.includes('axm.studio-upgrade-handoff/v1') && contract.consumes.includes('axm.target-canvas/v1') && contract.consumes.includes('axm.asset-hand/v2') && contract.consumes.includes('axm.asset-hand-extension/v1') && contract.consumes.includes('service:visual-actions/v1')],
  ['Studio preserves operation, source digests and complete artifact inventory without treating them as the preview image', shell.includes('handContract:result.hand.schema') && shell.includes('sourceArtifactDigests:result.creation_recipe') && shell.includes('artifactInventory:result.artifacts.map')]
];

let state = Discovery.createSession({
  id: 'studio-v2-2-seam-review',
  title: 'AXM Studio consolidation seam review',
  subject: 'Studio, UI/UX Builder, Skinner, Asset Pack Lab and Asset Vault consolidation',
  question: 'Which module boundaries can still mislead users or lose work?',
  evidenceProfile: 'COMPUTATIONAL',
  discoveryMode: 'MANUAL'
}, {id:'studio-v2-2-seam-review', now:'2026-07-12T00:00:00.000Z', actorId:'studio-verifier', actorKind:'HUMAN'});

let serial = 0;
function record(stage, text, label) {
  serial++;
  const result = Discovery.recordDiscovery(state, stage, {
    text,
    claimLabel: label || 'OBSERVED',
    source: 'tools/studio/discovery-seam-review.js static integration check'
  }, {
    now: new Date(Date.parse('2026-07-12T00:00:00.000Z') + serial * 1000).toISOString(),
    actorId: 'studio-verifier', actorKind: 'HUMAN', recordId: 'studio-seam-' + serial
  });
  if (!result.ok) throw new Error((result.errors[0] && result.errors[0].message) || 'Discovery transition failed');
  state = result.state;
}

const open = [];
for (const [name, pass] of checks) {
  if (pass) record('realityChecks', name + ' — verified in source.');
  else { open.push(name); record('seams', name + ' — OPEN.'); }
  console.log((pass ? 'PASS  ' : 'OPEN  ') + name);
}

// These are honest extensions, not missing parts of the requested consolidation.
[
  'True cubic Bézier control handles beyond the current editable smooth-path model.',
  'Audio tracks and synchronized audiovisual timeline.',
  'GIF/video export beyond the current spritesheet and timing-map export.',
  'Persistent server-wide Asset Vault folder watching/indexing.'
].forEach(text => record('blindSpots', text + ' Future enhancement; not claimed complete.', 'HYPOTHESIS'));

const pack = Packs.getPack('general-lab', state.subject.statement, state.subject.evidenceProfile);
if (!Packs.validatePack(pack).ok) throw new Error('Discovery general-lab review pack is invalid');

const validation = Discovery.validate(state);
if (!validation.ok) throw new Error('Discovery session validation failed: ' + JSON.stringify(validation.errors));
console.log('DISCOVERY COUNTS seams=' + state.discovery.seams.length + ' verified=' + state.discovery.realityChecks.length + ' future=' + state.discovery.blindSpots.length);
console.log('STUDIO DISCOVERY SEAM PASS — ' + open.length + ' OPEN');
if (open.length) process.exit(1);
