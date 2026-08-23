#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Checkpoint = require('../../shared/deterministic-pr-checkpoint/checkpoint-core');
const Core = require('../../shared/deterministic-pr-publisher/publisher-core');
const Host = require('../../shared/deterministic-pr-publisher/publisher-host');
const ContractVerifier = require('../../hub/module-contract-verifier');

const FIXED_ENV = {
  GIT_AUTHOR_NAME:'AXM Publisher Test',
  GIT_AUTHOR_EMAIL:'publisher@example.invalid',
  GIT_COMMITTER_NAME:'AXM Publisher Test',
  GIT_COMMITTER_EMAIL:'publisher@example.invalid',
  GIT_AUTHOR_DATE:'2026-08-10T08:00:00Z',
  GIT_COMMITTER_DATE:'2026-08-10T08:00:00Z'
};

function git(cwd, args) {
  const result = childProcess.spawnSync('git', ['-C', cwd].concat(args), { encoding:'utf8', windowsHide:true, shell:false, timeout:30000, env:Object.assign({}, process.env, FIXED_ENV) });
  if (result.error || result.status !== 0) throw new Error(String(result.stderr || result.stdout || result.error));
  return String(result.stdout || '').trim();
}

function write(root, relative, content) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive:true });
  fs.writeFileSync(target, content);
}

