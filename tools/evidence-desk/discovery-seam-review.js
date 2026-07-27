#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const Core = require('./evidence-core.js');
const Machine = require('./machine.js');
const Knowledge = require('../knowledge-canvas/knowledge-canvas-core.js');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const contract = JSON.parse(read('module.contract.json'));
const html = read('index.html');
const app = read('app.js');
const css = read('evidence-desk.css');
const schema = JSON.parse(read('evidence-receipt.schema.json'));

const completeInput = {
  title: 'Discovery seam fixture', goal: 'Prove bounded Evidence Desk seams', source_checkpoint: 'fixture-v0.2',
  actor: { id: 'seam-review', type: 'machine' },
  observations: [{
    claim: 'The contract is versioned.', kind: 'static-structure', risk: 'MEDIUM', verdict: 'PASS',
    pass_condition: 'The parsed contract declares v0.2.', primary_surface: 'schema-validation',
    observed_evidence: 'Parsed contract.', counterevidence: 'The version differs.',
    source_kind: 'schema-validation', source: 'tools/evidence-desk/module.contract.json'
  }],
  actions: [{ action: 'inspect', target: 'contract', result: 'parsed', evidence: 'fixture parse' }],
  checks: [{ name: 'contract check', status: 'PASS', evidence: 'fixture assertion' }],
  limitations: ['Fixture scope only.']
};

async function main() {
  const sealed = await Core.seal(completeInput, { now: '2026-07-24T00:00:00.000Z' });
  const later = await Core.seal(completeInput, { now: '2027-07-24T00:00:00.000Z' });
  const packet = await Core.knowledgePacket(sealed, { now: '2026-07-24T00:01:00.000Z' });
  const missingEvidence = await Core.seal(Object.assign({}, completeInput, { checks: [{ name: 'empty pass', status: 'PASS' }] }));
  const mismatch = await Core.seal(Object.assign({}, completeInput, { observations: [{
    claim: 'The UI is visually usable.', kind: 'visual-appearance', risk: 'MEDIUM', verdict: 'PASS',
    pass_condition: 'The live screen is readable.', primary_surface: 'schema-validation', observed_evidence: 'CSS parsed.',
    counterevidence: 'Live controls clip.', source_kind: 'source-read', source: 'tools/evidence-desk/evidence-desk.css'
  }] }));
  const machine = await Machine.call({ authorize: async () => ({ allow: true }) }, 'handoff-preview', { receipt: sealed });
  const checks = [
    ['Modern product manifest remains TEST behind the human gate', manifest.schema === 'axm.tool-manifest/v1' && manifest.kind === 'product' && manifest.status === 'TEST'],
    ['Manifest and contract agree on v0.2', manifest.version === 'v0.2' && contract.version === 'v0.2'],
    ['Manifest and contract permissions agree exactly', JSON.stringify(manifest.permissions) === JSON.stringify(contract.permissions)],
    ['Human and machine doors share one evidence core', html.includes('evidence-core.js') && read('machine.js').includes("require('./evidence-core.js')")],
    ['Input and receipt schemas are explicit artifacts', fs.existsSync(path.join(__dirname, 'evidence-fields.schema.json')) && schema.$id === 'axm.evidence-receipt/v2'],
    ['All fifteen claim kinds have a declared native proof surface', Core.CLAIM_KINDS.length === 15 && Core.CLAIM_KINDS.every(id => Core.CLAIM_ROUTES[id].surface)],
    ['Visual appearance routes to live observation rather than source intent', Core.CLAIM_ROUTES['visual-appearance'].surface === 'live-visual-observation'],
    ['Persistence routes to restart and reload evidence', Core.CLAIM_ROUTES.persistence.surface === 'restart-reload'],
    ['A declared PASS without check evidence remains open', missingEvidence.checks[0].effective_status === 'NOT_RUN' && !missingEvidence.truth.fully_verified],
    ['A mismatched claim surface cannot become effective PASS', mismatch.observations[0].effective_verdict === 'UNKNOWN'],
    ['Unknown is a first-class receipt count', typeof sealed.counts.claims_unknown === 'number' && Core.normalize({ observations: ['legacy'] }).observations[0].effective_verdict === 'UNKNOWN'],
    ['Sealed receipt recomputes to a matching SHA-256 digest', (await Core.verify(sealed)).ok && /^sha256:[a-f0-9]{64}$/.test(sealed.integrity.digest)],
    ['Content seal excludes only generation time and integrity wrapper', sealed.integrity.digest === later.integrity.digest && sealed.integrity.scope === 'canonical-receipt-content-without-generated-or-integrity'],
    ['Action Report says content integrity is not evidence truth', Core.report(sealed).includes('does not prove that the supplied evidence is true')],
    ['Knowledge handoff is previewed before any placement action', packet.deliveryState === 'PREVIEWED' && html.indexOf('previewKnowledge') < html.indexOf('placeKnowledge')],
    ['Knowledge handoff retains pending receiver acceptance', packet.receiverAcceptance === 'PENDING' && Core.handoffReceipt(packet, 'INBOX_WRITTEN').truth.receiverAcceptanceProven === false],
    ['Knowledge Canvas v1 can parse the additive packet', Knowledge.sourcePacket(packet).length === 1],
    ['Machine handoff preview is read-only', machine.ok && machine.writes.length === 0 && machine.result.receipt.deliveryState === 'PREVIEWED'],
    ['Human placement requires its own gate action', app.includes("gate('knowledge-handoff.place'") && app.includes("gate('knowledge-handoff.preview'")],
    ['An existing nonmatching Canvas packet is held and preserved', app.includes('HELD_EXISTING_INBOX') && app.includes('existingPacketPreserved: true')],
    ['Input edits invalidate prior receipt and handoff state', app.includes("$('composer').addEventListener('input', markDirty)") && app.includes('handoffPreview = null')],
    ['Saved receipt resumes only when integrity and input binding both match', app.includes('rebound.integrity.digest === receipt.integrity.digest')],
    ['Responsive styles include narrow single-column controls', css.includes('@media (max-width: 720px)') && css.includes('grid-template-columns: 1fr')],
    ['Interface avoids alarming negative-proof terminology', !/negative proof/i.test(html + app + css)],
    ['CANON and receiver acceptance remain explicitly refused', contract.boundaries.refuses.includes('automatic-canon-promotion') && contract.boundaries.refuses.includes('inbox-placement-as-receiver-acceptance')]
  ];
  let open = 0;
  checks.forEach(([label, pass]) => {
    console.log((pass ? 'PASS  ' : 'OPEN  ') + label);
    if (!pass) open += 1;
  });
  console.log('\nEvidence Desk discovery seam: ' + (open ? 'OPEN' : 'PASS') + ' · ' + checks.length + ' controls · ' + open + ' open');
  process.exitCode = open ? 1 : 0;
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
