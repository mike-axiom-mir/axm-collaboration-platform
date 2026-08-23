#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const PRODUCT_COMMIT = '7b146a36d3e05041954050c7d5d5cd74440f6b50';
const PRODUCT_TREE = 'a27d5fcb82b614d5e9ca7fc5f7a3624ac81234a6';
const slicePaths = [
  'package.json',
  'scripts/daily-verification.js',
  'scripts/generate-tools-index.js',
  'shared/readiness',
  'hub/module-contract-verifier.js',
  'tools-index.json'
];
const commands = [
  ['--check','shared/readiness/diagnostic-redaction.js'],
  ['--check','scripts/generate-tools-index.js'],
  ['--check','scripts/daily-verification.js'],
  ['shared/readiness/diagnostic-redaction-selftest.js'],
  ['shared/readiness/tools-index-diagnostic-privacy-selftest.js']
];
function run(executable, args, options) {
  return childProcess.spawnSync(executable, args, Object.assign({ encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:64 * 1024 * 1024 }, options));
}
function git(args, cwd, encoding) { return run('git', args, { cwd, encoding:encoding === null ? null : 'utf8' }); }
function sha(value) { return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex'); }
function snapshot(root, names) {
  return Object.fromEntries(names.map(name => [name, sha(fs.readFileSync(path.join(root, name)))]));
}

const container = fs.mkdtempSync(path.join(path.parse(ROOT).root, 'p47-'));
const archiveFile = path.join(container, 'product.tar');
try {
  const observedTree = String(git(['show','-s','--format=%T',PRODUCT_COMMIT], ROOT).stdout || '').trim();
  if (observedTree !== PRODUCT_TREE) throw new Error('product tree identity mismatch');
  const archive = git(['archive','--format=tar','--output',archiveFile,PRODUCT_COMMIT,'--',...slicePaths], ROOT);
  if (archive.status !== 0) throw new Error('archive creation failed');
  const extract = run('tar', ['-xf',archiveFile,'-C',container], { cwd:ROOT });
  if (extract.status !== 0) throw new Error('archive extraction failed');
  const listing = git(['ls-tree','-r','--name-only','-z',PRODUCT_COMMIT,'--',...slicePaths], ROOT);
  const names = String(listing.stdout || '').split('\0').filter(Boolean);
  const before = snapshot(container, names);
  const results = commands.map(args => {
    const result = run(process.execPath, args, { cwd:container });
    const output = String(result.stdout || '') + String(result.stderr || '');
    return { command:'node ' + args.join(' '), exitCode:Number.isInteger(result.status) ? result.status : 1, verdict:result.status === 0 ? 'PASS' : 'FAIL', outputSha256:sha(output), diagnosticCode:result.status === 0 ? null : 'COMMAND_NONZERO' };
  });

  const fixtureRoot = path.join(container, 'synthetic-readiness-root');
  const toolRoot = path.join(fixtureRoot, 'tools', 'fixture-tool');
  fs.mkdirSync(toolRoot, { recursive:true });
  fs.writeFileSync(path.join(toolRoot, 'manifest.json'), JSON.stringify({ schema:'axm.tool-manifest/v1', kind:'product', id:'fixture-tool', name:'Fixture Tool', version:'v1', status:'WORKING', entry:'index.html', contract:'module.contract.json', uses:[], permissions:[], verifiedAt:'2026-08-21T00:00:00.000Z' }));
  fs.writeFileSync(path.join(toolRoot, 'module.contract.json'), JSON.stringify({ schema:'axm.module-contract/v1', id:'fixture-tool', version:'v1', provides:[], consumes:[], permissions:[], handoffs:{ emits:[], accepts:[] }, boundaries:{ refuses:['automatic-promotion'] } }));
  fs.writeFileSync(path.join(toolRoot, 'index.html'), '<!doctype html><title>fixture</title>');
  fs.writeFileSync(path.join(toolRoot, 'selftest.js'), "console.log('PASS');\n");
  const Readiness = require(path.join(container, 'shared', 'readiness', 'tool-readiness.js'));
  const preliminary = Readiness.buildIndex(fixtureRoot, { now:'2026-08-21T12:00:00.000Z' });
  const fixtureCredential = ['axm','fixture','credential'].join('-');
  const rawTail = 'Authorization: Bearer ' + fixtureCredential + '\nError at ' + path.join(fixtureRoot, 'tools', 'fixture-tool', 'selftest.js') + ':7:1';
  const sourceResult = { id:'fixture-tool', selftestSha256:preliminary.tools[0].selftest.sha256, verdict:'FAIL', outputSha256:'b'.repeat(64), failureTail:rawTail };
  const sourceBefore = JSON.stringify(sourceResult);
  const integrated = Readiness.buildIndex(fixtureRoot, { now:'2026-08-21T12:00:00.000Z', verificationResults:{ results:[sourceResult] } });
  const derived = integrated.tools[0].selftest.result;
  const integration = {
    verdict:derived.failureTail.includes('<WORKSPACE>') && derived.failureTail.includes('<REDACTED_CREDENTIAL>') && !derived.failureTail.includes(fixtureRoot) && !derived.failureTail.includes(fixtureCredential) && derived.outputSha256 === sourceResult.outputSha256 && JSON.stringify(sourceResult) === sourceBefore ? 'PASS' : 'FAIL',
    portableWorkspaceContextRetained:derived.failureTail.includes('<WORKSPACE>'),
    explicitCredentialMarkerRetained:derived.failureTail.includes('<REDACTED_CREDENTIAL>'),
    absoluteFixtureRootRetained:derived.failureTail.includes(fixtureRoot),
    recognizedFixtureCredentialRetained:derived.failureTail.includes(fixtureCredential),
    rawOutputDigestPreserved:derived.outputSha256 === sourceResult.outputSha256,
    sourceReceiptMutated:JSON.stringify(sourceResult) !== sourceBefore,
    qualifiedTruthDeclared:integrated.truth.failureDiagnosticsRecognizedCredentialEvidenceRedacted === true
  };
  fs.rmSync(fixtureRoot, { recursive:true, force:true });
  const after = snapshot(container, names);
  const changed = names.filter(name => before[name] !== after[name]);
  const receipt = {
    schema:'axm.clean-archived-product-replay/v1',
    status:results.every(row => row.verdict === 'PASS') && integration.verdict === 'PASS' && !changed.length ? 'PASS' : 'FAIL',
    productCommit:PRODUCT_COMMIT,
    productTree:PRODUCT_TREE,
    slicePaths,
    archiveSha256:sha(fs.readFileSync(archiveFile)),
    trackedFiles:names.length,
    summary:{ commands:results.length, passed:results.filter(row => row.verdict === 'PASS').length, failed:results.filter(row => row.verdict !== 'PASS').length },
    commands:results,
    syntheticReadinessIngestion:integration,
    trackedFilesUnchangedAfterReplay:changed.length === 0,
    changedTrackedFiles:changed,
    sourceCheckoutOrSharedMainMutated:false,
    temporaryReplayPathRetained:false,
    replayDigest:null
  };
  const body = JSON.parse(JSON.stringify(receipt)); delete body.replayDigest;
  receipt.replayDigest = sha(JSON.stringify(body));
  fs.writeFileSync(path.join(__dirname, 'CLEAN_PRODUCT_REPLAY.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(receipt.status + ' clean product replay: ' + receipt.summary.passed + '/' + receipt.summary.commands + ' commands, ingestion ' + integration.verdict + ', ' + names.length + ' unchanged tracked files');
  if (receipt.status !== 'PASS') process.exitCode = 1;
} finally {
  if (fs.existsSync(container)) fs.rmSync(container, { recursive:true, force:true, maxRetries:10, retryDelay:100 });
  if (fs.existsSync(container)) { console.error('clean product replay cleanup failed'); process.exitCode = 1; }
}

