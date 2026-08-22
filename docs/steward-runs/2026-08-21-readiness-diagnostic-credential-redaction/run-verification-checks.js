#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const PRODUCT_COMMIT = '7b146a36d3e05041954050c7d5d5cd74440f6b50';
const npmExecutable = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
const npmArgs = process.platform === 'win32' ? ['/d','/s','/c','npm run test:readiness'] : ['run','test:readiness'];
const checks = [
  ['focused-direct', process.execPath, ['shared/readiness/diagnostic-redaction-selftest.js']],
  ['focused-artifact', process.execPath, ['shared/readiness/tools-index-diagnostic-privacy-selftest.js']],
  ['focused-ingestion', process.execPath, ['shared/readiness/selftest.js']],
  ['focused-observer', process.execPath, ['shared/readiness/readiness-observer-selftest.js']],
  ['package-paths', process.execPath, ['scripts/package-script-path-selftest.js']],
  ['world-registry', process.execPath, ['worlds/world-registry-selftest.js']],
  ['readiness-package', npmExecutable, npmArgs, 'npm run test:readiness'],
  ['required-verify', process.execPath, ['verify.js']],
  ['required-hub', process.execPath, ['hub/hub-selftest.js']],
  ['required-route', process.execPath, ['hub/route-selftest.js']],
  ['required-graft', process.execPath, ['hub/graft-selftest.js']],
  ['required-skin', process.execPath, ['hub/skin-selftest.js']],
  ['required-verify-plus', process.execPath, ['hub/verify-plus.js']],
  ['required-html-syntax', process.execPath, ['tests/html-script-syntax-test.js']],
  ['required-tool-forge-package', process.execPath, ['tests/tool-forge-package-test.js']],
  ['required-agent-tool-forge', process.execPath, ['tools/agent-tool-forge/selftest.js']],
  ['required-evidence-desk', process.execPath, ['tools/evidence-desk/selftest.js']]
];

function sha(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
const results = checks.map(([id, executable, args, commandLabel]) => {
  const started = Date.now();
  const result = childProcess.spawnSync(executable, args, { cwd:ROOT, encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:64 * 1024 * 1024 });
  const output = String(result.stdout || '') + String(result.stderr || '');
  const assertion = output.match(/PASS \((\d+) assertions/);
  const packagePaths = output.match(/PASS \((\d+) file references\)/);
  return {
    id,
    command:commandLabel || (executable === process.execPath ? 'node ' : '') + args.join(' '),
    verdict:result.status === 0 ? 'PASS' : 'FAIL',
    exitCode:Number.isInteger(result.status) ? result.status : 1,
    durationMs:Date.now() - started,
    outputSha256:sha(output),
    reportedAssertions:assertion ? Number(assertion[1]) : null,
    reportedFileReferenceControls:packagePaths ? Number(packagePaths[1]) : null,
    diagnosticCode:result.status === 0 ? null : 'COMMAND_NONZERO'
  };
});
const required = results.filter(row => row.id.startsWith('required-'));
const receipt = {
  schema:'axm.scoped-check-results/v1',
  status:results.every(row => row.verdict === 'PASS') ? 'PASS' : 'FAIL',
  productCommit:PRODUCT_COMMIT,
  summary:{ commands:results.length, passed:results.filter(row => row.verdict === 'PASS').length, failed:results.filter(row => row.verdict !== 'PASS').length },
  requiredChecks:{ commands:required.length, passed:required.filter(row => row.verdict === 'PASS').length },
  focusedAssertions:results.filter(row => ['focused-direct','focused-artifact'].includes(row.id)).reduce((sum, row) => sum + Number(row.reportedAssertions || 0), 0),
  packagePathControls:results.find(row => row.id === 'package-paths').reportedFileReferenceControls,
  rawCommandLogsRetained:false,
  results,
  receiptDigest:null
};
const body = JSON.parse(JSON.stringify(receipt)); delete body.receiptDigest;
receipt.receiptDigest = sha(JSON.stringify(body));
fs.writeFileSync(path.join(__dirname, 'CHECK_RESULTS.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(receipt.status + ' verification: ' + receipt.summary.passed + '/' + receipt.summary.commands + ' commands, required ' + receipt.requiredChecks.passed + '/' + receipt.requiredChecks.commands + ', focused assertions ' + receipt.focusedAssertions);
if (receipt.status !== 'PASS') process.exitCode = 1;
