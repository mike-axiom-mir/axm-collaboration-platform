#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Core = require('../../shared/deterministic-pr-sequencer/sequencer-core');
const Host = require('../../shared/deterministic-pr-sequencer/sequencer-host');
const Cli = require('./pr-sequencer-cli');

const MAIN = 'b'.repeat(40);
const OLD = 'c'.repeat(40);
const HEADS = { 29:'9'.repeat(40), 30:'a'.repeat(40), 32:'2'.repeat(40), 33:'3'.repeat(40) };
const CHECKS = ['discovery-and-static-gates', 'windows-clean-launch'];

function policy() {
  return {
    schema:Core.POLICY_SCHEMA,
    id:'current-open-pr-sequence',
    repository:'github.com/acme/demo',
    baseBranch:'main',
    mergeMethod:'merge',
    candidates:[32,33,29,30].map(number => ({ number, expectedHead:HEADS[number], evidenceLevel:number === 33 ? 'transport' : 'checkpoint', handoffRequired:true })),
    requiredChecks:CHECKS,
    reviewBranchPrefixes:['agent/','codex/'],
    refuseUnlistedReviewBranches:true
  };
}

function handoff(number, base, transport) {
  const packet = {
    schema:'axm.chatgpt-platform-merge-handoff/v1',
    repository:'acme/demo',
    pullRequest:{
      number,
      url:'https://github.com/acme/demo/pull/' + number,
      state:'OPEN',
      draft:number === 33,
      mergeable:'MERGEABLE',
      mergeState:'CLEAN',
      baseCommit:base,
      headCommit:HEADS[number]
    },
    deterministicEvidence:{
      checkpointState:'READY',
      checkpointDigest:'1'.repeat(64),
      verificationState:'PASS',
      verificationDigest:'2'.repeat(64),
      reviewPacketState:'READY',
      reviewPacketDigest:'3'.repeat(64)
    },
    routing:{ localMergePerformed:false },
    authority:{ promotion:false, canon:false, roots:false }
  };
  if (transport) packet.transportEvidence = {
    planState:'READY',
    planDigest:'4'.repeat(64),
    receiptState:'PASS',
    receiptDigest:'5'.repeat(64),
    receiptVerificationState:'PASS',
    receiptVerificationDigest:'6'.repeat(64),
    senderReceiverHeadMatch:true
  };
  const bytes = Buffer.from(JSON.stringify(packet));
  return { packet, fileSha256:crypto.createHash('sha256').update(bytes).digest('hex') };
}

function checks(change) {
  return CHECKS.map(name => Object.assign({ name, status:'COMPLETED', conclusion:'SUCCESS' }, change && change[name] || {}));
}

function observation(number, options) {
  options = options || {};
  const merged = options.merged === true;
  return {
    number,
    url:'https://github.com/acme/demo/pull/' + number,
    title:'PR ' + number,
    state:merged ? 'MERGED' : options.state || 'OPEN',
    isDraft:options.isDraft === true,
    mergeable:options.mergeable || 'MERGEABLE',
    mergeStateStatus:options.mergeStateStatus || 'CLEAN',
    headRefName:'codex/pr-' + number,
    headRefOid:options.head || HEADS[number],
    baseRefName:'main',
    baseRefOid:options.base || MAIN,
    mergedAt:merged ? '2026-08-10T00:00:00Z' : null,
    checks:options.checks || checks()
  };
}

function facts(options) {
  options = options || {};
  const pullRequests = options.pullRequests || [
    observation(32),
    observation(33, { isDraft:true }),
    observation(29, { isDraft:true, base:OLD }),
    observation(30, { isDraft:true, base:OLD })
  ];
  return {
    ghAvailable:options.ghAvailable !== false,
    ghAuthenticated:options.ghAuthenticated !== false,
    remoteQuerySucceeded:options.remoteQuerySucceeded !== false,
    prQuerySucceeded:options.prQuerySucceeded !== false,
    openInventoryComplete:options.openInventoryComplete !== false,
    repositoryIdentity:options.repositoryIdentity || 'github.com/acme/demo',
    remoteMainCommit:options.remoteMainCommit || MAIN,
    pullRequests,
    openPullRequests:options.openPullRequests || pullRequests.filter(row => row.state === 'OPEN')
  };
}

function handoffs() {
  return [handoff(32, MAIN, false), handoff(33, MAIN, true)];
}

