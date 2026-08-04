#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Sync = require('../../shared/operations/github-sync-service');
const ContractVerifier = require('../../hub/module-contract-verifier');

function git(executable, cwd, args) {
  const result = childProcess.spawnSync(executable, ['-C', cwd].concat(args), { encoding:'utf8', windowsHide:true, shell:false, timeout:30000 });
  if (result.error || result.status !== 0) throw new Error(String(result.stderr || result.stdout || result.error));
  return String(result.stdout || '').trim();
}

(async () => {
  const moduleRoot = __dirname;
  const read = name => fs.readFileSync(path.join(moduleRoot, name), 'utf8');
  const manifest = JSON.parse(read('manifest.json'));
  const contract = JSON.parse(read('module.contract.json'));
  const futureVerifier = JSON.parse(read('future-heartbeat-verifier.json'));
  const html = read('index.html');
  const app = read('sync-app.js');
  const runner = read('sync-runner.js');
  const kernel = await import(pathToFileURL(path.join(moduleRoot, '..', 'p34-release-foundation', 'p34-kernel.mjs')).href);
  const verifier = await import(pathToFileURL(path.join(moduleRoot, '..', 'p34-release-foundation', 'p34-verifier.mjs')).href);
  let checks = 0;
  const ok = (value, message) => { assert.ok(value, message); checks++; };

  ok(manifest.id === 'source-control-merge-workbench' && manifest.version === 'v0.4' && manifest.status === 'TEST', 'real sync module identity and TEST status');
  ok(manifest.rank === 43 && manifest.phase === 'P3' && manifest.category === 'Build', 'roadmap placement');
  ok(contract.id === manifest.id && contract.version === manifest.version, 'contract identity');
  ok(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates against the modern manifest');
  ok(contract.provides.includes('manual-digest-locked-github-sync'), 'manual digest-locked sync capability declared');
  ok(contract.provides.includes('bounded-github-sync-plan-summary') && contract.provides.includes('failed-push-clean-state-recovery'), 'bounded review and failed-push recovery capabilities declared');
  ok(contract.boundaries.refuses.includes('direct-main-push') && contract.boundaries.refuses.includes('credential-storage') && contract.boundaries.refuses.includes('unattended-github-push'), 'main, credential, and unattended boundaries');
  ok(html.includes('data-module="source-control-merge-workbench"') && html.includes('Deterministic GitHub push'), 'visible manual sync route');
  ok(app.includes('/api/github-sync/manual-push') && app.includes('/api/github-sync/plan/full') && app.includes('pollJob') && runner.includes('--manual-reviewed-push'), 'UI exports exact plans and routes manual push through a background job');
  ok(html.includes('id="sync-verify" type="button" disabled') && html.includes('id="sync-run" type="button" disabled'), 'verify and push controls fail closed before a plan exists');
  ok(!app.includes('github-sync-authorized') && !html.includes('--execute-authorized-config'), 'visible path exposes no unattended execution');
  ok(futureVerifier.status === 'PARKED' && futureVerifier.trigger.defaultEnabled === false, 'future Heartbeat verifier is parked and off');
  ok(Object.values(futureVerifier.authority).every(value => value === false), 'future Heartbeat verifier has no write, PR, merge, promotion, or CANON authority');
  const a = await kernel.sealP34Scenario(kernel.runP34Scenario(manifest.id));
  const b = await kernel.sealP34Scenario(kernel.runP34Scenario(manifest.id));
  ok(a.status === 'pass' && a.summary.failed === 0, 'legacy merge-review proof remains accepted');
  ok(a.receiptSha256 === b.receiptSha256, 'legacy proof remains deterministic');
  ok(verifier.verifyP34Scenario(a).status === 'pass', 'independent merge-review verification remains valid');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-github-sync-selftest-'));
  try {
    const sourceRoot = path.join(temp, 'source');
    const repositoryRoot = path.join(temp, 'working-copy');
    const remoteRoot = path.join(temp, 'remote.git');
    const stateRoot = path.join(temp, 'state');
    fs.mkdirSync(path.join(sourceRoot, 'tools', 'demo'), { recursive:true });
    fs.writeFileSync(path.join(sourceRoot, 'README.md'), 'current public Workshop\n');
    fs.writeFileSync(path.join(sourceRoot, 'tools', 'demo', 'index.js'), "console.log('demo');\n");
    const gitExecutable = Sync.resolveGit({});
    ok(!!gitExecutable, 'local Git runtime is available');
    fs.mkdirSync(repositoryRoot, { recursive:true });
    git(gitExecutable, temp, ['init','--bare',remoteRoot]);
    git(gitExecutable, temp, ['init','-b','automation/workshop-sync',repositoryRoot]);
    fs.writeFileSync(path.join(repositoryRoot, 'README.md'), 'old public Workshop\n');
    git(gitExecutable, repositoryRoot, ['add','README.md']);
    git(gitExecutable, repositoryRoot, ['-c','user.name=Selftest','-c','user.email=selftest@example.invalid','commit','-m','initial']);
    git(gitExecutable, repositoryRoot, ['remote','add','origin',remoteRoot]);

    const service = Sync.create({ root:sourceRoot, stateRoot, gitExecutable, allowLocalRemote:true });
    assert.throws(() => service.configure({ repositoryRoot, remoteName:'origin', targetBranch:'main', authorEmail:'sync@example.invalid', confirmation:Sync.CONFIG_CONFIRMATION }), /automation\//);
    assert.throws(() => service.configure({
      repositoryRoot, remoteName:'origin', targetBranch:'automation/workshop-sync', authorName:'AXM Sync Selftest', authorEmail:'sync@example.invalid',
      enabled:true, pushEnabled:true, approvedBy:'Mike', actor:'Mike', confirmation:Sync.CONFIG_CONFIRMATION
    }), /unattended push is reserved/);
    const configured = service.configure({
      repositoryRoot, remoteName:'origin', targetBranch:'automation/workshop-sync', authorName:'AXM Sync Selftest', authorEmail:'sync@example.invalid',
      enabled:true, pushEnabled:false, actor:'Mike', confirmation:Sync.CONFIG_CONFIRMATION
    });
    ok(configured.capability === 'MANUAL_REVIEW_READY' && configured.config.pushEnabled === false && configured.truth.directMainPush === false, 'configuration enables manual planning without unattended authority');
    const plan = service.buildPlan();
    ok(plan.executable && plan.changes.length === 2 && plan.source.publicSafety === 'PASS', 'dry plan finds exact public-safe additions and updates');
    ok(!plan.unattendedExecutable && plan.truth.commitWrites === false && plan.truth.pushWrites === false, 'dry plan performs no writes and grants no unattended execution');
    const planSummary = service.buildPlanSummary();
    ok(planSummary.schema === Sync.PLAN_SUMMARY_SCHEMA && planSummary.planDigest === plan.planDigest && planSummary.counts.changes === 2, 'bounded plan summary preserves the exact full-plan digest and counts');
    ok(!Object.prototype.hasOwnProperty.call(planSummary, 'changes') && planSummary.sampleChanges.length <= 40 && planSummary.largestChanges.length <= 12, 'plan summary bounds rendered review material');
    ok(service.buildExactPlan(plan.planDigest).planDigest === plan.planDigest, 'full plan export requires and returns the exact current digest');
    assert.throws(() => service.buildExactPlan('0'.repeat(64)), /reviewed plan digest is stale/);
    const verification = service.verifyPlan(plan.planDigest);
    ok(verification.state === 'PASS' && verification.currentPlanDigest === plan.planDigest, 'read-only verifier accepts the exact current plan');
    assert.throws(() => service.executeManual({ planDigest:plan.planDigest, confirmation:'PUSH IT', actor:'Mike' }), /exact reviewed public snapshot confirmation/);
    assert.throws(() => service.executeManual({ planDigest:'0'.repeat(64), confirmation:Sync.MANUAL_PUSH_CONFIRMATION, actor:'Mike' }), /reviewed plan digest is stale/);
    const receipt = service.executeManual({ planDigest:plan.planDigest, confirmation:Sync.MANUAL_PUSH_CONFIRMATION, actor:'Mike' });
    ok(receipt.state === 'PUSHED' && receipt.mode === 'MANUAL_REVIEWED_PUSH' && receipt.committed && receipt.changedFiles === 2, 'manual execution commits and pushes only the exact reviewed plan');
    ok(receipt.prCandidate.schema === Sync.PR_CANDIDATE_SCHEMA && receipt.prCandidate.pullRequestCreated === false && receipt.githubMerge === false, 'push emits a draft-PR candidate without creating or merging a PR');
    ok(JSON.parse(fs.readFileSync(service.candidateFile, 'utf8')).planDigest === plan.planDigest, 'latest PR candidate is persisted with the exact plan digest');
    ok(git(gitExecutable, remoteRoot, ['show','automation/workshop-sync:README.md']) === 'current public Workshop', 'isolated bare remote received current public source');
    ok(git(gitExecutable, repositoryRoot, ['log','-1','--pretty=%B']).includes('AXM-Plan-Digest: ' + plan.planDigest), 'commit records both evidence digests');
    const repeatPlan = service.buildPlan();
    ok(repeatPlan.changes.length === 0, 'repeat plan is source-idempotent');
    const noChanges = service.executeManual({ planDigest:repeatPlan.planDigest, confirmation:Sync.MANUAL_PUSH_CONFIRMATION, actor:'Mike' });
    ok(noChanges.state === 'NO_CHANGES' && noChanges.committed === false && noChanges.pushed === false, 'empty reviewed plan performs no commit or push');
    fs.writeFileSync(path.join(sourceRoot, 'scanner-example.js'), "const privateKeyHeader = /-----BEGIN PRIVATE KEY-----/;\n");
    const scannerSource = service.buildPlan();
    ok(scannerSource.source.publicSafety === 'PASS', 'scanner source containing only a key-header matcher is not a false positive');
    fs.rmSync(path.join(sourceRoot, 'scanner-example.js'));
    fs.writeFileSync(path.join(sourceRoot, 'private-key.txt'), '-----BEGIN PRIVATE KEY-----\n' + 'A'.repeat(32) + '\n');
    const privateKeyRefused = service.buildPlan();
    ok(!privateKeyRefused.executable && privateKeyRefused.blockers.some(row => row.rule === 'private-key'), 'multiline private-key material remains refused');
    fs.rmSync(path.join(sourceRoot, 'private-key.txt'));
    fs.writeFileSync(path.join(sourceRoot, 'leak.txt'), 'OPENAI_API_KEY=' + 'sk-' + 'a'.repeat(30) + '\n');
    const refused = service.buildPlan();
    ok(!refused.executable && refused.source.publicSafety === 'REFUSED' && refused.blockers.some(row => row.rule === 'openai-key'), 'public-safety finding holds execution without exposing the value');
    fs.rmSync(path.join(sourceRoot, 'leak.txt'));
    fs.writeFileSync(path.join(sourceRoot, 'README.md'), 'current public Workshop\nretry payload\n');
    const failurePlan = service.buildPlan();
    const preFailureHead = git(gitExecutable, repositoryRoot, ['rev-parse','HEAD']);
    const offlineRemote = path.join(temp, 'remote-offline.git');
    fs.renameSync(remoteRoot, offlineRemote);
    let failureReceipt = null;
    try {
      service.executeManual({ planDigest:failurePlan.planDigest, confirmation:Sync.MANUAL_PUSH_CONFIRMATION, actor:'Mike' });
    } catch (error) { failureReceipt = error.receipt; }
    finally { fs.renameSync(offlineRemote, remoteRoot); }
    ok(failureReceipt && failureReceipt.state === 'PUSH_FAILED_ROLLED_BACK' && failureReceipt.localHeadRestored === true, 'failed remote push records and completes clean-state recovery');
    ok(git(gitExecutable, repositoryRoot, ['rev-parse','HEAD']) === preFailureHead && git(gitExecutable, repositoryRoot, ['status','--porcelain']) === '', 'failed push restores the exact clean pre-commit Git state');
    ok(service.buildPlan().planDigest === failurePlan.planDigest, 'failed-push recovery leaves the reviewed plan retryable');
    fs.writeFileSync(path.join(sourceRoot, 'README.md'), 'current public Workshop\n');
    fs.appendFileSync(path.join(repositoryRoot, 'README.md'), 'unreviewed drift\n');
    assert.throws(() => service.buildPlan(), /dirty/);
    git(gitExecutable, repositoryRoot, ['restore','README.md']);
    const secondRemote = path.join(temp, 'other.git');
    git(gitExecutable, temp, ['init','--bare',secondRemote]);
    git(gitExecutable, repositoryRoot, ['remote','set-url','origin',secondRemote]);
    assert.throws(() => service.buildPlan(), /remote URL changed/);
    ok(!JSON.stringify(service.status()).match(/token|password|secret/i), 'public status stores no credentials');
  } finally {
    const resolved = path.resolve(temp), prefix = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(prefix) || !path.basename(resolved).startsWith('axm-github-sync-selftest-')) throw new Error('temporary cleanup boundary refused');
    fs.rmSync(resolved, { recursive:true, force:true });
  }

  console.log('Source Control & Merge Workbench self-test passed ' + checks + ' checks (local bare remote only; no GitHub push).');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
