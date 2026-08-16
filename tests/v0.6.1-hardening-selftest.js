#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PlainFiles = require('../shared/game-production-runner/plain-file-io');
const Hardware = require('../shared/hardware-research-registry/registry');
const Compute = require('../shared/compute-substrate-lab/lab');
const Research = require('../shared/deterministic-research');
const WarningDelta = require('../tools/repairbuddy/verifier-warning-delta');
const PublisherCore = require('../shared/deterministic-pr-publisher/publisher-core');
const PublisherHost = require('../shared/deterministic-pr-publisher/publisher-host');

const { Core } = Research;
let checks = 0;
function ok(value, message) { assert.ok(value, message); checks += 1; }
function equal(left, right, message) { assert.equal(left, right, message); checks += 1; }
function reseal(value, digestField) {
  const copy = Core.clone(value);
  delete copy[digestField];
  copy[digestField] = Core.digest(copy);
  return copy;
}
function run(command, args, cwd) {
  const result = childProcess.spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: 30000
  });
  if (result.error || result.status !== 0) {
    throw new Error(String(result.stderr || result.stdout || result.error));
  }
  return String(result.stdout || '').trim();
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-v061-hardening-'));
try {
  const releaseWorkflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'release-v0.6.1-experimental.yml'), 'utf8').replace(/\r\n/g, '\n');
  const publicLaunchWorkflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'public-launch.yml'), 'utf8').replace(/\r\n/g, '\n');
  const correctiveWorkflow = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'v0.6.1-corrective-gate.yml'), 'utf8').replace(/\r\n/g, '\n');
  const repositorySafety = JSON.parse(fs.readFileSync(path.join(ROOT, '.github', 'repository-safety', 'v0.6.1.json'), 'utf8'));
  const codeOwners = fs.readFileSync(path.join(ROOT, '.github', 'CODEOWNERS'), 'utf8');
  const expectedChecks = [
    'discovery-and-static-gates',
    'v0.6.1 corrective source gates',
    'v0.6.1 exact Windows package gate',
    'windows-clean-launch'
  ].sort();
  equal(JSON.stringify(repositorySafety.main.required_checks.slice().sort()), JSON.stringify(expectedChecks), 'repository safety requires the exact emitted check names');
  ok(publicLaunchWorkflow.includes('\n  discovery-and-static-gates:\n') && publicLaunchWorkflow.includes('\n  windows-clean-launch:\n'), 'public launch workflow emits both required public check names');
  ok(correctiveWorkflow.includes('name: v0.6.1 corrective source gates') && correctiveWorkflow.includes('name: v0.6.1 exact Windows package gate'), 'corrective workflow emits both required corrective check names');
  ok(!releaseWorkflow.includes('static-public-contract') && !releaseWorkflow.includes('clean-windows-launch'), 'release administration contains no stale required-check contexts');
  ok(releaseWorkflow.includes('-F is_template=false') && !releaseWorkflow.includes('-f is_template=false'), 'template administration uses a typed Boolean API field');
  equal((releaseWorkflow.match(/persist-credentials: false/g) || []).length, 4, 'every release-workflow checkout refuses persisted Git credentials');
  ok(releaseWorkflow.includes('permissions: {}') && releaseWorkflow.includes('contents: read') && releaseWorkflow.includes('contents: write') && releaseWorkflow.includes('issues: write'), 'release jobs declare bounded permissions instead of one workflow-wide write token');
  ok(releaseWorkflow.indexOf('ownership_state=') < releaseWorkflow.indexOf('gh api --method PATCH "repos/${GITHUB_REPOSITORY}" -F is_template=false'), 'review-ownership HOLD is evaluated before the repository-settings mutation');
  ok(releaseWorkflow.includes('[ "$independent_owner" = "$repository_owner" ]') && releaseWorkflow.includes('not assigned to every protected CODEOWNERS rule'), 'review ownership refuses self-review and incomplete CODEOWNERS coverage');
  ok(releaseWorkflow.includes('verify_administration()') && releaseWorkflow.includes('live repository administration does not match the exact reviewed policy'), 'repository administration is re-read before PASS');
  equal(repositorySafety.review_ownership.state, 'HOLD', 'independent CODEOWNER decision remains explicitly held');
  equal(repositorySafety.review_ownership.independent_code_owner, null, 'no independent CODEOWNER is invented');
  equal(repositorySafety.truth.independent_code_owner_authority_resolved, false, 'repository safety truth exposes unresolved review authority');
  const declaredOwners = [...new Set([...codeOwners.matchAll(/@([A-Za-z0-9-]+)/g)].map(match => match[1]))];
  equal(JSON.stringify(declaredOwners), JSON.stringify(['mike-axiom-mir']), 'current CODEOWNERS truthfully contains only the repository owner');

  const plainRoot = path.join(temp, 'plain-files');
  fs.mkdirSync(plainRoot);
  const normal = path.join(plainRoot, 'state.json');
  PlainFiles.writeAtomic(normal, Buffer.from('{"state":"READY"}\n'));
  equal(PlainFiles.read(normal).toString('utf8'), '{"state":"READY"}\n', 'plain-file normal read/write works');
  PlainFiles.appendAtomic(normal, Buffer.from('{"next":true}\n'));
  ok(PlainFiles.read(normal).toString('utf8').includes('"next":true'), 'plain-file bounded append works');

  if (process.platform !== 'win32') {
    const outside = path.join(temp, 'outside.txt');
    fs.writeFileSync(outside, 'outside stays unchanged\n');
    const link = path.join(plainRoot, 'linked.json');
    fs.symlinkSync(outside, link, 'file');
    assert.throws(() => PlainFiles.read(link), /plain-file target/i);
    checks += 1;
    assert.throws(() => PlainFiles.writeAtomic(link, 'tamper\n'), /plain-file target/i);
    checks += 1;
    assert.throws(() => PlainFiles.appendAtomic(link, 'tamper\n'), /plain-file target/i);
    checks += 1;
    equal(fs.readFileSync(outside, 'utf8'), 'outside stays unchanged\n', 'symlink target remains unchanged');
  }

  const hardware = Hardware.compile({
    schema: Hardware.INTAKE_SCHEMA,
    id: 'v061-hardware-fixture',
    title: 'Bounded hardware fixture',
    objective: 'Verify that research records cannot silently acquire authority.',
    sources: [],
    candidates: [{
      id: 'fixture-board',
      class: 'COMPUTE_DEVICE',
      title: 'Fixture board',
      description: 'A non-executing research candidate.',
      sourceIds: [],
      safety: { risk: 'HIGH', hazards: ['unverified'], requiredAuthorities: ['human review'] },
      tags: ['fixture']
    }],
    builds: [{
      id: 'fixture-build',
      title: 'Fixture build design',
      purpose: 'Test authority closure only.',
      candidateIds: ['fixture-board'],
      designArtifactRefs: [],
      state: 'DESIGN_ONLY',
      openQuestions: ['No physical build is authorized.']
    }],
    claims: []
  });
  ok(Hardware.verify(hardware).pass, 'hardware fixture verifies');
  const authorityExpansion = Core.clone(hardware);
  authorityExpansion.autoProcure = true;
  const resealedAuthorityExpansion = reseal(authorityExpansion, 'packageDigest');
  equal(Hardware.verify(resealedAuthorityExpansion).pass, false, 're-digested unknown authority field is refused');
  const buildExpansion = Core.clone(hardware);
  buildExpansion.builds[0].executionAuthority = true;
  const resealedBuildExpansion = reseal(buildExpansion, 'packageDigest');
  equal(Hardware.verify(resealedBuildExpansion).pass, false, 're-digested build authority expansion is refused');

  const compute = Compute.compile({
    schema: Compute.INTAKE_SCHEMA,
    id: 'v061-compute-fixture',
    title: 'Compute root replay fixture',
    objective: 'Verify root decisions by replay from the protected known start.',
    sources: [],
    milestones: [],
    substrates: [],
    architectures: [],
    claims: []
  });
  const candidate = Compute.knownStart.earlierCandidates[0];
  const proposal = Compute.planRootChange(compute, {
    candidateMilestoneId: candidate.id,
    reason: 'Exercise deterministic root-history replay.',
    evidenceRefs: [
      { surface: 'archive-a', locator: 'fixture://archive-a', digest: 'a'.repeat(64) },
      { surface: 'archive-b', locator: 'fixture://archive-b', digest: 'b'.repeat(64) }
    ]
  });
  const decided = Compute.applyRootDecision(compute, proposal, {
    schema: Compute.ROOT_DECISION_SCHEMA,
    proposalDigest: proposal.proposalDigest,
    outcome: 'ACCEPT',
    scope: 'WORKING_ROOT_ONLY',
    steward: { id: 'human-fixture-steward', kind: 'HUMAN' },
    decidedAt: '2026-08-16T08:00:00.000Z',
    evidenceVerdict: 'PASS',
    independentReview: true
  });
  ok(Compute.verify(decided).pass, 'replayed compute-root decision verifies');
  const forged = Core.clone(decided);
  const forgedEvent = forged.root.history[0];
  forgedEvent.steward.kind = 'AI';
  delete forgedEvent.eventDigest;
  forgedEvent.eventDigest = Core.digest(forgedEvent);
  forged.root.selected.selectedByDecision = forgedEvent.eventDigest;
  forged.root.rootStateDigest = Core.digest({ selected: forged.root.selected, history: forged.root.history });
  delete forged.packageDigest;
  forged.packageDigest = Core.digest(forged);
  equal(Compute.verify(forged).pass, false, 're-digested non-human root decision fails replay');

  const warningA = WarningDelta.classifyWarning('game package demo: missing file assets/hero.png (1 occurrence)');
  const warningB = WarningDelta.classifyWarning('game package demo: missing file assets/hero.png (2 occurrences)');
  equal(warningA.id, warningB.id, 'warning identity survives mutable counts');
  ok(warningA.identityBasis === 'STRUCTURED_SUBJECT_AND_NORMALIZED_CODE', 'warning identity exposes its stable basis');

  equal(PublisherCore.CONFIRMATION_SEMANTICS, 'STATIC_EXACT_PHRASE_NOT_NONCE', 'publisher confirmation semantics are truthful');
  const publisherSource = fs.readFileSync(path.join(ROOT, 'shared', 'deterministic-pr-publisher', 'publisher-core.js'), 'utf8');
  ok(publisherSource.includes("id:'pull-request-draft'"), 'publisher receiver receipt requires the PR to remain draft');
  const repairCliSource = fs.readFileSync(path.join(ROOT, 'tools', 'repairbuddy', 'repairbuddy-cli.js'), 'utf8');
  ok(repairCliSource.includes("spawnSync(process.execPath, [path.join(ROOT, 'verify.js')]"), 'RepairBuddy warning delta invokes a fresh root verifier');

  const runnerSource = fs.readFileSync(path.join(ROOT, 'shared', 'game-production-runner', 'runner.js'), 'utf8');
  const checkpointSource = fs.readFileSync(path.join(ROOT, 'shared', 'game-production-runner', 'run-checkpoint-contract.js'), 'utf8');
  const portableSource = fs.readFileSync(path.join(ROOT, 'shared', 'game-production-runner', 'portable-profile.js'), 'utf8');
  ok([runnerSource, checkpointSource, portableSource].every(source => source.includes('PlainFiles')), 'all fixed runner records use plain-file I/O');

  if (process.platform !== 'win32') {
    const remote = path.join(temp, 'publisher-remote.git');
    const work = path.join(temp, 'publisher-work');
    run('git', ['init', '--bare', remote], temp);
    fs.mkdirSync(work);
    run('git', ['init', '-b', 'codex/test'], work);
    run('git', ['config', 'user.name', 'AXM hardening test'], work);
    run('git', ['config', 'user.email', 'hardening@example.invalid'], work);
    fs.writeFileSync(path.join(work, 'README.md'), 'publisher hook test\n');
    run('git', ['add', 'README.md'], work);
    run('git', ['commit', '-m', 'test: publisher hook isolation'], work);
    run('git', ['remote', 'add', 'origin', remote], work);
    const marker = path.join(temp, 'hook-ran.txt');
    const hook = path.join(work, '.git', 'hooks', 'pre-push');
    fs.writeFileSync(hook, '#!/bin/sh\necho hook-ran > "' + marker.replace(/\\/g, '/') + '"\nexit 9\n');
    fs.chmodSync(hook, 0o755);
    PublisherHost.pushExactBranch(PublisherHost.defaultRunner, work, 'origin', 'codex/test');
    equal(fs.existsSync(marker), false, 'publisher disables repository-local Git hooks for its bounded push');
    const remoteHead = run('git', ['--git-dir', remote, 'rev-parse', 'refs/heads/codex/test'], temp);
    ok(/^[a-f0-9]{40}$/.test(remoteHead), 'publisher hook-isolated push reached the exact review branch');
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log('v0.6.1 hardening selftest PASS (' + checks + ' checks)');
