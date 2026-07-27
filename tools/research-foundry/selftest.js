'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Research = require('../../shared/deterministic-research');
const manifest = require('./manifest.json');
const contract = require('./module.contract.json');

let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-research-'));
  fs.mkdirSync(path.join(root, 'tools', 'provider'), { recursive: true });
  fs.mkdirSync(path.join(root, 'hub'), { recursive: true });
  fs.mkdirSync(path.join(root, 'exports'), { recursive: true });
  fs.mkdirSync(path.join(root, 'state', 'workshop-direction'), { recursive: true });
  fs.writeFileSync(path.join(root, 'exports', 'verify-report.txt'), 'PASS fixture verification\n');
  fs.writeFileSync(path.join(root, 'tools', 'provider', 'manifest.json'), JSON.stringify({ id:'provider', name:'Provider', version:'v1', status:'TEST', entry:'index.html', contract:'module.contract.json', uses:[], produces:[] }));
  fs.writeFileSync(path.join(root, 'tools', 'provider', 'module.contract.json'), JSON.stringify({ schema:'axm.module-contract/v1', id:'provider', version:'v1', provides:['cap.ready/v1'], consumes:[], permissions:[], handoffs:{emits:[],accepts:[]}, boundaries:{refuses:['automatic-action']}, lifecycle:{state_owner:'none',reload:'not-applicable',disconnect:'not-applicable',cleanup:'not-applicable'} }));
  fs.writeFileSync(path.join(root, 'tools', 'provider', 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(root, 'state', 'workshop-direction', 'directions.json'), JSON.stringify({ directions:{} }));
  return root;
}
function run() {
  check(manifest.schema === 'axm.tool-manifest/v1' && manifest.kind === 'product', 'versioned product manifest is declared');
  check(Array.isArray(manifest.permissions) && manifest.permissions.length === 0, 'product requests no permissions');
  check(contract.schema === 'axm.module-contract/v1' && contract.id === manifest.id, 'module contract matches the manifest');
  check(contract.boundaries.refuses.includes('automatic-build') && contract.boundaries.refuses.includes('automatic-promotion') && contract.boundaries.refuses.includes('automatic-publication'), 'contract preserves no-action authority boundaries');
  check(JSON.stringify(contract.lifecycle) === JSON.stringify({state_owner:'filesystem',reload:'resume',disconnect:'graceful-degrade',cleanup:'explicit'}), 'filesystem lifecycle is exact');
  const root = fixture();
  try {
    const goal = { title:'Fixture goal', objective:'Prove exact gap research.', requirements:[
      { id:'ready', capabilities:['cap.ready/v1'], gapType:'HAND', required:true, priority:90 },
      { id:'missing', capabilities:['cap.missing/v1'], gapType:'HAND', required:true, priority:80 }
    ] };
    const first = Research.Runner.run({ root, goal, observedAt:'2026-07-23T00:00:00.000Z', includeWorkshopGaps:false });
    const second = Research.Runner.run({ root, goal, observedAt:'2030-01-01T00:00:00.000Z', includeWorkshopGaps:false });
    const verifyReport = path.join(root, 'exports', 'verify-report.txt');
    fs.utimesSync(verifyReport, new Date('2031-01-01T00:00:00.000Z'), new Date('2031-01-01T00:00:00.000Z'));
    const third = Research.Runner.run({ root, goal, observedAt:'2030-01-01T00:00:00.000Z', includeWorkshopGaps:false });
    check(first.report.route === 'BLOCKED', 'missing required capability blocks route');
    check(first.report.gaps.length === 1 && first.report.gaps[0].capabilityId === 'cap.missing/v1', 'exact comparison isolates missing capability');
    check(first.report.questions.length === 1 && first.report.questions[0].falsifiable, 'one falsifiable question per gap');
    check(first.report.hypotheses[0].routeType === 'BUILD_NEW_BOUNDED_HAND', 'missing hand routes to bounded build hypothesis');
    check(first.report.experiments[0].claim.primarySurface === 'focused-execution-with-known-inputs', 'hand claim routes to runtime evidence');
    check(first.report.experiments[0].claim.counterevidence.length > 0, 'counterevidence is named');
    check(first.report.backlog.builders.length === 1 && first.report.backlog.stewards.length === 0, 'builder and steward queues remain separate');
    check(first.report.researchDigest === second.report.researchDigest, 'observation time does not change semantic research digest');
    check(second.report.researchDigest === third.report.researchDigest, 'evidence file modification time does not change semantic research digest');
    check(first.report.truth.automaticBuild === false && first.report.truth.automaticPermission === false && first.report.truth.automaticPromotion === false, 'report grants no action authority');
    check(first.ledger.claims.every(item => item.verdict === 'UNTESTED'), 'new claims are untested');
    const claim = first.ledger.claims[0].claimId;
    let ledger = Research.Ledger.ingest(first.ledger, { claimId:claim, surface:'fixture-runtime', verdict:'PASS', observedAt:'2026-07-23T00:01:00Z', observer:{id:'test-a',kind:'MACHINE'}, evidenceRefs:[{path:'fixture/pass.json',digest:'a'.repeat(64)}] });
    ledger = Research.Ledger.ingest(ledger, { claimId:claim, surface:'independent-fixture', verdict:'FAIL', observedAt:'2026-07-23T00:02:00Z', observer:{id:'test-b',kind:'MACHINE'}, evidenceRefs:[{path:'fixture/fail.json',digest:'b'.repeat(64)}] });
    check(ledger.claims[0].verdict === 'CONFLICT', 'contradictory evidence remains conflict');
    check(Research.Ledger.verify(JSON.parse(JSON.stringify(ledger))).pass, 'ledger survives serialization with its hash chain');
    const tampered = JSON.parse(JSON.stringify(ledger)); tampered.observations[0].verdict = 'FAIL';
    check(!Research.Ledger.verify(tampered).pass, 'tampered ledger is rejected');
    check(first.report.hypotheses[0].semanticLeadWarning.includes('never satisfies'), 'semantic lead cannot close exact gap');
    console.log('Deterministic Research Foundry selftest: PASS - ' + checks + ' checks');
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}

run();
