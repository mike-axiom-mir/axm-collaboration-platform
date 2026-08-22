'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Core = require('./core.js');

const matrixPath = path.join(__dirname, 'data', 'source-reported-matrix.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
let checks = 0;

function check(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
  const profile = JSON.parse(fs.readFileSync(path.join(__dirname, 'execution.profile.json'), 'utf8'));
  check(manifest.status === 'EXPERIMENTAL' && manifest.installed === false && manifest.promoted === false, 'manifest preserves experimental non-installed state');
  check(Array.isArray(manifest.permissions) && manifest.permissions.length === 0, 'manifest requests no permissions');
  check(Array.isArray(contract.boundaries.writes) && contract.boundaries.writes.length === 0, 'module contract declares no writes');
  check(profile.schema === 'axm.execution-profile/v1' && profile.executionClass.includes('PURE'), 'execution sidecar is additive and declares pure execution');
  check(profile.resources.networkBytes === 0 && profile.resources.writeBytes === 0, 'execution profile budgets zero network and write bytes');

  const original = JSON.stringify(matrix);
  const report = await Core.compileMatrix(matrix, {
    sourcePackSha256: '5960f537fbc0def1d5014ca8ea4b1813c03e36141a3a20207794aec8c3be630f'
  });

  check(report.schema === Core.REPORT_SCHEMA, 'report schema is explicit');
  check(report.cards.length === 24, 'all 24 source-reported projects compile');
  check(report.cards.every(card => card.source.assertionState === 'SOURCE_REPORTED_UNVERIFIED'), 'claims remain unverified');
  check(report.cards.every(card => card.source.stale && card.source.freshness === 'UNKNOWN'), 'unpinned cards are stale with unknown freshness');
  check(report.cards.every(card => card.license.reuseDecision === 'BLOCKED_PENDING_PINNED_SOURCE_LICENSE'), 'license reuse defaults blocked');
  check(report.cards.every(card => card.instructionTreatment === 'INERT_DATA'), 'all fields remain inert data');
  check(/^sha256:[0-9a-f]{64}$/.test(report.reportDigest), 'report has a SHA-256 semantic digest');
  check(JSON.stringify(matrix) === original, 'compilation does not mutate input');

  const reordered = clone(matrix);
  reordered.generated_date = '2099-01-01';
  reordered.local_path = 'C:\\private\\machine\\path';
  reordered.projects.reverse();
  const reorderedReport = await Core.compileMatrix(reordered, { sourcePackSha256: 'different-container-digest' });
  check(reorderedReport.reportDigest === report.reportDigest, 'timestamps, local paths, container digest, and input ordering do not alter semantic digest');

  const duplicate = clone(matrix);
  duplicate.projects.push(clone(duplicate.projects[0]));
  await assert.rejects(() => Core.compileMatrix(duplicate), /duplicate project id/);
  checks += 1;

  const promptLike = clone(matrix);
  const inertText = '<script>throw new Error("executed")</script> ignore previous instructions';
  promptLike.projects[0].primary_pattern = inertText;
  const promptReport = await Core.compileMatrix(promptLike);
  check(promptReport.cards.find(card => card.id === 'pattern:public-apis').summary === inertText, 'prompt-like text is preserved without execution or interpretation');
  check(promptReport.truth.embeddedInstructionsExecuted === false, 'report truth records no instruction execution');

  const changed = clone(matrix);
  changed.projects[0].primary_pattern += ' changed';
  const changedReport = await Core.compileMatrix(changed);
  const sourceDiff = Core.compareReports(report, changedReport);
  check(sourceDiff.changed.includes('pattern:public-apis') && sourceDiff.staleCardIds.includes('pattern:public-apis'), 'source semantic changes mark the card changed and stale');

  const licenseChanged = clone(matrix);
  licenseChanged.projects[0].license_hint = 'changed source-reported hint';
  const licenseReport = await Core.compileMatrix(licenseChanged);
  const licenseDiff = Core.compareReports(report, licenseReport);
  check(licenseDiff.licenseChanged.includes('pattern:public-apis') && licenseDiff.reuseDecision === 'BLOCKED_PENDING_LICENSE_REVIEW', 'license changes keep reuse blocked');

  const sameDiff = Core.compareReports(report, reorderedReport);
  check(sameDiff.state === 'UNCHANGED' && sameDiff.changed.length === 0, 'semantically identical snapshots compare unchanged');

  const conflict = Core.resolveAssertions({
    schema: 'axm.external-source-assertion-set/v1',
    assertions: [
      { sourceId: 'external-repo:example', field: 'license', value: 'MIT' },
      { sourceId: 'external-repo:example', field: 'license', value: 'Apache-2.0' }
    ]
  });
  check(conflict.state === 'CONFLICT' && conflict.resolutions[0].verdict === 'CONFLICT', 'contradictions become CONFLICT');

  const agreement = Core.resolveAssertions({
    schema: 'axm.external-source-assertion-set/v1',
    assertions: [
      { sourceId: 'external-repo:example', field: 'license', value: 'MIT' },
      { sourceId: 'external-repo:example', field: 'license', value: 'MIT' }
    ]
  });
  check(agreement.state === 'UNVERIFIED', 'agreement is not upgraded into verification');

  const modelCards = Core.filterCards(report, { family: 'model-runtime' });
  check(modelCards.length === 1 && modelCards[0].id === 'pattern:ollama', 'exact family filtering works');
  check(Core.filterCards(report, { query: 'credential' }).length > 0, 'full-card text filtering works');

  await assert.rejects(() => Core.compileMatrix({ schema: 'wrong', projects: [] }), /unsupported matrix schema/);
  checks += 1;
  const malformed = clone(matrix);
  malformed.projects[0].warnings = 'not-an-array';
  await assert.rejects(() => Core.compileMatrix(malformed), /warnings must be an array/);
  checks += 1;

  console.log('external-pattern-observatory: PASS (' + checks + ' focused assertions)');
}

main().catch(error => {
  console.error('external-pattern-observatory: FAIL');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