function githubRows(sourceFacts) {
  return sourceFacts.pullRequests.map(row => ({
    number:row.number,
    url:row.url,
    title:row.title,
    state:row.state,
    isDraft:row.isDraft,
    mergeable:row.mergeable,
    mergeStateStatus:row.mergeStateStatus,
    headRefName:row.headRefName,
    headRefOid:row.headRefOid,
    baseRefName:row.baseRefName,
    baseRefOid:row.baseRefOid,
    mergedAt:row.mergedAt,
    statusCheckRollup:row.checks.map(check => Object.assign({ __typename:'CheckRun' }, check))
  }));
}

function fakeRunner(sourceFacts, options) {
  options = options || {};
  const commands = [];
  function result(status, stdout, stderr) { return { status, stdout:stdout || '', stderr:stderr || '' }; }
  function runner(command, args) {
    commands.push([command].concat(args));
    if (command !== 'gh') return result(1, '', 'unexpected executable');
    if (args[0] === '--version') return result(0, 'gh version test\n');
    if (args[0] === 'auth') return result(options.authFailed ? 1 : 0, '', options.authFailed ? 'not logged in' : '');
    if (args[0] === 'api') return result(options.mainFailed ? 1 : 0, options.mainFailed ? '' : sourceFacts.remoteMainCommit + '\n', options.mainFailed ? 'main unavailable' : '');
    if (args[0] === 'pr' && args[1] === 'list') return result(options.listFailed ? 1 : 0, options.listFailed ? '' : JSON.stringify(options.listRows || githubRows(sourceFacts)), options.listFailed ? 'list unavailable' : '');
    if (args[0] === 'pr' && args[1] === 'view') {
      const number = Number(args[2]), row = githubRows(sourceFacts).find(value => value.number === number);
      return row ? result(0, JSON.stringify(row)) : result(1, '', 'not found');
    }
    return result(1, '', 'unexpected command');
  }
  return { runner, commands };
}

