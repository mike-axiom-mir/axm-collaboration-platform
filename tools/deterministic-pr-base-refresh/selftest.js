#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Checkpoint = require('../../shared/deterministic-pr-checkpoint/checkpoint-core');
const Core = require('../../shared/deterministic-pr-base-refresh/base-refresh-core');
const Host = require('../../shared/deterministic-pr-base-refresh/base-refresh-host');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Cli = require('./base-refresh-cli');

const TEST_ENV = {
  GIT_AUTHOR_NAME:'AXM Base Refresh Test',
  GIT_AUTHOR_EMAIL:'base-refresh-test@example.invalid',
  GIT_COMMITTER_NAME:'AXM Base Refresh Test',
  GIT_COMMITTER_EMAIL:'base-refresh-test@example.invalid',
  GIT_AUTHOR_DATE:'2026-08-10T08:00:00Z',
  GIT_COMMITTER_DATE:'2026-08-10T08:00:00Z'
};

function run(command, args, options) {
  const result = childProcess.spawnSync(command, args, {
    encoding:'utf8', windowsHide:true, shell:false, timeout:60000,
    env:Object.assign({}, process.env, TEST_ENV, options && options.env || {})
  });
  if (result.error || result.status !== 0) throw new Error(String(result.stderr || result.stdout || result.error));
  return String(result.stdout || '').trim();
}

function git(cwd, args) {
  return run('git', ['-C', cwd].concat(args));
}

function write(root, relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive:true });
  fs.writeFileSync(target, content);
}

