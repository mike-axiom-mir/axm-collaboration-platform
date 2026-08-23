#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const Module = require('module');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const BASELINE_COMMIT = 'd8e6644ce9d5bfd54fd0f122ebd9ebccbb2f7849';
const PRODUCT_COMMIT = '7b146a36d3e05041954050c7d5d5cd74440f6b50';

function git(args, encoding) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:encoding === null ? null : 'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('git object read failed');
  return result.stdout;
}
function loadModule(commit, name) {
  const source = String(git(['show', commit + ':' + name]));
  const instance = new Module(name, module);
  instance.filename = path.join(ROOT, name);
  instance.paths = Module._nodeModulePaths(path.dirname(instance.filename));
  instance._compile(source, instance.filename);
  return instance.exports;
}
function sha(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
function attachDigest(receipt) {
  const body = JSON.parse(JSON.stringify(receipt));
  delete body.receiptDigest;
  receipt.receiptDigest = sha(JSON.stringify(body));
  return receipt;
}

const baselineRedaction = loadModule(BASELINE_COMMIT, 'shared/readiness/diagnostic-redaction.js');
const productRedaction = loadModule(PRODUCT_COMMIT, 'shared/readiness/diagnostic-redaction.js');
const fixture = ['axm', 'fixture', 'credential'].join('-');
const cases = {
  authorization:'Authorization: Bearer ' + fixture,
  environment:'OPENAI_API_KEY=' + fixture,
  cli:'--api-key ' + fixture,
  userInfo:'https://fixture-user:fixture-pass@example.test/status',
  query:'https://example.test/status?access_token=' + fixture + '&mode=read'
};
function observe(redactor, value) {
  const output = redactor.redactDiagnostic(value);
  return {
    changed:output !== value,
    markerPresent:output.includes('<REDACTED_CREDENTIAL>'),
    fixtureAbsent:!output.includes(fixture) && !output.includes('fixture-pass')
  };
}
const baselineCases = Object.fromEntries(Object.entries(cases).map(([name, value]) => [name, observe(baselineRedaction, value)]));
const productCases = Object.fromEntries(Object.entries(cases).map(([name, value]) => [name, observe(productRedaction, value)]));
const baselineIndex = JSON.parse(String(git(['show', BASELINE_COMMIT + ':tools-index.json'])));
const productIndex = JSON.parse(String(git(['show', PRODUCT_COMMIT + ':tools-index.json'])));
function project(index) {
  return index.tools.map(tool => ({
    id:tool.id,
    result:tool.selftest && tool.selftest.result ? {
      verdict:tool.selftest.result.verdict,
      exitCode:tool.selftest.result.exitCode,
      outputSha256:tool.selftest.result.outputSha256,
      failureTail:tool.selftest.result.failureTail
    } : null
  }));
}
const tails = productIndex.tools.map(tool => tool.selftest && tool.selftest.result && tool.selftest.result.failureTail).filter(value => typeof value === 'string' && value);
const receipt = attachDigest({
  schema:'axm.readiness-diagnostic-credential-boundary-probes/v1',
  status:Object.values(baselineCases).every(row => !row.changed) && Object.values(productCases).every(row => row.changed && row.markerPresent && row.fixtureAbsent) ? 'PASS' : 'FAIL',
  baselineCommit:BASELINE_COMMIT,
  productCommit:PRODUCT_COMMIT,
  baseline:{ cases:baselineCases, recognizedCredentialTruthDeclared:baselineIndex.truth.failureDiagnosticsRecognizedCredentialEvidenceRedacted === true },
  product:{ cases:productCases, recognizedCredentialTruthDeclared:productIndex.truth.failureDiagnosticsRecognizedCredentialEvidenceRedacted === true },
  nonRegression:{
    toolCount:productIndex.tools.length,
    failureTails:tails.length,
    summariesExact:JSON.stringify(baselineIndex.summary) === JSON.stringify(productIndex.summary),
    sourceDigestsExact:baselineIndex.sourceDigest === productIndex.sourceDigest,
    verdictHashesAndTailsExact:JSON.stringify(project(baselineIndex)) === JSON.stringify(project(productIndex)),
    currentTailsIdempotentlySanitized:tails.every(tail => productRedaction.redactDiagnostic(tail, { workspaceRoot:ROOT }) === tail)
  },
  rawFixtureValuesRetained:false,
  receiptDigest:null
});
fs.writeFileSync(path.join(__dirname, 'BOUNDARY_PROBES.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(receipt.status + ' boundary probes: baseline 5/5 unchanged, product 5/5 sanitized, ' + tails.length + ' current tails stable');
if (receipt.status !== 'PASS') process.exitCode = 1;