(() => {
  const moduleRoot = __dirname;
  const manifest = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.contract.json'), 'utf8'));
  const hostSource = fs.readFileSync(path.join(moduleRoot, '..', '..', 'shared', 'deterministic-pr-sequencer', 'sequencer-host.js'), 'utf8');
  let count = 0;
  const ok = (value, message) => { assert.ok(value, message); count += 1; };
  const equal = (left, right, message) => { assert.equal(left, right, message); count += 1; };
  const throws = (callback, expression, message) => { assert.throws(callback, expression, message); count += 1; };

  equal(manifest.id, 'deterministic-pr-sequencer', 'manifest identity');
  equal(manifest.status, 'EXPERIMENTAL', 'honest module status');
  equal(manifest.risk, 'HIGH', 'high-consequence advice is explicit');
  ok(ContractVerifier.validateContract(contract, manifest).pass, 'manifest and contract validate');
  ok(['repository-write','pull-request-ready-transition','automatic-or-local-merge','technical-readiness-as-review-acceptance','canon-change'].every(value => contract.boundaries.refuses.includes(value)), 'write, authority, and fake-acceptance refusals are declared');
  equal(fs.readFileSync(path.join(moduleRoot, 'pr-sequencer-cli.cmd'), 'utf8').replace(/\r/g, ''), '@echo off\nsetlocal\nnode "%~dp0pr-sequencer-cli.js" %*\nexit /b %errorlevel%\n', 'Windows launcher explicitly invokes Node.js');
  ok(!/\['pr',\s*'(?:create|edit|ready|close|merge)'/.test(hostSource), 'host adapter contains no PR write command');
  ok(!/--method|--input|-X\b/.test(hostSource), 'GitHub API read has no write method option');
  ok(!/['"]git['"]/.test(hostSource), 'host adapter does not invoke Git');

  const normalizedPolicy = Core.normalizePolicy(policy());
  equal(normalizedPolicy.candidates.map(row => row.number).join(','), '32,33,29,30', 'policy preserves explicit order');
  equal(normalizedPolicy.selectionLimit, 1, 'policy fixes one candidate limit');
  ok(/^[a-f0-9]{64}$/.test(normalizedPolicy.policyDigest), 'policy is digest bound');
  const duplicatePolicy = policy(); duplicatePolicy.candidates[1].number = 32;
  throws(() => Core.normalizePolicy(duplicatePolicy), /unique/, 'duplicate candidate is refused');
  const squashPolicy = policy(); squashPolicy.mergeMethod = 'squash';
  throws(() => Core.normalizePolicy(squashPolicy), /mergeMethod/, 'head-erasing merge method is refused');
  const noHandoffPolicy = policy(); noHandoffPolicy.candidates[0].handoffRequired = false;
  throws(() => Core.normalizePolicy(noHandoffPolicy), /must require/, 'candidate without deterministic handoff is refused');

  const firstPlan = Core.buildPlan({ policy:policy(), handoffs:handoffs(), facts:facts() });
  equal(firstPlan.state, 'NEXT_READY', 'current exact state produces one next candidate');
  equal(firstPlan.next.number, 32, 'explicit first eligible candidate is selected');
  equal(firstPlan.next.expectedHead, HEADS[32], 'next action binds exact head');
  equal(firstPlan.next.checkpointBase, MAIN, 'next action binds exact checkpoint base');
  equal(firstPlan.next.ifMergedThen.refreshRequiredCandidates.join(','), '33', 'next action projects the exact candidate requiring post-merge refresh');
  equal(firstPlan.next.ifMergedThen.alreadyHeldCandidates.map(row => row.number).join(','), '29,30', 'next action preserves already-held later candidates');
  equal(firstPlan.candidates.filter(row => row.sequenceState === 'READY_NEXT').length, 1, 'only one candidate is next');
  equal(firstPlan.candidates.find(row => row.number === 33).sequenceState, 'WAIT_FOR_PREDECESSOR', 'later ready family remains waiting');
  equal(firstPlan.candidates.find(row => row.number === 33).intrinsicState, 'DRAFT_REVIEW_REQUIRED', 'draft state remains visible behind predecessor');
  ok(firstPlan.candidates.find(row => row.number === 29).issues.some(row => row.code === 'HANDOFF_MISSING'), 'missing older handoff is visible');
  ok(firstPlan.candidates.find(row => row.number === 29).issues.some(row => row.code === 'OBSERVED_BASE_DRIFT'), 'older observed base drift is visible');
  ok(Object.values(firstPlan.effects).every(value => value === false), 'plan grants no write or merge effect');
  equal(Core.verifyPlan(firstPlan).state, 'PASS', 'sequence plan verifies');
  equal(Core.buildPlan({ facts:facts(), policy:policy(), handoffs:handoffs().reverse() }).planDigest, firstPlan.planDigest, 'handoff argument order does not change plan');
  const tamperedPlan = JSON.parse(JSON.stringify(firstPlan)); tamperedPlan.next.expectedHead = '0'.repeat(40);
  equal(Core.verifyPlan(tamperedPlan).state, 'FAIL', 'plan tamper is detected');

  const platformPacket = Core.buildPlatformHandoff(firstPlan);
  equal(platformPacket.state, 'NEXT_READY', 'platform packet preserves plan state');
  equal(platformPacket.next.pullRequest, 32, 'platform packet names one PR');
  equal(platformPacket.next.ifMergedThen.refreshRequiredCandidates.join(','), '33', 'platform packet carries bounded post-merge refresh projection');
  ok(/stop and request a fresh sequence plan/.test(platformPacket.next.instruction), 'platform packet requires post-action stop');
  ok(Object.values(platformPacket.authority).every(value => value === false), 'platform packet grants no review or merge authority');
  equal(Core.verifyPlatformHandoff(platformPacket).state, 'PASS', 'platform packet verifies');
  const tamperedPacket = JSON.parse(JSON.stringify(platformPacket)); tamperedPacket.next.pullRequest = 33;
  equal(Core.verifyPlatformHandoff(tamperedPacket).state, 'FAIL', 'platform packet tamper is detected');

  const pendingRows = facts().pullRequests.map(row => Object.assign({}, row));
  pendingRows.find(row => row.number === 32).checks = checks({ 'windows-clean-launch':{ status:'IN_PROGRESS', conclusion:'' } });
  const pendingPlan = Core.buildPlan({ policy:policy(), handoffs:handoffs(), facts:facts({ pullRequests:pendingRows, openPullRequests:pendingRows }) });
  equal(pendingPlan.state, 'HELD', 'pending required check holds frontier');
  ok(pendingPlan.candidates[0].issues.some(row => row.code === 'REQUIRED_CHECK_PENDING'), 'pending check is typed');

  const failedRows = facts().pullRequests.map(row => Object.assign({}, row));
  failedRows.find(row => row.number === 32).checks = checks({ 'windows-clean-launch':{ conclusion:'FAILURE' } });
  ok(Core.buildPlan({ policy:policy(), handoffs:handoffs(), facts:facts({ pullRequests:failedRows, openPullRequests:failedRows }) }).candidates[0].issues.some(row => row.code === 'REQUIRED_CHECK_FAILED'), 'failed check is typed');
  const missingRows = facts().pullRequests.map(row => Object.assign({}, row));
  missingRows.find(row => row.number === 32).checks = checks().slice(0, 1);
  ok(Core.buildPlan({ policy:policy(), handoffs:handoffs(), facts:facts({ pullRequests:missingRows, openPullRequests:missingRows }) }).candidates[0].issues.some(row => row.code === 'REQUIRED_CHECK_MISSING'), 'missing check is typed');

  const headRows = facts().pullRequests.map(row => Object.assign({}, row));
  headRows.find(row => row.number === 32).headRefOid = 'f'.repeat(40);
  ok(Core.buildPlan({ policy:policy(), handoffs:handoffs(), facts:facts({ pullRequests:headRows, openPullRequests:headRows }) }).candidates[0].issues.some(row => row.code === 'HEAD_DRIFT'), 'head drift is typed');
  const basePlan = Core.buildPlan({ policy:policy(), handoffs:handoffs(), facts:facts({ remoteMainCommit:'d'.repeat(40) }) });
  equal(basePlan.state, 'HELD', 'advanced main holds old checkpoint');
  ok(basePlan.candidates[0].issues.some(row => row.code === 'CHECKPOINT_BASE_DRIFT'), 'checkpoint base drift is typed');

  const unlisted = observation(40);
  const unlistedFacts = facts(); unlistedFacts.openPullRequests = unlistedFacts.openPullRequests.concat([unlisted]);
  const unlistedPlan = Core.buildPlan({ policy:policy(), handoffs:handoffs(), facts:unlistedFacts });
  equal(unlistedPlan.state, 'HELD', 'unlisted review PR holds complete inventory policy');
  ok(unlistedPlan.globalIssues.some(row => row.code === 'UNLISTED_REVIEW_PULL_REQUESTS'), 'unlisted review PR is typed');
  const incompletePlan = Core.buildPlan({ policy:policy(), handoffs:handoffs(), facts:facts({ openInventoryComplete:false }) });
  ok(incompletePlan.globalIssues.some(row => row.code === 'OPEN_PULL_REQUEST_INVENTORY_INCOMPLETE'), 'truncated open inventory is held');

  const invalidHandoff = handoff(32, MAIN, false); invalidHandoff.packet.authority.canon = true;
  const invalidPlan = Core.buildPlan({ policy:policy(), handoffs:[invalidHandoff,handoff(33,MAIN,true)], facts:facts() });
  ok(invalidPlan.globalIssues.some(row => row.code === 'HANDOFF_INVALID'), 'invalid handoff is a global typed hold');
  const multiplePlan = Core.buildPlan({ policy:policy(), handoffs:[handoff(32,MAIN,false),handoff(32,MAIN,false),handoff(33,MAIN,true)], facts:facts() });
  ok(multiplePlan.globalIssues.some(row => row.code === 'MULTIPLE_HANDOFFS'), 'duplicate handoff is refused');

  const mergedFirstRows = [
    observation(32, { merged:true }),
    observation(33),
    observation(29, { isDraft:true, base:OLD }),
    observation(30, { isDraft:true, base:OLD })
  ];
  const secondPlan = Core.buildPlan({ policy:policy(), handoffs:handoffs(), facts:facts({ pullRequests:mergedFirstRows, openPullRequests:mergedFirstRows.filter(row => row.state === 'OPEN') }) });
  equal(secondPlan.state, 'NEXT_READY', 'merged exact predecessor advances frontier');
  equal(secondPlan.next.number, 33, 'second exact candidate becomes next when non-draft');
  const advancedPlan = Core.buildPlan({ policy:policy(), handoffs:handoffs(), facts:facts({ remoteMainCommit:'d'.repeat(40), pullRequests:mergedFirstRows, openPullRequests:mergedFirstRows.filter(row => row.state === 'OPEN') }) });
  equal(advancedPlan.state, 'HELD', 'post-merge main advance requires candidate refresh');
  ok(advancedPlan.candidates.find(row => row.number === 33).issues.some(row => row.code === 'CHECKPOINT_BASE_DRIFT'), 'post-merge refresh reason is explicit');

  const outOfOrderRows = facts().pullRequests.map(row => row.number === 33 ? observation(33, { merged:true }) : row);
  const outOfOrder = Core.buildPlan({ policy:policy(), handoffs:handoffs(), facts:facts({ pullRequests:outOfOrderRows, openPullRequests:outOfOrderRows.filter(row => row.state === 'OPEN') }) });
  equal(outOfOrder.state, 'HELD', 'out-of-order merge holds sequence');
  ok(outOfOrder.globalIssues.some(row => row.code === 'SEQUENCE_ORDER_VIOLATION'), 'out-of-order merge is typed');

  const allMerged = [29,30,32,33].map(number => observation(number, { merged:true }));
  const complete = Core.buildPlan({ policy:policy(), handoffs:handoffs(), facts:facts({ pullRequests:allMerged, openPullRequests:[] }) });
  equal(complete.state, 'COMPLETE', 'all exact merged candidates complete sequence');
  equal(complete.next, null, 'complete sequence has no next action');

  const liveFacts = facts();
  const fake = fakeRunner(liveFacts);
  const observed = Host.inspectGitHub({ policy:policy(), runner:fake.runner });
  equal(observed.ghAuthenticated, true, 'host checks existing GitHub authentication');
  equal(observed.remoteMainCommit, MAIN, 'host reads exact main receiver head');
  equal(observed.pullRequests.length, 4, 'host reads all policy candidates');
  equal(observed.openInventoryComplete, true, 'host confirms bounded open inventory completeness');
  equal(Core.buildPlan({ policy:policy(), handoffs:handoffs(), facts:observed }).next.number, 32, 'mock host receiver facts select expected next PR');
  ok(fake.commands.every(row => row[0] === 'gh'), 'host invokes only GitHub CLI');
  ok(!fake.commands.some(row => row[1] === 'pr' && ['create','edit','ready','close','merge'].includes(row[2])), 'executed host trace contains no PR mutation');
  ok(!fake.commands.some(row => row.includes('--method') || row.includes('--input')), 'executed API trace contains no write option');
  const noAuth = fakeRunner(liveFacts, { authFailed:true });
  const noAuthFacts = Host.inspectGitHub({ policy:policy(), runner:noAuth.runner });
  equal(noAuthFacts.ghAuthenticated, false, 'missing host authentication remains false');
  ok(!noAuth.commands.some(row => row[1] === 'api' || row[1] === 'pr'), 'missing auth prevents repository queries');
  const secret = 'github_pat_' + 'Z'.repeat(30), localPath = 'C:' + '\\Users\\private\\packet.json';
  ok(!Host.publicError(new Error(secret + ' ' + localPath)).includes(secret), 'public error redacts credential-shaped text');
  ok(!Host.publicError(new Error(secret + ' ' + localPath)).includes(localPath), 'public error redacts machine-local path');

  const parsed = Cli.parseArguments(['plan','--policy','policy.json','--handoff','a.json','--handoff','b.json']);
  equal(parsed.handoff.length, 2, 'CLI accepts repeated explicit handoff inputs');
  throws(() => Cli.parseArguments(['plan','--policy','a.json','--policy','b.json']), /duplicate/, 'CLI refuses duplicate scalar flags');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-pr-sequencer-selftest-'));
  try {
    const workspace = path.join(temp, 'workspace'), receipts = path.join(temp, 'receipts');
    fs.mkdirSync(workspace); fs.mkdirSync(receipts);
    const output = path.join(receipts, 'plan.json');
    Cli.emit(firstPlan, { out:output, workspaceRoot:workspace });
    ok(fs.existsSync(output), 'CLI emits create-new external packet');
    throws(() => Cli.emit(firstPlan, { out:output, workspaceRoot:workspace }), /already exists/, 'CLI refuses output overwrite');
    throws(() => Cli.emit(firstPlan, { out:path.join(workspace, 'inside.json'), workspaceRoot:workspace }), /outside/, 'CLI refuses output inside repository');
    const source = path.join(receipts, 'source.json'); fs.writeFileSync(source, JSON.stringify(policy()));
    const read = Cli.readJson(source, 'source');
    equal(read.fileSha256, crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), 'CLI binds exact handoff file bytes');
  } finally {
    fs.rmSync(temp, { recursive:true, force:true });
  }

  console.log('deterministic-pr-sequencer selftest PASS (' + count + ' checks)');
})();
