#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Continuity = require('../shared/continuity/workshop-inventory-continuity');
const Generator = require('../scripts/generate-workshop-continuity-baseline');

function fixtureBaseline(root) {
  const live = Continuity.collectLiveInventory(root);
  return {
    schema:Continuity.BASELINE_SCHEMA,
    generatedAt:'2026-08-23T00:00:00.000Z',
    referenceRevisions:[],
    inventory:{
      protectedPaths:['README.md', 'tools/fixture-tool/manifest.json', 'tools/fixture-tool/module.contract.json'],
      toolIds:live.toolIds,
      providedCapabilityIds:live.providedCapabilityIds,
      providerBindings:live.providerBindings,
      consumerBindings:live.consumerBindings
    },
    truth:{ retirementRequiresExplicitMikeRecord:true, moduleMayNotSelfRetire:true }
  };
}

function retirements(entries) {
  return {
    schema:Continuity.RETIREMENTS_SCHEMA,
    entries:entries || [],
    truth:{ automaticRetirement:false }
  };
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-workshop-continuity-'));
try {
  const toolRoot = path.join(root, 'tools', 'fixture-tool');
  fs.mkdirSync(toolRoot, { recursive:true });
  fs.writeFileSync(path.join(root, 'README.md'), '# Fixture\n');
  fs.writeFileSync(path.join(toolRoot, 'manifest.json'), JSON.stringify({
    id:'fixture-tool', name:'Fixture Tool', version:'v1', status:'TEST', entry:'index.js',
    contract:'module.contract.json', uses:[], permissions:[], produces:['fixture.manifest-output/v1']
  }));
  fs.writeFileSync(path.join(toolRoot, 'module.contract.json'), JSON.stringify({
    id:'fixture-tool', provides:['fixture.provided/v1'], consumes:['fixture.input/v1']
  }));
  fs.writeFileSync(path.join(toolRoot, 'index.js'), "'use strict';\n");

  const baseline = fixtureBaseline(root);
  assert.deepEqual(Continuity.validateBaseline(baseline), { pass:true, errors:[] });
  assert.equal(Continuity.audit(root, baseline, retirements()).pass, true, 'intact inventory passes');

  fs.writeFileSync(path.join(root, 'README.md'), '# Changed content remains present\n');
  assert.equal(Continuity.audit(root, baseline, retirements()).pass, true, 'content edits do not masquerade as deletion');

  fs.rmSync(path.join(root, 'README.md'));
  const missingPath = Continuity.audit(root, baseline, retirements());
  assert.equal(missingPath.pass, false);
  assert.ok(missingPath.errors.includes('UNAUTHORIZED_DISAPPEARANCE path: README.md'));
  const authorizedPath = retirements([{
    kind:'path', id:'README.md', status:'AUTHORIZED', authorizedBy:'Mike Tobi',
    reason:'Fixture path intentionally retired.', recordedAt:'2026-08-23T00:00:00.000Z'
  }]);
  assert.equal(Continuity.audit(root, baseline, authorizedPath).pass, true, 'an exact human-authorized retirement is honored');

  const contractFile = path.join(toolRoot, 'module.contract.json');
  fs.writeFileSync(contractFile, JSON.stringify({ id:'fixture-tool', provides:['fixture.replacement/v1'], consumes:['fixture.input/v1'] }));
  const missingCapability = Continuity.audit(root, baseline, authorizedPath);
  assert.equal(missingCapability.pass, false);
  assert.ok(missingCapability.errors.includes('UNAUTHORIZED_DISAPPEARANCE providedCapability: fixture.provided/v1'));
  assert.ok(missingCapability.errors.includes('UNAUTHORIZED_DISAPPEARANCE providerBinding: fixture-tool::fixture.provided/v1'));
  assert.deepEqual(missingCapability.added.providedCapabilities, ['fixture.replacement/v1'], 'a replacement cannot hide a disappearance');

  const fakeAuthorization = retirements([{
    kind:'path', id:'README.md', status:'AUTHORIZED', authorizedBy:'generated-module',
    reason:'A module attempted self-retirement.', recordedAt:'2026-08-23T00:00:00.000Z'
  }]);
  assert.ok(Continuity.validateRetirements(fakeAuthorization).errors.some(error => error.includes('Mike Tobi')));

  const intakeBaseline = JSON.parse(JSON.stringify(baseline));
  intakeBaseline.inventory.protectedPaths.push('intakes/raw-upload.zip');
  intakeBaseline.inventory.protectedPaths.sort();
  assert.ok(Continuity.validateBaseline(intakeBaseline).errors.some(error => error.includes('raw intakes')));

  assert.equal(Generator.parseOptions(['--write']).confirmed, false);
  assert.equal(Generator.parseOptions(['--write', '--confirm-mike-reviewed']).confirmed, true);
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}

console.log('Workshop continuity gate selftest: PASS');
