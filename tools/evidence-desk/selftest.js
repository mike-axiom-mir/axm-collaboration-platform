#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const Core = require('./evidence-core.js');
const Machine = require('./machine.js');
const Knowledge = require('../knowledge-canvas/knowledge-canvas-core.js');

let failures = 0;
let passes = 0;
function check(condition, label) {
  if (condition) { passes += 1; console.log('PASS  ' + label); }
  else { failures += 1; console.error('FAIL  ' + label); }
}
function read(name) { return fs.readFileSync(path.join(__dirname, name), 'utf8'); }

const sample = {
  schema: Core.INPUT_SCHEMA,
  title: 'Evidence route proof',
  goal: 'Build one integrity-verifiable receipt without fake completion',
  actor: { id: 'evidence-selftest', type: 'machine' },
  source_checkpoint: 'tools/evidence-desk v0.2 fixture',
  observations: [{
    id: 'claim-contract',
    claim: 'The Evidence Desk contract is versioned.',
    kind: 'static-structure',
    risk: 'MEDIUM',
    verdict: 'PASS',
    pass_condition: 'The parsed contract declares axm.module-contract/v1 and v0.2.',
    primary_surface: 'schema-validation',
    observed_evidence: 'Parsed tools/evidence-desk/module.contract.json.',
    counterevidence: 'The file is absent, invalid JSON, or declares another schema or version.',
    source_kind: 'schema-validation',
    source: 'tools/evidence-desk/module.contract.json'
  }],
  actions: [{ action: 'module.build', target: 'tools/evidence-desk', result: 'candidate built', evidence: 'focused file inventory' }],
  checks: [{ name: 'focused selftest', status: 'PASS', evidence: 'node tools/evidence-desk/selftest.js' }],
  changes: [{ path: 'tools/evidence-desk', kind: 'modified', summary: 'v0.2 evidence route' }],
  limitations: ['The fixture does not certify its own real-world claim.'],
  next_actions: ['Keep TEST until human review.']
};

