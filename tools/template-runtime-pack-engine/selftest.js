#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Templates = require('../../shared/operations/template-runtime-service');

const PREFIX = 'axm-template-runtime-selftest-';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), PREFIX));
const root = path.join(temp, 'workshop');
const options = {
  root,
  stateRoot: path.join(root, 'state'),
  exportRoot: path.join(root, 'exports')
};
let pass = 0;

function check(label, run) {
  run();
  pass += 1;
  console.log('PASS  ' + label);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function cleanup() {
  const resolved = path.resolve(temp);
  const allowedRoot = path.resolve(os.tmpdir()) + path.sep;
  if (!resolved.startsWith(allowedRoot) || !path.basename(resolved).startsWith(PREFIX)) {
    throw new Error('temporary cleanup boundary refused');
  }
  fs.rmSync(resolved, { recursive: true, force: true });
}

try {
  fs.mkdirSync(options.stateRoot, { recursive: true });
  fs.mkdirSync(options.exportRoot, { recursive: true });

  const manifest = readJson('manifest.json');
  const contract = readJson('module.contract.json');
  const app = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const templates = Templates.create(options);

  check('manifest and contract identify the same permission-free module', () => {
    assert.equal(manifest.id, 'template-runtime-pack-engine');
    assert.equal(contract.id, manifest.id);
    assert.equal(contract.version, manifest.version);
    assert.deepStrictEqual(contract.permissions, manifest.permissions);
  });

  check('service seeds one inspectable pack without automatic AI fill', () => {
    const status = templates.status();
    assert.equal(status.packCount, 1);
    assert.equal(status.packs[0].id, 'workshop-brief');
    assert.equal(status.aiFillAutomatic, false);
    assert.equal(status.inheritanceDepthLimit, 5);
  });

  check('locked shell values survive an attempted override', () => {
    const preview = templates.render({
      packId: 'workshop-brief',
      values: { title: 'Evidence brief', purpose: 'Test the locked shell.', provenance: 'replace me' }
    });
    assert(preview.fields.provenance.includes('AXM Workshop'));
    assert(preview.warnings.some(item => item.slot === 'provenance' && item.code === 'LOCKED'));
    assert.equal(preview.truth.lockedShellPreserved, true);
    assert.equal(preview.truth.automaticExport, false);
  });

  check('required and overflow failures stay visible', () => {
    const preview = templates.render({
      packId: 'workshop-brief',
      values: { title: 'x'.repeat(100), purpose: '' }
    });
    assert.equal(preview.pass, false);
    assert(preview.warnings.some(item => item.code === 'OVERFLOW'));
    assert(preview.warnings.some(item => item.code === 'REQUIRED'));
  });

  check('AI fill remains a review-only proposal', () => {
    const preview = templates.render({
      packId: 'workshop-brief',
      mode: 'ai-proposal',
      values: { title: 'Proposed title', purpose: 'Proposed purpose' }
    });
    assert.equal(preview.applied, false);
    assert.equal(preview.reviewRequired, true);
    assert.equal(preview.truth.aiFillIsProposalOnly, true);
  });

  check('child packs inherit the base shell and add bounded slots', () => {
    templates.savePack({
      id: 'workshop-brief-child',
      name: 'Workshop Brief Child',
      version: '1.0.0',
      basePackId: 'workshop-brief',
      page: { width: 1200, height: 1600, margin: 72 },
      slots: [{ id: 'subtitle', label: 'Subtitle', type: 'text', maxChars: 120 }]
    }, 'selftest');
    const resolved = templates.resolve('workshop-brief-child');
    assert.deepStrictEqual(resolved.inheritance, ['workshop-brief', 'workshop-brief-child']);
    assert(resolved.slots.some(item => item.id === 'provenance' && item.locked));
    assert(resolved.slots.some(item => item.id === 'subtitle'));
  });

  check('locked inherited slots cannot be redefined', () => {
    assert.throws(() => templates.savePack({
      id: 'invalid-child',
      basePackId: 'workshop-brief',
      slots: [{ id: 'provenance', label: 'Changed', type: 'text', locked: false, default: 'changed' }]
    }, 'selftest'), /locked inherited slot cannot be overridden/);
  });

  check('explicit export writes a digest-bearing reusable pack', () => {
    const receipt = templates.exportPack('workshop-brief-child', 'selftest');
    const output = path.join(root, receipt.file);
    const exported = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(exported.schema, 'axm.template-pack/v1');
    assert.equal(exported.id, 'workshop-brief-child');
    assert.match(receipt.sha256, /^[a-f0-9]{64}$/);
    assert.equal(fs.statSync(output).size, receipt.bytes);
  });

  check('browser surface uses the declared render and explicit export routes', () => {
    assert(app.includes("O.post('/api/template-runtime/render'"));
    assert(app.includes("O.post('/api/template-runtime/export'"));
    assert(app.includes("'x-axm-template':'explicit-export'"));
  });

  console.log('Template Runtime & Pack Engine selftest: PASS (' + pass + ' controls)');
} finally {
  cleanup();
}
