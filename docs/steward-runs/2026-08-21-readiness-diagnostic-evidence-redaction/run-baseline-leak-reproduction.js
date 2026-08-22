#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const BASELINE_COMMIT = 'f9558a2cb1427167c1cf7cc5e42f9fe35f086884';
const BASELINE_TREE = '24f5fbca08ca705932e47175105134c747fd84f1';

function git(args) {
  const result = childProcess.spawnSync('git', args, { cwd:ROOT, encoding:'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr || result.stdout || 'git failed'));
  return result.stdout;
}

const observedTree = String(git(['show', '-s', '--format=%T', BASELINE_COMMIT])).trim();
if (observedTree !== BASELINE_TREE) throw new Error('baseline tree mismatch');
const index = JSON.parse(git(['show', BASELINE_COMMIT + ':tools-index.json']));
const generator = git(['show', BASELINE_COMMIT + ':scripts/generate-tools-index.js']);
const readiness = git(['show', BASELINE_COMMIT + ':shared/readiness/tool-readiness.js']);
const rootForms = [ROOT, ROOT.replace(/\\/g, '/')].map(value => value.toLowerCase());
const results = index.tools.map(tool => tool && tool.selftest && tool.selftest.result).filter(Boolean);
const tails = results.map(result => result.failureTail).filter(value => typeof value === 'string' && value.length > 0);
const workspaceLeakTails = tails.filter(tail => rootForms.some(root => tail.toLowerCase().includes(root)));
const absolutePathTails = tails.filter(tail => /(^|[\s("'=])[A-Za-z]:[\\/]/m.test(tail) || /(^|[\s("'=])\\\\[^\\]/m.test(tail) || /(^|[\s("'=])\/(?!\/)/m.test(tail));

const receipt = {
  schema:'axm.readiness-diagnostic-path-leak-baseline/v1',
  status:'REPRODUCED',
  baselineCommit:BASELINE_COMMIT,
  baselineTree:BASELINE_TREE,
  source:{ exactGitBlobsInspected:true, workingTreeFilesUsed:false },
  observation:{
    retainedFailureTails:tails.length,
    failureTailsContainingAbsoluteMachinePaths:absolutePathTails.length,
    failureTailsContainingThisWorkspaceRoot:workspaceLeakTails.length,
    portableWorkspacePlaceholderPresent:tails.some(tail => tail.includes('<WORKSPACE>')),
    redactionTruthDeclared:index.truth && index.truth.failureDiagnosticsMachinePathRedacted === true
  },
  cause:{
    generatorSlicesRawFailureOutput:generator.includes("failureTail: code === 0 ? null : (stderr || stdout).slice(-1200)"),
    generatorStoresRawErrorMessage:generator.includes('failureTail: error.message'),
    readinessCopiesVerificationResultWithoutSanitizing:readiness.includes('new Map(rows.map(row => [row.id, row]))')
  },
  retention:{
    rawFailureTailsRetained:false,
    leakedMachinePathRetained:false,
    specialistPackagesInspected:false
  },
  truth:{
    allRepositoryMachinePathDebtAudited:false,
    secretsOrTokensDetected:false,
    historicalCommitsRewritten:false,
    externalDiagnosticsChanged:false,
    mergeAuthorized:false,
    canonAuthorized:false
  }
};
if (!workspaceLeakTails.length || !absolutePathTails.length || !receipt.cause.generatorSlicesRawFailureOutput || !receipt.cause.readinessCopiesVerificationResultWithoutSanitizing) {
  throw new Error('baseline path leak was not reproduced');
}
fs.writeFileSync(path.join(__dirname, 'BASELINE_MACHINE_PATH_LEAK.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log('REPRODUCED baseline diagnostic path leak: ' + absolutePathTails.length + ' of ' + tails.length + ' retained failure tails contain absolute machine paths');
