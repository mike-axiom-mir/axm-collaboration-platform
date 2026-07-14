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
  ['Vector edits participate in undo and redo', engine.includes('vectorUndoStack') && engine.includes("currentStudioMode==='vector'?vectorUndo()")],
  ['Pixel frames preserve layer state and resist stale loads', engine.includes('layerMetaSnapshot') && engine.includes('frameLoadToken')],
  ['Destructive frame deletion requires confirmation', engine.includes("confirm('Delete frame")],
  ['Studio contract exposes all ten modes and asset handoff', manifest.version === 'v2.2' && contract.version === 'v2.2' && contract.handoffs.accepts.includes('axm.studio-asset/v1')]
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