function commit(root, message) {
  git(root, ['add', '--all']);
  git(root, ['commit', '--no-gpg-sign', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']).toLowerCase();
}

function checkpointPolicy() {
  return {
    schema:Checkpoint.POLICY_SCHEMA,
    id:'base-refresh-fixture',
    baseRef:'origin/main',
    remoteName:'origin',
    allowedRemoteHosts:['github.com'],
    allowedBranchPrefixes:['codex/'],
    refusedBranches:['main','master'],
    allowedPrefixes:['tools/demo/'],
    allowedExactPaths:[],
    requiredPrefixes:['tools/demo/'],
    requiredPaths:[],
    forbiddenPrefixes:['state/','logs/'],
    forbiddenExactPaths:['bridge/bridge-token.txt'],
    requiredEvidenceClaims:[],
    allowDeletions:false,
    allowRenames:false,
    allowCopies:false,
    scanSecrets:true,
    maxFiles:20,
    maxChangedBytes:1024 * 1024,
    maxCommits:10
  };
}

function createFixture(root, conflict) {
  const seed = path.join(root, 'seed');
  const bare = path.join(root, 'remote.git');
  fs.mkdirSync(seed, { recursive:true });
  git(seed, ['init', '-b', 'main']);
  git(seed, ['remote', 'add', 'origin', 'https://github.com/acme/demo.git']);
  write(seed, 'README.md', 'fixture\n');
  write(seed, 'tools/demo/shared.txt', 'base\n');
  const base = commit(seed, 'fixture base');
  git(seed, ['update-ref', 'refs/remotes/origin/main', base]);
  git(seed, ['checkout', '-b', 'codex/demo']);
  if (conflict) write(seed, 'tools/demo/shared.txt', 'feature\n');
  else write(seed, 'tools/demo/feature.txt', 'feature\n');
  const head = commit(seed, 'feat: checkpointed demo');
  const checkpoint = Checkpoint.inspectRepository({ repositoryRoot:seed, policy:checkpointPolicy() });
  const verification = Checkpoint.verifyCheckpoint(checkpoint);

  run('git', ['init', '--bare', bare]);
  git(seed, ['push', bare, 'main:refs/heads/main', 'codex/demo:refs/heads/codex/demo']);
  const updater = path.join(root, 'updater');
  run('git', ['clone', '--branch', 'main', bare, updater]);
  if (conflict) write(updater, 'tools/demo/shared.txt', 'main\n');
  else write(updater, 'tools/demo/main.txt', 'main advanced\n');
  const newMain = commit(updater, 'main: advance fixture');
  git(updater, ['push', 'origin', 'main']);
  return { bare, base, head, newMain, checkpoint, verification };
}

function cloneReview(fixture, publishRoot, name) {
  const repositoryRoot = path.join(publishRoot, name);
  run('git', ['clone', '--no-local', '--single-branch', '--branch', 'codex/demo', fixture.bare, repositoryRoot]);
  return repositoryRoot;
}

function fixtureRunner(repositoryRoot) {
  return function runner(command, args, options) {
    if (command === 'git' && args[0] === '-C' && path.resolve(args[1]).toLowerCase() === path.resolve(repositoryRoot).toLowerCase()
      && args[2] === 'remote' && args[3] === 'get-url' && args[4] === 'origin') {
      return { status:0, stdout:'https://github.com/acme/demo.git\n', stderr:'' };
    }
    return Host.defaultRunner(command, args, options);
  };
}

function planFor(repositoryRoot, publishRoot, fixture) {
  const runner = fixtureRunner(repositoryRoot);
  const facts = Host.inspectHost({ repositoryRoot, publishRoot, checkpoint:fixture.checkpoint, runner });
  return { runner, facts, plan:Core.buildPlan({ checkpoint:fixture.checkpoint, verification:fixture.verification, facts }) };
}

(() => {
  const moduleRoot = __dirname;
  const manifest = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.contract.json'), 'utf8'));
  const hostSource = fs.readFileSync(path.join(moduleRoot, '..', '..', 'shared', 'deterministic-pr-base-refresh', 'base-refresh-host.js'), 'utf8');
  let checks = 0;
  const ok = (value, message) => { assert.ok(value, message); checks += 1; };
  const equal = (left, right, message) => { assert.equal(left, right, message); checks += 1; };

  equal(manifest.id, 'deterministic-pr-base-refresh', 'manifest identity');
  equal(manifest.status, 'EXPERIMENTAL', 'honest status');
  equal(manifest.risk, 'HIGH', 'local Git mutation risk is explicit');
  ok(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates');
  ok(['rebase','reset','history-rewrite','force-push','remote-push','main-branch-write','automatic-platform-merge','canon-change'].every(value => contract.boundaries.refuses.includes(value)), 'mutation and authority refusals are explicit');
  equal(fs.readFileSync(path.join(moduleRoot, 'base-refresh-cli.cmd'), 'utf8').replace(/\r/g, ''), '@echo off\nsetlocal\nnode "%~dp0base-refresh-cli.js" %*\nexit /b %errorlevel%\n', 'Windows launcher explicitly uses Node.js');
  ok(!/\[\s*['"]push['"]/.test(hostSource), 'host contains no Git push invocation');
  ok(!/\[\s*['"](?:reset|rebase|checkout)['"]/.test(hostSource), 'host contains no reset rebase or checkout invocation');
  ok(Cli.usage().includes(Core.CONFIRMATION), 'CLI publishes the exact confirmation phrase');
  equal(Cli.parseArguments(['verify-plan','--packet','plan.json']).packet, 'plan.json', 'CLI parses one explicit packet');
  assert.throws(() => Cli.parseArguments(['plan','--repo','one','--repo','two']), /duplicate flag/); checks += 1;

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-base-refresh-selftest-'));
  try {
    const fixture = createFixture(path.join(temp, 'clean-fixture'), false);
    equal(fixture.checkpoint.state, 'READY', 'fixture checkpoint is READY');
    equal(fixture.verification.state, 'PASS', 'fixture checkpoint verification passes');
    const publishRoot = path.join(temp, 'publish');
    fs.mkdirSync(publishRoot, { recursive:true });
    const first = cloneReview(fixture, publishRoot, 'first');
    const beforeBranch = git(first, ['branch', '--show-current']);
    const beforeHead = git(first, ['rev-parse', 'HEAD']);
    const beforeStatus = git(first, ['status', '--porcelain=v1']);
    const planned = planFor(first, publishRoot, fixture);
    equal(planned.facts.remoteMainCommit, fixture.newMain, 'host observes exact advanced main');
    equal(planned.facts.objectFetched, true, 'single-branch fixture requires exact immutable main-object fetch');
    equal(planned.facts.remoteBranchCommit, fixture.head, 'host observes exact unchanged review branch');
    equal(planned.facts.baseIsAncestorOfRemoteMain, true, 'host proves new main descends from checkpoint base');
    equal(planned.facts.conflictDetected, false, 'host proves clean merge tree');
    ok(Core.isSha(planned.facts.plannedMergeTree), 'host binds exact prospective merge tree');
    equal(planned.plan.state, 'READY', 'clean exact advanced state produces READY');
    equal(planned.plan.action, 'CREATE_LOCAL_MERGE_COMMIT', 'READY plan names one local merge action');
    equal(Core.verifyPlan(planned.plan).state, 'PASS', 'saved plan verifies');
    const reprobed = planFor(first, publishRoot, fixture);
    equal(reprobed.facts.objectFetched, false, 'second inspection reuses prepared immutable objects');
    equal(reprobed.plan.planDigest, planned.plan.planDigest, 'object-cache history does not change semantic plan digest');
    equal(git(first, ['branch', '--show-current']), beforeBranch, 'planning does not move branch');
    equal(git(first, ['rev-parse', 'HEAD']), beforeHead, 'planning does not move HEAD');
    equal(git(first, ['status', '--porcelain=v1']), beforeStatus, 'planning does not edit worktree or index');
    ok(Object.entries(planned.plan.effectsIfExplicitlyAuthorized).filter(row => ['immutableGitObjectPreparation','localFeatureMergeCommit','featureWorktreeUpdate'].includes(row[0]) === false).every(row => row[1] === false), 'plan closes all remote authority and rewrite effects');

    const tampered = JSON.parse(JSON.stringify(planned.plan));
    tampered.repository.remoteMainCommit = '0'.repeat(40);
    equal(Core.verifyPlan(tampered).state, 'FAIL', 'plan tampering is detected');
    const holdFacts = Object.assign({}, planned.facts, { remoteBranchCommit:'1'.repeat(40) });
    const held = Core.buildPlan({ checkpoint:fixture.checkpoint, verification:fixture.verification, facts:holdFacts });
    equal(held.state, 'HELD', 'remote review branch drift holds');
    ok(held.blockers.some(row => row.code === 'REMOTE_BRANCH_HEAD_DRIFT'), 'remote review branch drift is typed');
    const divergentFacts = Object.assign({}, planned.facts, { baseIsAncestorOfRemoteMain:false });
    ok(Core.buildPlan({ checkpoint:fixture.checkpoint, verification:fixture.verification, facts:divergentFacts }).blockers.some(row => row.code === 'REMOTE_MAIN_NOT_DESCENDANT_OF_CHECKPOINT_BASE'), 'remote main divergence is typed');
    const dirtyFacts = Object.assign({}, planned.facts, { clean:false });
    ok(Core.buildPlan({ checkpoint:fixture.checkpoint, verification:fixture.verification, facts:dirtyFacts }).blockers.some(row => row.code === 'DIRTY_WORKTREE'), 'dirty worktree is typed');
    const noChangeFacts = Object.assign({}, planned.facts, { remoteMainCommit:fixture.base, baseIsAncestorOfRemoteMain:true, remoteMainIsAncestorOfHead:true, headIsAncestorOfRemoteMain:false, plannedMergeTree:null });
    const noChange = Core.buildPlan({ checkpoint:fixture.checkpoint, verification:fixture.verification, facts:noChangeFacts });
    equal(noChange.state, 'NO_CHANGE', 'unchanged main produces NO_CHANGE');
    equal(noChange.action, 'RECHECKPOINT_ONLY', 'NO_CHANGE refuses a redundant merge');

    const receipt = Host.applyExact({ repositoryRoot:first, publishRoot, checkpoint:fixture.checkpoint, verification:fixture.verification, plan:planned.plan, confirmation:Core.CONFIRMATION, runner:planned.runner });
    if (receipt.state !== 'PASS') process.stderr.write(JSON.stringify(receipt, null, 2) + '\n');
    equal(receipt.state, 'PASS', 'exact confirmed refresh passes');
    equal(Core.verifyReceipt(receipt).state, 'PASS', 'success receipt verifies');
    equal(receipt.result.previousHead, fixture.head, 'receipt binds old checkpoint head');
    equal(receipt.result.remoteMainCommit, fixture.newMain, 'receipt binds exact new main');
    equal(receipt.result.mergeTree, planned.plan.repository.plannedMergeTree, 'applied merge tree matches planned tree');
    equal(receipt.result.remoteBranchCommit, fixture.head, 'remote review branch remains unchanged');
    equal(git(first, ['status', '--porcelain=v1']), '', 'successful refresh leaves clean worktree');
    equal(git(first, ['show', '-s', '--format=%P', 'HEAD']).split(/\s+/)[0], fixture.head, 'old feature head is first parent');
    equal(git(first, ['show', '-s', '--format=%P', 'HEAD']).split(/\s+/)[1], fixture.newMain, 'new main is second parent');
    equal(git(first, ['ls-remote', '--heads', 'origin', 'refs/heads/codex/demo']).split(/\s+/)[0], fixture.head, 'apply performs no remote branch write');

    const second = cloneReview(fixture, publishRoot, 'second');
    const secondPlanned = planFor(second, publishRoot, fixture);
    equal(secondPlanned.plan.planDigest, planned.plan.planDigest, 'equivalent clone produces identical plan digest');
    const secondReceipt = Host.applyExact({ repositoryRoot:second, publishRoot, checkpoint:fixture.checkpoint, verification:fixture.verification, plan:secondPlanned.plan, confirmation:Core.CONFIRMATION, runner:secondPlanned.runner });
    equal(secondReceipt.state, 'PASS', 'second equivalent refresh passes');
    equal(secondReceipt.result.localMergeCommit, receipt.result.localMergeCommit, 'fixed inputs produce identical merge commit');

    const third = cloneReview(fixture, publishRoot, 'third');
    const thirdPlanned = planFor(third, publishRoot, fixture);
    const refused = Host.applyExact({ repositoryRoot:third, publishRoot, checkpoint:fixture.checkpoint, verification:fixture.verification, plan:thirdPlanned.plan, confirmation:'wrong', runner:thirdPlanned.runner });
    equal(refused.state, 'REFUSED', 'wrong exact confirmation is refused');
    equal(git(third, ['rev-parse', 'HEAD']), fixture.head, 'wrong confirmation leaves HEAD exact');
    equal(Core.verifyReceipt(refused).state, 'PASS', 'refusal receipt verifies');

    const fourth = cloneReview(fixture, publishRoot, 'fourth');
    const fourthPlanned = planFor(fourth, publishRoot, fixture);
    const refusalRunner = function(command, args, options) {
      if (command === 'git' && args.includes('merge') && !args.includes('merge-tree') && !args.includes('merge-base') && !args.includes('--abort')) {
        return { status:1, stdout:'', stderr:'simulated pre-merge refusal' };
      }
      return fourthPlanned.runner(command, args, options);
    };
    const rolledBack = Host.applyExact({ repositoryRoot:fourth, publishRoot, checkpoint:fixture.checkpoint, verification:fixture.verification, plan:fourthPlanned.plan, confirmation:Core.CONFIRMATION, runner:refusalRunner });
    equal(rolledBack.state, 'ROLLED_BACK', 'pre-merge refusal with exact restored facts is typed as rolled back');
    equal(Core.verifyReceipt(rolledBack).state, 'PASS', 'rolled-back receipt verifies');
    equal(git(fourth, ['rev-parse', 'HEAD']), fixture.head, 'rolled-back refusal preserves exact HEAD');
    equal(git(fourth, ['status', '--porcelain=v1']), '', 'rolled-back refusal preserves clean worktree');

    const staleRoot = cloneReview(fixture, publishRoot, 'stale');
    const stalePlanned = planFor(staleRoot, publishRoot, fixture);
    write(path.join(temp, 'clean-fixture', 'updater'), 'tools/demo/later.txt', 'later main\n');
    commit(path.join(temp, 'clean-fixture', 'updater'), 'main: advance again');
    git(path.join(temp, 'clean-fixture', 'updater'), ['push', 'origin', 'main']);
    const staleReceipt = Host.applyExact({ repositoryRoot:staleRoot, publishRoot, checkpoint:fixture.checkpoint, verification:fixture.verification, plan:stalePlanned.plan, confirmation:Core.CONFIRMATION, runner:stalePlanned.runner });
    equal(staleReceipt.state, 'REFUSED', 'remote main drift makes the saved plan stale');
    equal(git(staleRoot, ['rev-parse', 'HEAD']), fixture.head, 'stale plan refusal leaves HEAD exact');
    equal(git(staleRoot, ['status', '--porcelain=v1']), '', 'stale plan refusal leaves worktree clean');

    const conflictFixture = createFixture(path.join(temp, 'conflict-fixture'), true);
    const conflictRoot = cloneReview(conflictFixture, publishRoot, 'conflict');
    const conflictPlan = planFor(conflictRoot, publishRoot, conflictFixture);
    equal(conflictPlan.facts.conflictDetected, true, 'prospective content conflict is observed');
    equal(conflictPlan.plan.state, 'HELD', 'content conflict holds before apply');
    ok(conflictPlan.plan.blockers.some(row => row.code === 'MERGE_CONFLICT'), 'content conflict is typed');
    equal(git(conflictRoot, ['rev-parse', 'HEAD']), conflictFixture.head, 'conflict planning does not move HEAD');
    equal(git(conflictRoot, ['status', '--porcelain=v1']), '', 'conflict planning leaves worktree clean');

    const secret = 'ghp_' + 'Z'.repeat(30);
    const localPath = 'C:' + '\\Users\\private\\receipt.txt';
    const redacted = Host.publicError(new Error(secret + ' ' + localPath));
    ok(!redacted.includes(secret), 'public errors redact credential-shaped output');
    ok(!redacted.includes(localPath), 'public errors redact machine-local paths');
  } finally {
    fs.rmSync(temp, { recursive:true, force:true });
  }

  console.log('deterministic-pr-base-refresh selftest PASS (' + checks + ' checks)');
})();
