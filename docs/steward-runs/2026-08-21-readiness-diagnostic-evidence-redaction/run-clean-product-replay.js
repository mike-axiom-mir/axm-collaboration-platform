#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const PRODUCT_COMMIT = '0533987856b321d67ede5f6d8a3fd8867f9cfbfb';
const PRODUCT_TREE = '6007cd2fc1143df2f2cf81ecc4639eed28c3274d';
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
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function snapshot(root, names) {
  const values = {};
  names.forEach(name => { values[name] = sha(fs.readFileSync(path.join(root, name))); });
  return values;
}

const container = fs.mkdtempSync(path.join(path.parse(ROOT).root, 'p46-'));
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
    return {
      command:'node ' + args.join(' '),
      exitCode:Number.isInteger(result.status) ? result.status : 1,
      verdict:result.status === 0 ? 'PASS' : 'FAIL',
      outputSha256:'sha256:' + sha(output),
      diagnostic:result.status === 0 ? null : String(result.stderr || result.stdout || result.error || '').trim().slice(-1000)
    };
  });

  const fixtureRoot = path.join(container, 'synthetic-readiness-root');
  const toolRoot = path.join(fixtureRoot, 'tools', 'fixture-tool');
  fs.mkdirSync(toolRoot, { recursive:true });
  fs.writeFileSync(path.join(toolRoot, 'manifest.json'), JSON.stringify({
    schema:'axm.tool-manifest/v1', kind:'product', id:'fixture-tool', name:'Fixture Tool', version:'v1', status:'WORKING',
    entry:'index.html', contract:'module.contract.json', uses:[], permissions:[], verifiedAt:'2026-08-21T00:00:00.000Z'
  }));
  fs.writeFileSync(path.join(toolRoot, 'module.contract.json'), JSON.stringify({
    schema:'axm.module-contract/v1', id:'fixture-tool', version:'v1', provides:[], consumes:[], permissions:[],
    handoffs:{ emits:[], accepts:[] }, boundaries:{ refuses:['automatic-promotion'] }
  }));
  fs.writeFileSync(path.join(toolRoot, 'index.html'), '<!doctype html><title>fixture</title>');
  fs.writeFileSync(path.join(toolRoot, 'selftest.js'), "console.log('PASS');\n");
  const Readiness = require(path.join(container, 'shared', 'readiness', 'tool-readiness.js'));
  const preliminary = Readiness.buildIndex(fixtureRoot, { now:'2026-08-21T12:00:00.000Z' });
  const rawTail = 'Error at ' + path.join(fixtureRoot, 'tools', 'fixture-tool', 'selftest.js') + ':7:1';
  const integrated = Readiness.buildIndex(fixtureRoot, {
    now:'2026-08-21T12:00:00.000Z',
    verificationResults:{ results:[{ id:'fixture-tool', selftestSha256:preliminary.tools[0].selftest.sha256, verdict:'FAIL', failureTail:rawTail }] }
  });
  const integratedTail = integrated.tools[0].selftest.result.failureTail;
  const integration = {
    verdict:integratedTail.includes('<WORKSPACE>') && !integratedTail.includes(fixtureRoot) && rawTail.includes(fixtureRoot) ? 'PASS' : 'FAIL',
    portableWorkspaceContextRetained:integratedTail.includes('<WORKSPACE>'),
    absoluteFixtureRootRetained:integratedTail.includes(fixtureRoot),
    sourceReceiptMutated:!rawTail.includes(fixtureRoot)
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
    archiveSha256:'sha256:' + sha(fs.readFileSync(archiveFile)),
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
  const digestBody = JSON.parse(JSON.stringify(receipt));
  delete digestBody.replayDigest;
  receipt.replayDigest = 'sha256:' + sha(JSON.stringify(digestBody));
  fs.writeFileSync(path.join(__dirname, 'CLEAN_PRODUCT_REPLAY.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(receipt.status + ' clean product replay: ' + receipt.summary.passed + '/' + receipt.summary.commands + ' commands, ingestion ' + integration.verdict + ', ' + names.length + ' unchanged tracked files');
  if (receipt.status !== 'PASS') process.exitCode = 1;
} finally {
  if (fs.existsSync(container)) fs.rmSync(container, { recursive:true, force:true, maxRetries:10, retryDelay:100 });
  if (fs.existsSync(container)) {
    console.error('clean product replay cleanup failed');
    process.exitCode = 1;
  }
}
