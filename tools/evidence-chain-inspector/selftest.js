#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Retention = require('../../shared/evidence-retention/evidence-retention-service');
const Core = require('./evidence-chain-core');

async function main() {
  const root = __dirname;
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, manifest.entry), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

  assert.equal(manifest.id, 'evidence-chain-inspector');
  assert.equal(manifest.kind, 'product');
  assert.equal(manifest.status, 'TEST');
  assert.deepEqual(manifest.permissions, []);
  assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
  assert(contract.boundaries.refuses.includes('payload-or-source-echo'));
  assert(contract.boundaries.refuses.includes('automatic-chain-repair'));
  assert(contract.boundaries.refuses.includes('segment-delete'));
  assert(contract.boundaries.refuses.includes('automatic-canon'));

  assert(/<html\b[^>]*\blang=/i.test(html));
  assert(/name=["']viewport["']/i.test(html));
  assert(html.includes('role="status"') && html.includes('aria-live="polite"'));
  ['pastedInput', 'fileInput'].forEach(id => assert(html.includes('for="' + id + '"'), id + ' needs a visible label'));
  assert(css.includes(':focus-visible'));
  assert(css.includes('min-height: 44px'));
  assert(!/\sonclick\s*=/i.test(html));

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-evidence-chain-inspector-'));
  try {
    const workshop = path.join(temporary, 'workshop');
    const stateRoot = path.join(workshop, 'state');
    const logs = path.join(workshop, 'logs');
    fs.mkdirSync(logs, { recursive: true });
    const sourceFile = path.join(logs, 'synthetic-source.jsonl');
    const manager = Retention.create({ stateRoot, limits: { maxEvents: 50, maxBytes: 1024 * 1024 } });
    const secret = 'PRIVATE-PAYLOAD-MUST-NOT-LEAK';
    manager.record(sourceFile, { type: 'work-note', marker: secret, at: '2026-07-28T19:35:00.000Z' });
    manager.record(sourceFile, { type: 'repair-check', marker: secret, at: '2026-07-28T19:35:01.000Z' });
    const sealed = manager.seal('inspector-compatibility-test');
    assert.equal(sealed.sealed, true);
    const segmentFile = path.join(workshop, sealed.manifest.sourceSegment);
    const segment = fs.readFileSync(segmentFile, 'utf8');

    const valid = await Core.inspect(segment, { label: 'compatibility-fixture' });
    assert.equal(valid.schema, 'axm.evidence-chain-inspection/v1');
    assert.equal(valid.capability, 'capability.inspect.evidence-chain/v1');
    assert.equal(valid.verdict, 'PASS');
    assert.equal(valid.chainState, 'VALID');
    assert.equal(valid.summary.parsedEvents, 2);
    assert.equal(valid.summary.errors, 0);
    assert.equal(valid.summary.warnings, 0);
    assert.equal(valid.summary.firstBrokenLine, null);
    assert.equal(valid.truth.payloadFieldsReadForHash, true);
    assert.equal(valid.truth.payloadsEmitted, false);
    assert.equal(valid.truth.sourcesEmitted, false);
    assert.equal(valid.truth.rawLinesEmitted, false);
    assert.equal(valid.truth.fullPathsEmitted, false);
    assert.equal(valid.truth.automaticRepair, false);
    assert(!JSON.stringify(valid).includes(secret));
    assert(!JSON.stringify(valid).includes(sourceFile));
    assert(!JSON.stringify(valid).includes(path.basename(segmentFile)));

    const tamperedRows = segment.trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
    tamperedRows[0].payload.marker = 'CHANGED';
    const tampered = tamperedRows.map(row => JSON.stringify(row)).join('\n') + '\n';
    const tamperedReport = await Core.inspect(tampered, { label: 'tampered-fixture' });
    assert.equal(tamperedReport.verdict, 'FAIL');
    assert.equal(tamperedReport.chainState, 'BROKEN');
    assert.equal(tamperedReport.summary.firstBrokenLine, 1);
    assert(tamperedReport.findings.some(row => row.line === 1 && row.code === 'EVENT_HASH_MISMATCH'));

    const linkRows = segment.trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
    linkRows[1].previousHash = null;
    const linkReport = await Core.inspect(linkRows.map(row => JSON.stringify(row)).join('\n') + '\n');
    assert.equal(linkReport.verdict, 'FAIL');
    assert(linkReport.findings.some(row => row.line === 2 && row.code === 'PREVIOUS_HASH_MISMATCH'));
    assert(linkReport.findings.some(row => row.line === 2 && row.code === 'EVENT_HASH_MISMATCH'));

    const malformedReport = await Core.inspect('{not-json}\n' + segment);
    assert.equal(malformedReport.verdict, 'FAIL');
    assert.equal(malformedReport.summary.firstBrokenLine, 1);
    assert(malformedReport.findings.some(row => row.code === 'JSON_PARSE_ERROR'));
    const empty = await Core.inspect('');
    assert.equal(empty.verdict, 'UNKNOWN');
    assert.equal(empty.chainState, 'EMPTY');
    await assert.rejects(() => Core.inspect('x'.repeat(Core.MAX_BYTES + 1)), /10 MiB/);

    const cliStdin = spawnSync(process.execPath, [path.join(root, 'cli.js'), '--stdin'], { input: segment, encoding: 'utf8' });
    assert.equal(cliStdin.status, 0, cliStdin.stderr);
    const cliStdinReport = JSON.parse(cliStdin.stdout);
    assert.equal(cliStdinReport.verdict, 'PASS');
    assert.equal(cliStdinReport.source.label, 'stdin');
    assert(!cliStdin.stdout.includes(secret));

    const cliFile = spawnSync(process.execPath, [path.join(root, 'cli.js'), '--file', segmentFile], { encoding: 'utf8' });
    assert.equal(cliFile.status, 0, cliFile.stderr);
    const cliFileReport = JSON.parse(cliFile.stdout);
    assert.equal(cliFileReport.source.label, 'explicit-file');
    assert(!cliFile.stdout.includes(segmentFile));
    assert(!cliFile.stdout.includes(secret));

    const cliBroken = spawnSync(process.execPath, [path.join(root, 'cli.js'), '--stdin'], { input: tampered, encoding: 'utf8' });
    assert.equal(cliBroken.status, 2);
    assert.equal(JSON.parse(cliBroken.stdout).verdict, 'FAIL');
    const cliRefusal = spawnSync(process.execPath, [path.join(root, 'cli.js'), '--stdin', '--file', segmentFile], { input: segment, encoding: 'utf8' });
    assert.equal(cliRefusal.status, 1);
    assert.match(cliRefusal.stderr, /choose exactly one/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }

  const example = await Core.example();
  assert.equal((await Core.inspect(example)).verdict, 'PASS');
  assert(app.includes('file.text()'));
  assert(app.includes('Blob') && app.includes('URL.createObjectURL'));
  assert(!app.includes('localStorage'));
  assert(!app.includes('fetch('));

  console.log('Evidence Chain Inspector selftest: PASS');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
