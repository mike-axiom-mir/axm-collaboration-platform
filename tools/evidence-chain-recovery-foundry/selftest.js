#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Retention = require('../../shared/evidence-retention/evidence-retention-service');
const Inspector = require('../evidence-chain-inspector/evidence-chain-core');
const Foundry = require('./evidence-chain-recovery-core');

async function main() {
  const root = __dirname;
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, manifest.entry), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

  assert.equal(manifest.id, 'evidence-chain-recovery-foundry');
  assert.equal(manifest.kind, 'product');
  assert.equal(manifest.status, 'TEST');
  assert.equal(manifest.risk, 'HIGH');
  assert.deepEqual(manifest.permissions, []);
  assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
  assert(contract.boundaries.refuses.includes('content-authenticity-claim'));
  assert(contract.boundaries.refuses.includes('candidate-without-authenticity-unknown-acknowledgement'));
  assert(contract.boundaries.refuses.includes('original-segment-mutation'));
  assert(contract.boundaries.refuses.includes('automatic-canon'));

  assert(/<html\b[^>]*\blang=/i.test(html));
  assert(/name=["']viewport["']/i.test(html));
  assert(html.includes('role="status"') && html.includes('aria-live="polite"'));
  ['sourceFile', 'receiptFile', 'acknowledgement'].forEach(id => assert(html.includes('for="' + id + '"'), id + ' needs a visible label'));
  const localScripts = Array.from(html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi), match => match[1]);
  assert.deepEqual(localScripts, ['../evidence-chain-inspector/evidence-chain-core.js', 'evidence-chain-recovery-core.js', 'app.js']);
  localScripts.forEach(source => assert(fs.existsSync(path.resolve(root, source)), source + ' must resolve to a local script'));
  assert(css.includes(':focus-visible'));
  assert(css.includes('min-height: 44px'));
  assert(!/\sonclick\s*=/i.test(html));

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-evidence-recovery-foundry-'));
  try {
    const workshop = path.join(temporary, 'workshop');
    const stateRoot = path.join(workshop, 'state');
    const logs = path.join(workshop, 'logs');
    fs.mkdirSync(logs, { recursive: true });
    const sourcePath = path.join(logs, 'source.jsonl');
    const manager = Retention.create({ stateRoot, limits: { maxEvents: 20, maxBytes: 1024 * 1024 } });
    const secret = 'PRIVATE-CANDIDATE-PAYLOAD';
    manager.record(sourcePath, { type: 'work-note', marker: secret, at: '2026-07-28T19:45:00.000Z' });
    manager.record(sourcePath, { type: 'repair-check', marker: secret, at: '2026-07-28T19:45:01.000Z' });
    const sealed = manager.seal('foundry-test');
    const segmentPath = path.join(workshop, sealed.manifest.sourceSegment);
    const validSource = fs.readFileSync(segmentPath, 'utf8');
    const brokenRows = validSource.trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
    brokenRows[0].payload.marker = secret + '-TAMPERED';
    const brokenSource = brokenRows.map(row => JSON.stringify(row)).join('\n') + '\n';
    const originalSnapshot = brokenSource;
    const inspection = await Inspector.inspect(brokenSource, { label: 'broken-test' });
    assert.equal(inspection.verdict, 'FAIL');
    assert(inspection.findings.every(row => Foundry.CORRECTABLE_ERRORS.includes(row.code)));

    await assert.rejects(() => Foundry.build(brokenSource, inspection, {}), /explicit acknowledgement/);
    const result = await Foundry.build(brokenSource, inspection, {
      acknowledgeAuthenticityUnknown: true,
      generatedAt: '2026-07-28T19:50:00.000Z'
    });
    assert.equal(brokenSource, originalSnapshot, 'source string is not mutated');
    assert.equal(result.receipt.schema, 'axm.evidence-chain-recovery-candidate/v1');
    assert.equal(result.receipt.capability, 'capability.prepare.evidence-chain-recovery-candidate/v1');
    assert.equal(result.receipt.status, 'STRUCTURAL_RECHAIN_CANDIDATE');
    assert.equal(result.receipt.verification.verdict, 'PASS');
    assert.equal(result.receipt.verification.chainState, 'VALID');
    assert.equal(result.receipt.source.nonHashSemanticSha256, result.receipt.candidate.nonHashSemanticSha256);
    assert.equal((await Inspector.inspect(result.candidateJsonl)).verdict, 'PASS');
    assert.notEqual(result.receipt.source.sha256, result.receipt.candidate.sha256);
    assert(result.receipt.candidate.changedEventHashLines.length >= 1);
    assert(result.receipt.candidate.changedPreviousHashLines.length >= 1);
    assert(result.candidateJsonl.includes(secret + '-TAMPERED'), 'candidate preserves selected payload object exactly');
    assert(!JSON.stringify(result.receipt).includes(secret));
    assert(!JSON.stringify(result.receipt).includes(sourcePath));
    assert(!JSON.stringify(result.receipt).includes(path.basename(segmentPath)));
    assert.equal(result.receipt.truth.candidateOnly, true);
    assert.equal(result.receipt.truth.structuralChainValid, true);
    assert.equal(result.receipt.truth.nonHashFieldsPreserved, true);
    assert.equal(result.receipt.truth.payloadObjectsPreserved, true);
    assert.equal(result.receipt.truth.byteIdentityPreserved, false);
    assert.equal(result.receipt.truth.formattingPreserved, false);
    assert.equal(result.receipt.truth.contentAuthenticityProven, false);
    assert.equal(result.receipt.truth.sourceHistoryRestored, false);
    ['originalModified', 'liveStateWritten', 'candidateApplied', 'sessionRecovered', 'serverStarted', 'authorityGranted', 'promoted', 'canon']
      .forEach(field => assert.equal(result.receipt.truth[field], false, field + ' must remain false'));

    const repeated = await Foundry.build(brokenSource, inspection, {
      acknowledgeAuthenticityUnknown: true,
      generatedAt: '2026-07-28T19:50:00.000Z'
    });
    assert.deepEqual(repeated, result, 'exact inputs and timestamp produce deterministic output');

    const other = await Inspector.example();
    const otherInspection = await Inspector.inspect(other);
    await assert.rejects(() => Foundry.build(brokenSource, otherInspection, { acknowledgeAuthenticityUnknown: true }), /not bound/);
    const validInspection = await Inspector.inspect(validSource);
    await assert.rejects(() => Foundry.build(validSource, validInspection, { acknowledgeAuthenticityUnknown: true }), /not an eligible broken chain/);

    const malformed = '{not-json}\n' + brokenSource;
    const malformedInspection = await Inspector.inspect(malformed);
    await assert.rejects(() => Foundry.build(malformed, malformedInspection, { acknowledgeAuthenticityUnknown: true }), /uncorrectable findings/);
    const missingRows = brokenSource.trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
    delete missingRows[0].schema;
    const missingSource = missingRows.map(row => JSON.stringify(row)).join('\n') + '\n';
    const missingInspection = await Inspector.inspect(missingSource);
    await assert.rejects(() => Foundry.build(missingSource, missingInspection, { acknowledgeAuthenticityUnknown: true }), /uncorrectable findings/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }

  const example = await Foundry.example();
  assert.equal(example.inspection.verdict, 'FAIL');
  const exampleResult = await Foundry.build(example.source, example.inspection, { acknowledgeAuthenticityUnknown: true, generatedAt: '2026-07-28T19:55:00.000Z' });
  assert.equal(exampleResult.receipt.verification.verdict, 'PASS');
  assert(app.includes('segment.text()') && app.includes('receipt.text()'));
  assert(app.includes('Blob') && app.includes('URL.createObjectURL'));
  assert(!app.includes('localStorage'));
  assert(!app.includes('fetch('));

  console.log('Evidence Chain Recovery Foundry selftest: PASS');
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