function commit(root, message) {
  git(root, ['add', '--all']);
  git(root, ['commit', '--no-gpg-sign', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

function fixture(root) {
  fs.mkdirSync(root, { recursive:true });
  git(root, ['init', '-b', 'main']);
  git(root, ['remote', 'add', 'origin', 'https://github.com/acme/demo.git']);
  write(root, 'README.md', 'fixture\n');
  const base = commit(root, 'fixture base');
  git(root, ['update-ref', 'refs/remotes/origin/main', base]);
  git(root, ['checkout', '-b', 'codex/demo']);
  write(root, 'tools/demo/feature.txt', 'checkpointed feature\n');
  const head = commit(root, 'feat: checkpointed demo');
  const policy = {
    schema:Checkpoint.POLICY_SCHEMA,
    id:'publisher-fixture',
    baseRef:'origin/main',
    remoteName:'origin',
    allowedRemoteHosts:['github.com'],
    allowedBranchPrefixes:['codex/'],
    refusedBranches:['main', 'master'],
    allowedPrefixes:['tools/demo/'],
    allowedExactPaths:[],
    requiredPrefixes:['tools/demo/'],
    requiredPaths:['tools/demo/feature.txt'],
    forbiddenPrefixes:['state/', 'logs/'],
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
  const checkpoint = Checkpoint.inspectRepository({ repositoryRoot:root, policy });
  const verification = Checkpoint.verifyCheckpoint(checkpoint);
  const review = Checkpoint.renderReviewPacket(checkpoint, {
    schema:Checkpoint.REVIEW_METADATA_SCHEMA,
    title:'feat: checkpointed demo',
    summary:'Publishes one deterministic fixture.',
    changeNotes:['Adds one bounded file.'],
    riskNotes:['Independent platform review remains required.'],
    followUps:['Platform Axiom or Mir may merge after remote checks.']
  });
  return { base, head, checkpoint, verification, review };
}

function readyFacts(data) {
  return {
    publishLaneVerified:true,
    gitAvailable:true,
    ghAvailable:true,
    ghAuthenticated:true,
    remoteQuerySucceeded:true,
    prQuerySucceeded:true,
    clean:true,
    branch:'codex/demo',
    headCommit:data.head,
    repositoryIdentity:'github.com/acme/demo',
    remoteBaseCommit:data.base,
    remoteBranchCommit:null,
    remoteBranchRelationKnown:true,
    remoteBranchFastForward:true,
    pullRequests:[]
  };
}

function fakeRunner(repositoryRoot, data, options) {
  options = options || {};
  const state = { remoteBranch:options.remoteBranch || null, pr:options.pr || null, commands:[] };
  function result(status, stdout, stderr) { return { status, stdout:stdout || '', stderr:stderr || '' }; }
  function runner(command, args) {
    state.commands.push([command].concat(args));
    if (command === 'git' && args[0] === '--version') return result(0, 'git version test\n');
    if (command === 'gh' && args[0] === '--version') return result(0, 'gh version test\n');
    if (command === 'gh' && args[0] === 'auth') return result(options.authFailed ? 1 : 0, '', options.authFailed ? 'not logged in' : '');
    if (command === 'git') {
      const operation = args[2];
      if (operation === 'rev-parse' && args[3] === '--show-toplevel') return result(0, repositoryRoot + '\n');
      if (operation === 'branch' && args[3] === '--show-current') return result(0, 'codex/demo\n');
      if (operation === 'rev-parse' && args[3] === 'HEAD') return result(0, data.head + '\n');
      if (operation === 'status') return result(0, options.dirty ? ' M tools/demo/feature.txt\0' : '');
      if (operation === 'remote') return result(0, 'https://github.com/acme/demo.git\n');
      if (operation === 'ls-remote') {
        const rows = [data.base + '\trefs/heads/main'];
        if (state.remoteBranch) rows.push(state.remoteBranch + '\trefs/heads/codex/demo');
        return result(0, rows.join('\n') + '\n');
      }
      if (operation === 'cat-file') return result(0);
      if (operation === 'merge-base') return result(options.nonFastForward ? 1 : 0);
      if (operation === 'push') {
        if (options.pushFailed) return result(1, '', 'push refused');
        state.remoteBranch = data.head;
        return result(0, 'ok\n');
      }
    }
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'list') {
      const rows = state.pr ? [{ number:state.pr.number, url:state.pr.url, headRefName:'codex/demo', headRefOid:state.remoteBranch, baseRefName:'main', isDraft:state.pr.isDraft, title:state.pr.title }] : [];
      return result(0, JSON.stringify(rows));
    }
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'create') {
      if (options.createFailed) return result(1, '', 'simulated create failure');
      const title = args[args.indexOf('--title') + 1], bodyFile = args[args.indexOf('--body-file') + 1];
      state.pr = { number:7, url:'https://github.com/acme/demo/pull/7', isDraft:true, title, body:fs.readFileSync(bodyFile, 'utf8') };
      return result(0, state.pr.url + '\n');
    }
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'edit') {
      const title = args[args.indexOf('--title') + 1], bodyFile = args[args.indexOf('--body-file') + 1];
      state.pr.title = title; state.pr.body = fs.readFileSync(bodyFile, 'utf8');
      return result(0);
    }
    if (command === 'gh' && args[0] === 'pr' && args[1] === 'view') {
      return result(0, JSON.stringify({
        number:state.pr.number, url:state.pr.url, state:'OPEN', isDraft:options.receiverNonDraft ? false : state.pr.isDraft,
        headRefOid:state.remoteBranch, baseRefOid:data.base, headRefName:'codex/demo', baseRefName:'main',
        title:state.pr.title, body:state.pr.body, mergedAt:null
      }));
    }
    return result(1, '', 'unexpected command: ' + command + ' ' + args.join(' '));
  }
  return { runner, state };
}

(() => {
  const moduleRoot = __dirname;
  const manifest = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.contract.json'), 'utf8'));
  const hostSource = fs.readFileSync(path.join(moduleRoot, '..', '..', 'shared', 'deterministic-pr-publisher', 'publisher-host.js'), 'utf8');
  let checks = 0;
  const ok = (value, message) => { assert.ok(value, message); checks += 1; };
  const equal = (left, right, message) => { assert.equal(left, right, message); checks += 1; };

  equal(manifest.id, 'deterministic-pr-publisher', 'manifest identity');
  equal(manifest.status, 'EXPERIMENTAL', 'honest status');
  equal(manifest.risk, 'HIGH', 'network-writing risk is explicit');
  ok(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates');
  ok(['automatic-merge','force-push','branch-creation-or-deletion','git-stage-or-commit','canon-change'].every(value => contract.boundaries.refuses.includes(value)), 'authority and mutation refusals are declared');
  equal(fs.readFileSync(path.join(moduleRoot, 'pr-publisher-cli.cmd'), 'utf8').replace(/\r/g, ''), '@echo off\nsetlocal\nnode "%~dp0pr-publisher-cli.js" %*\nexit /b %errorlevel%\n', 'Windows launcher explicitly uses Node.js');
  ok(!/\['pr',\s*'(?:merge|ready|close)'/.test(hostSource), 'host adapter contains no PR merge ready or close invocation');
  ok(!/--force(?:-with-lease)?/.test(hostSource), 'host adapter contains no force-push option');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-pr-publisher-selftest-'));
  try {
    const publishRoot = path.join(temp, 'publish');
    const repositoryRoot = path.join(publishRoot, 'demo');
    const data = fixture(repositoryRoot);
    equal(data.checkpoint.state, 'READY', 'fixture checkpoint is READY');
    equal(data.verification.state, 'PASS', 'fixture checkpoint verification passes');
    equal(data.review.state, 'READY', 'fixture review packet is READY');

    const facts = readyFacts(data);
    const plan = Core.buildPlan({ checkpoint:data.checkpoint, verification:data.verification, review:data.review, facts });
    equal(plan.state, 'READY', 'exact clean local and remote facts produce READY plan');
    equal(plan.pullRequest.action, 'CREATE', 'missing pull request produces CREATE action');
    equal(plan.repository.headCommit, data.head, 'plan binds exact head');
    equal(plan.repository.baseCommit, data.base, 'plan binds exact remote base');
    ok(plan.pullRequest.body.includes('platform Axiom/Mir') && plan.pullRequest.body.includes('Local publisher merge authority: **false**'), 'review body carries platform routing and merge refusal');
    ok(Object.entries(plan.effectsIfExplicitlyAuthorized).filter(row => !['remoteBranchPush','pullRequestCreateOrUpdate'].includes(row[0])).every(row => row[1] === false), 'plan limits effects to push and PR upsert');
    equal(Core.buildPlan({ review:data.review, facts:Object.assign({}, facts), verification:data.verification, checkpoint:data.checkpoint }).planDigest, plan.planDigest, 'semantic input order does not change plan digest');
    equal(Core.verifyPlan(plan).state, 'PASS', 'saved plan verifies');
    const tamperedPlan = JSON.parse(JSON.stringify(plan)); tamperedPlan.repository.headCommit = '0'.repeat(40);
    equal(Core.verifyPlan(tamperedPlan).state, 'FAIL', 'plan tampering is detected');

    const holds = [
      ['PUBLISH_LANE_REQUIRED', { publishLaneVerified:false }],
      ['DIRTY_WORKTREE', { clean:false }],
      ['LOCAL_BRANCH_MISMATCH', { branch:'codex/other' }],
      ['LOCAL_HEAD_MISMATCH', { headCommit:'1'.repeat(40) }],
      ['REMOTE_IDENTITY_MISMATCH', { repositoryIdentity:'github.com/acme/other' }],
      ['REMOTE_BASE_DRIFT', { remoteBaseCommit:'2'.repeat(40) }],
      ['GITHUB_HOST_SESSION_REQUIRED', { ghAuthenticated:false }],
      ['REMOTE_QUERY_FAILED', { remoteQuerySucceeded:false }],
      ['PULL_REQUEST_QUERY_FAILED', { prQuerySucceeded:false }],
      ['REMOTE_BRANCH_NON_FAST_FORWARD', { remoteBranchCommit:'3'.repeat(40), remoteBranchFastForward:false }]
    ];
    holds.forEach(([code, change]) => {
      const held = Core.buildPlan({ checkpoint:data.checkpoint, verification:data.verification, review:data.review, facts:Object.assign({}, facts, change) });
      equal(held.state, 'HELD', code + ' produces held plan');
      ok(held.blockers.some(row => row.code === code), code + ' is typed');
    });
    const multiple = Core.buildPlan({ checkpoint:data.checkpoint, verification:data.verification, review:data.review, facts:Object.assign({}, facts, { pullRequests:[{number:1,headRefName:'codex/demo',baseRefName:'main'},{number:2,headRefName:'codex/demo',baseRefName:'main'}] }) });
    ok(multiple.blockers.some(row => row.code === 'MULTIPLE_OPEN_PULL_REQUESTS'), 'multiple open PRs are refused');
    const nonDraft = Core.buildPlan({ checkpoint:data.checkpoint, verification:data.verification, review:data.review, facts:Object.assign({}, facts, { pullRequests:[{number:1,headRefName:'codex/demo',baseRefName:'main',isDraft:false}] }) });
    equal(nonDraft.state, 'HELD', 'existing non-draft PR produces held plan');
    ok(nonDraft.blockers.some(row => row.code === 'PULL_REQUEST_NOT_DRAFT'), 'existing non-draft PR is typed');

    const badVerification = JSON.parse(JSON.stringify(data.verification)); badVerification.state = 'FAIL';
    ok(Core.buildPlan({ checkpoint:data.checkpoint, verification:badVerification, review:data.review, facts }).blockers.some(row => row.code === 'VERIFICATION_PACKET_INVALID'), 'verification tamper is held');
    const badReview = JSON.parse(JSON.stringify(data.review)); badReview.body += '\nC:' + '\\Users\\private\\receipt.txt'; delete badReview.reviewPacketDigest; badReview.reviewPacketDigest = Checkpoint.canonicalDigest(badReview);
    ok(Core.buildPlan({ checkpoint:data.checkpoint, verification:data.verification, review:badReview, facts }).blockers.some(row => row.code === 'PUBLIC_REVIEW_MATERIAL_REFUSED'), 'machine-local review material is held');
    const secretReview = JSON.parse(JSON.stringify(data.review)); secretReview.body += '\n' + 'sk-' + 'A'.repeat(32); delete secretReview.reviewPacketDigest; secretReview.reviewPacketDigest = Checkpoint.canonicalDigest(secretReview);
    ok(Core.buildPlan({ checkpoint:data.checkpoint, verification:data.verification, review:secretReview, facts }).blockers.some(row => row.code === 'PUBLIC_REVIEW_MATERIAL_REFUSED'), 'credential-shaped review material is held');
    const fineGrainedSecretReview = JSON.parse(JSON.stringify(data.review)); fineGrainedSecretReview.body += '\n' + 'github_pat_' + 'A'.repeat(32); delete fineGrainedSecretReview.reviewPacketDigest; fineGrainedSecretReview.reviewPacketDigest = Checkpoint.canonicalDigest(fineGrainedSecretReview);
    ok(Core.buildPlan({ checkpoint:data.checkpoint, verification:data.verification, review:fineGrainedSecretReview, facts }).blockers.some(row => row.code === 'PUBLIC_REVIEW_MATERIAL_REFUSED'), 'fine-grained GitHub credential-shaped review material is held');

    const fake = fakeRunner(repositoryRoot, data);
    const observed = Host.inspectHost({ repositoryRoot, publishRoot, checkpoint:data.checkpoint, runner:fake.runner });
    equal(observed.publishLaneVerified, true, 'host verifies explicit publish lane');
    equal(observed.remoteBaseCommit, data.base, 'host observes exact remote main');
    equal(observed.remoteBranchCommit, null, 'host observes missing review branch');
    const hostPlan = Core.buildPlan({ checkpoint:data.checkpoint, verification:data.verification, review:data.review, facts:observed });
    equal(hostPlan.state, 'READY', 'mocked native host observations produce READY plan');
    const receipt = Host.publishExact({ repositoryRoot, publishRoot, checkpoint:data.checkpoint, verification:data.verification, review:data.review, plan:hostPlan, confirmation:Core.CONFIRMATION, runner:fake.runner });
    equal(receipt.state, 'PASS', 'publisher pushes and creates a receiver-confirmed PR');
    equal(receipt.action.push, 'CREATED_REMOTE_BRANCH', 'receipt distinguishes remote branch creation');
    equal(receipt.action.pullRequest, 'CREATED_DRAFT', 'receipt records draft PR creation');
    equal(receipt.transport.remoteHeadCommit, data.head, 'receipt binds remote receiver head');
    equal(receipt.transport.pullRequestHeadCommit, data.head, 'receipt binds PR receiver head');
    equal(Core.verifyReceipt(receipt).state, 'PASS', 'transport receipt verifies');
    ok(receipt.checks.some(row => row.id === 'pull-request-draft' && row.pass), 'receiver receipt proves the PR stayed draft');
    ok(fake.state.pr && fake.state.pr.isDraft, 'created PR remains draft');

    const raceFake = fakeRunner(repositoryRoot, data, { receiverNonDraft:true });
    const raceFacts = Host.inspectHost({ repositoryRoot, publishRoot, checkpoint:data.checkpoint, runner:raceFake.runner });
    const racePlan = Core.buildPlan({ checkpoint:data.checkpoint, verification:data.verification, review:data.review, facts:raceFacts });
    const raceReceipt = Host.publishExact({ repositoryRoot, publishRoot, checkpoint:data.checkpoint, verification:data.verification, review:data.review, plan:racePlan, confirmation:Core.CONFIRMATION, runner:raceFake.runner });
    equal(raceReceipt.state, 'FAIL', 'receiver-side draft loss fails the transport receipt');
    ok(raceReceipt.checks.some(row => row.id === 'pull-request-draft' && !row.pass), 'receiver-side draft loss is typed');
    ok(!fake.state.commands.some(row => row.includes('merge') || row.includes('ready') || row.includes('close')), 'executed command trace contains no merge ready or close');
    ok(!fake.state.commands.some(row => row.some(value => /^--force/.test(value))), 'executed command trace contains no force push');
    ok(!fake.state.commands.some(row => row[0] === 'git' && ['add','commit','reset','checkout'].includes(row[3])), 'executed command trace contains no stage commit reset or checkout');

    const updateFacts = Host.inspectHost({ repositoryRoot, publishRoot, checkpoint:data.checkpoint, runner:fake.runner });
    const updatePlan = Core.buildPlan({ checkpoint:data.checkpoint, verification:data.verification, review:data.review, facts:updateFacts });
    equal(updatePlan.pullRequest.action, 'UPDATE', 'existing PR produces UPDATE action');
    const pushesBefore = fake.state.commands.filter(row => row.includes('push')).length;
    const updateReceipt = Host.publishExact({ repositoryRoot, publishRoot, checkpoint:data.checkpoint, verification:data.verification, review:data.review, plan:updatePlan, confirmation:Core.CONFIRMATION, runner:fake.runner });
    equal(updateReceipt.state, 'PASS', 'idempotent existing-PR update passes');
    equal(updateReceipt.action.push, 'REMOTE_HEAD_ALREADY_EXACT', 'exact remote head is not repushed');
    equal(fake.state.commands.filter(row => row.includes('push')).length, pushesBefore, 'idempotent update executes no extra push');

    const refused = Host.publishExact({ repositoryRoot, publishRoot, checkpoint:data.checkpoint, verification:data.verification, review:data.review, plan:updatePlan, confirmation:'wrong', runner:fake.runner });
    equal(refused.state, 'REFUSED', 'wrong static confirmation phrase is refused');
    ok(Object.values(refused.authority).every(value => value === false), 'refusal grants no authority');
    const failureSecret = 'ghp_' + 'Z'.repeat(30), failurePath = 'C:' + '\\Users\\private\\receipt.txt';
    const redacted = Host.failureReceipt(updatePlan, 'REFUSED', new Error(failureSecret + ' ' + failurePath), 'NOT_ATTEMPTED');
    ok(!JSON.stringify(redacted).includes(failureSecret), 'failure receipt redacts credential-shaped output');
    ok(!JSON.stringify(redacted).includes(failurePath), 'failure receipt redacts machine-local paths');
    const fineGrainedSecret = 'github_pat_' + 'Z'.repeat(30);
    ok(!Host.publicError(new Error(fineGrainedSecret)).includes(fineGrainedSecret), 'public errors redact fine-grained GitHub credential-shaped output');

    const partialFake = fakeRunner(repositoryRoot, data, { createFailed:true });
    const partialFacts = Host.inspectHost({ repositoryRoot, publishRoot, checkpoint:data.checkpoint, runner:partialFake.runner });
    const partialPlan = Core.buildPlan({ checkpoint:data.checkpoint, verification:data.verification, review:data.review, facts:partialFacts });
    const partial = Host.publishExact({ repositoryRoot, publishRoot, checkpoint:data.checkpoint, verification:data.verification, review:data.review, plan:partialPlan, confirmation:Core.CONFIRMATION, runner:partialFake.runner });
    equal(partial.state, 'REMOTE_BRANCH_PUSHED_PR_UNCONFIRMED', 'post-push PR failure produces typed partial receipt');
    equal(partialFake.state.remoteBranch, data.head, 'partial receipt preserves observed remote branch effect');
    ok(/Do not repush blindly/.test(partial.recovery), 'partial receipt provides bounded recovery');
  } finally {
    fs.rmSync(temp, { recursive:true, force:true });
  }

  console.log('deterministic-pr-publisher selftest PASS (' + checks + ' checks)');
})();