async function main() {
  const normalizedLegacy = Core.normalize({ title: 'Legacy', goal: 'Preserve v1 input', observations: ['legacy claim'] });
  check(normalizedLegacy.observations[0].effective_verdict === 'UNKNOWN', 'legacy observation remains compatible and UNKNOWN');
  check(Core.CLAIM_ROUTES['visual-appearance'].surface === 'live-visual-observation', 'visual claims route to live visual observation');
  check(Core.CLAIM_ROUTES.persistence.surface === 'restart-reload', 'persistence claims route to restart and reload evidence');

  const receipt = await Core.seal(sample, { now: '2026-07-24T00:00:00.000Z' });
  check(receipt.schema === 'axm.evidence-receipt/v2' && receipt.v === 2, 'receipt emits the v2 schema');
  check(receipt.status === 'VERIFIED_WITH_RECORDED_SCOPE', 'complete routed evidence reaches recorded-scope verification');
  check(receipt.counts.claims_passed === 1 && receipt.counts.checks_passed === 1, 'claim and check counts use effective evidence states');
  check(receipt.truth.execution_is_verification === false && receipt.truth.canon_assigned === false, 'execution and CANON boundaries stay false');
  check(/^sha256:[a-f0-9]{64}$/.test(receipt.integrity.digest), 'receipt carries a full SHA-256 content digest');
  check((await Core.verify(receipt)).ok, 'fresh sealed receipt verifies');

  const secondTime = await Core.seal(sample, { now: '2027-01-01T00:00:00.000Z' });
  check(secondTime.integrity.digest === receipt.integrity.digest, 'content digest is stable across generation timestamps');
  const tampered = JSON.parse(JSON.stringify(receipt));
  tampered.goal = 'changed after sealing';
  check((await Core.verify(tampered)).state === 'MISMATCH', 'changed receipt content fails integrity verification');

  const noCheckEvidence = await Core.seal(Object.assign({}, sample, { checks: [{ name: 'claimed pass', status: 'PASS', evidence: '' }] }));
  check(noCheckEvidence.checks[0].status === 'PASS' && noCheckEvidence.checks[0].effective_status === 'NOT_RUN', 'declared PASS is preserved but not counted without evidence');
  check(noCheckEvidence.status === 'EVIDENCE_INCOMPLETE' && noCheckEvidence.truth.fully_verified === false, 'PASS without evidence cannot produce verified status');

  const wrongSurface = await Core.seal(Object.assign({}, sample, { observations: [{
    claim: 'The screen is visually usable.', kind: 'visual-appearance', risk: 'MEDIUM', verdict: 'PASS',
    pass_condition: 'The layout is readable.', primary_surface: 'file-inspection', observed_evidence: 'CSS source exists.',
    counterevidence: 'Live content clips.', source_kind: 'source-read', source: 'tools/evidence-desk/evidence-desk.css'
  }] }));
  check(wrongSurface.observations[0].effective_verdict === 'UNKNOWN', 'mismatched evidence surface cannot become effective PASS');
  check(wrongSurface.warnings.some(item => item.includes('does not match')), 'surface mismatch remains visible');

  const explicitUnknown = await Core.seal(Object.assign({}, sample, { observations: [{
    claim: 'Phone journey is usable.', kind: 'interaction-journey', risk: 'MEDIUM', verdict: 'UNKNOWN',
    pass_condition: 'Complete the journey at 390px.', counterevidence: 'Any clipped required control.'
  }] }));
  check(explicitUnknown.counts.claims_unknown === 1 && explicitUnknown.status === 'EVIDENCE_INCOMPLETE', 'UNKNOWN stays open');

  const highRiskNoSource = await Core.seal(Object.assign({}, sample, { observations: [{
    claim: 'Denied identities cannot write.', kind: 'authorization', risk: 'HIGH', verdict: 'PASS',
    pass_condition: 'Allowed and denied identities produce distinct outcomes.', observed_evidence: 'Boundary attempts recorded.',
    counterevidence: 'A denied identity writes successfully.'
  }] }));
  check(highRiskNoSource.observations[0].effective_verdict === 'UNKNOWN', 'high-risk verdict requires a source pointer');

  const failedClaim = await Core.seal(Object.assign({}, sample, { observations: [{
    claim: 'The required file exists.', kind: 'existence', risk: 'LOW', verdict: 'FAIL',
    pass_condition: 'Direct inspection finds the file.', observed_evidence: 'Direct inspection returned absent.',
    counterevidence: 'The exact file is present.', source_kind: 'file-inspection', source: 'missing-fixture.txt'
  }] }));
  check(failedClaim.status === 'EVIDENCE_CONTRADICTED' && failedClaim.counts.claims_failed === 1, 'evidenced FAIL remains contradicted');
  check(Core.report(receipt).includes('An UNKNOWN claim remains open') && Core.report(receipt).includes('does not prove that the supplied evidence is true'), 'Action Report states no-fake-done and integrity boundaries');

  const packet = await Core.knowledgePacket(receipt, { now: '2026-07-24T00:01:00.000Z' });
  check(packet.deliveryState === 'PREVIEWED' && packet.receiverAcceptance === 'PENDING', 'handoff preview does not claim receiver acceptance');
  check(/^sha256:[a-f0-9]{64}$/.test(packet.digest) && (await Core.verifyKnowledgePacket(packet)).ok, 'handoff preview is digest bound');
  check(Knowledge.sourcePacket(packet).length === 1, 'Knowledge Canvas v1 intake accepts the bounded v0.2 packet');
  const packetTamper = JSON.parse(JSON.stringify(packet));
  packetTamper.items[0].claim = 'changed';
  check(!(await Core.verifyKnowledgePacket(packetTamper)).ok, 'changed handoff packet fails digest verification');
  const delivery = Core.handoffReceipt(packet, 'INBOX_WRITTEN', { proof: { exactDigestMatch: true } });
  check(delivery.truth.inboxWriteProven === true && delivery.truth.receiverAcceptanceProven === false, 'inbox write and receiver acceptance remain separate');

  const noGate = await Machine.call({}, 'build', sample);
  check(noGate.ok === false && noGate.error.code === 'HOST_GATE_REQUIRED', 'machine adapter refuses a missing authenticated host gate');
  const denied = await Machine.call({ authorize: async () => ({ allow: false, reason: 'consent off' }) }, 'build', sample);
  check(denied.ok === false && denied.error.code === 'GATE_DENIED', 'machine adapter preserves gate refusal');
  const allowed = { authorize: async () => ({ allow: true }) };
  const machineBuild = await Machine.call(allowed, 'build', sample);
  check(machineBuild.ok && machineBuild.writes.length === 0 && machineBuild.result.receipt.integrity.state === 'SEALED', 'machine build is read-only and sealed');
  const machineVerify = await Machine.call(allowed, 'verify', { receipt: machineBuild.result.receipt });
  check(machineVerify.ok && machineVerify.result.ok, 'machine adapter recomputes receipt integrity');
  const machinePreview = await Machine.call(allowed, 'handoff-preview', { receipt: machineBuild.result.receipt });
  check(machinePreview.ok && machinePreview.writes.length === 0 && machinePreview.result.receipt.deliveryState === 'PREVIEWED', 'machine handoff preview performs no write');
  const unknownAction = await Machine.call(allowed, 'delete', sample);
  check(unknownAction.ok === false && unknownAction.error.code === 'UNKNOWN_ACTION', 'undeclared machine action is refused before authorization');

  const manifest = JSON.parse(read('manifest.json'));
  const contract = JSON.parse(read('module.contract.json'));
  JSON.parse(read('evidence-fields.schema.json'));
  JSON.parse(read('evidence-receipt.schema.json'));
  check(manifest.schema === 'axm.tool-manifest/v1' && manifest.kind === 'product' && manifest.version === 'v0.2', 'modern manifest declares product v0.2');
  check(JSON.stringify(manifest.permissions) === JSON.stringify(contract.permissions), 'manifest and contract permissions agree exactly');
  check(contract.boundaries.refuses.includes('inbox-placement-as-receiver-acceptance') && contract.boundaries.refuses.includes('knowledge-inbox-overwrite'), 'contract refuses fake acceptance and inbox overwrite');
  check(read('index.html').includes('Preview handoff') && read('index.html').includes('Place preview in inbox'), 'human door exposes separate preview and placement controls');
  check(read('app.js').includes('HELD_EXISTING_INBOX') && read('app.js').includes('exactDigestMatch'), 'human door preserves an existing inbox and verifies readback');
  check(!/negative proof/i.test(read('index.html') + read('app.js') + read('evidence-desk.css')), 'user-facing interface avoids alarming negative-proof wording');

  console.log('\n' + passes + ' PASS · ' + failures + ' FAIL · Evidence Desk v0.2 focused suite');
  process.exitCode = failures ? 1 : 0;
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
