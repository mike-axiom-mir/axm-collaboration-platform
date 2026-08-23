#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Core = require('../../shared/deterministic-run-integrator/run-integrator-core');
const Host = require('../../shared/deterministic-run-integrator/run-integrator-host');
const Cli = require('./run-integrator-cli');

const BASE_DATE = '2000-01-01T00:00:00Z';

function git(root, args, options) {
  const result = childProcess.spawnSync('git', ['-C', root].concat(args), {
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
    timeout: 120000,
    env: Object.assign({}, process.env, options && options.env || {})
  });
  if (result.status !== 0) throw new Error('git ' + args.join(' ') + ' failed: ' + String(result.stderr || result.stdout));
  return String(result.stdout || '').trim();
}

function write(root, relative, body) {
  const target = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body, 'utf8');
}

function initialize(container, name) {
  const repositoryRoot = path.join(container, name + '-repo');
  const laneRoot = path.join(container, name + '-lane');
  fs.mkdirSync(repositoryRoot);
  const init = childProcess.spawnSync('git', ['init', '-b', 'codex/integration', repositoryRoot], {
    encoding: 'utf8', windowsHide: true, shell: false, timeout: 120000
  });
  if (init.status !== 0) throw new Error(String(init.stderr || init.stdout));
  git(repositoryRoot, ['config', 'user.name', 'AXM Selftest']);
  git(repositoryRoot, ['config', 'user.email', 'selftest@axm.invalid']);
  git(repositoryRoot, ['config', 'core.autocrlf', 'false']);
  write(repositoryRoot, 'base.txt', 'deterministic base\n');
  write(repositoryRoot, 'module/base.txt', 'module base\n');
  git(repositoryRoot, ['add', '--', 'base.txt', 'module/base.txt']);
  git(repositoryRoot, ['commit', '-m', 'deterministic base'], {
    env: { GIT_AUTHOR_DATE: BASE_DATE, GIT_COMMITTER_DATE: BASE_DATE }
  });
  return { repositoryRoot, laneRoot, baseCommit: git(repositoryRoot, ['rev-parse', 'HEAD']) };
}

function policy(runId, allowedPaths) {
  return {
    schema: Core.POLICY_SCHEMA,
    runId,
    targetBranch: 'codex/integration',
    allowedPaths: allowedPaths || ['module/'],
    allowDeletes: false,
    maxFiles: 20,
    maxBytes: 1024 * 1024
  };
}

function begin(fixture, explicitPolicy) {
  return Host.beginExact({
    repositoryRoot: fixture.repositoryRoot,
    laneRoot: fixture.laneRoot,
    policy: explicitPolicy,
    confirmation: Core.BEGIN_CONFIRMATION
  });
}

function blockerCodes(plan) {
  return plan.blockers.map(row => row.code);
}

function successfulRun(container, name) {
  const fixture = initialize(container, name);
  const explicitPolicy = policy('repeatable-run');
  const beginReceipt = begin(fixture, explicitPolicy);
  assert.equal(beginReceipt.state, 'PASS');
  assert.equal(Core.verifyReceipt(beginReceipt).state, 'PASS');
  write(fixture.laneRoot, 'module/output.txt', 'stable generated output\n');
  const firstPlan = Host.buildPlan(Object.assign({}, fixture, { policy: explicitPolicy }));
  const secondPlan = Host.buildPlan(Object.assign({}, fixture, { policy: explicitPolicy }));
  assert.equal(firstPlan.state, 'READY');
  assert.equal(secondPlan.planDigest, firstPlan.planDigest);
  assert.equal(Core.verifyPlan(firstPlan).state, 'PASS');
  const tampered = JSON.parse(JSON.stringify(firstPlan));
  tampered.summary.bytes += 1;
  assert.equal(Core.verifyPlan(tampered).state, 'FAIL');
  const applyReceipt = Host.applyExact(Object.assign({}, fixture, {
    policy: explicitPolicy,
    plan: firstPlan,
    confirmation: Core.APPLY_CONFIRMATION
  }));
  assert.equal(applyReceipt.state, 'PASS', JSON.stringify(applyReceipt, null, 2));
  assert.equal(Core.verifyReceipt(applyReceipt).state, 'PASS');
  assert.equal(git(fixture.repositoryRoot, ['status', '--porcelain']), '');
  assert.equal(git(fixture.repositoryRoot, ['rev-parse', 'HEAD']), applyReceipt.result.integratedHead);
  assert.equal(fs.readFileSync(path.join(fixture.repositoryRoot, 'module', 'output.txt'), 'utf8'), 'stable generated output\n');
  assert.equal(fs.existsSync(fixture.laneRoot), false);
  const branch = childProcess.spawnSync('git', ['-C', fixture.repositoryRoot, 'show-ref', '--verify', '--quiet', 'refs/heads/codex/run/repeatable-run']);
  assert.equal(branch.status, 1);
  return { planDigest: firstPlan.planDigest, runCommit: applyReceipt.result.integratedHead };
}

function heldForOutsidePolicy(container) {
  const fixture = initialize(container, 'outside-policy');
  const explicitPolicy = policy('outside-policy');
  assert.equal(begin(fixture, explicitPolicy).state, 'PASS');
  write(fixture.laneRoot, 'elsewhere/output.txt', 'not declared\n');
  const plan = Host.buildPlan(Object.assign({}, fixture, { policy: explicitPolicy }));
  assert.equal(plan.state, 'HELD');
  assert.ok(blockerCodes(plan).includes('PATH_OUTSIDE_POLICY'));
}

function heldForPrivatePath(container) {
  const fixture = initialize(container, 'private-path');
  const explicitPolicy = policy('private-path', ['local-data/']);
  assert.equal(begin(fixture, explicitPolicy).state, 'PASS');
  write(fixture.laneRoot, 'local-data/private.txt', 'local state\n');
  const plan = Host.buildPlan(Object.assign({}, fixture, { policy: explicitPolicy }));
  assert.equal(plan.state, 'HELD');
  assert.ok(blockerCodes(plan).includes('FORBIDDEN_PRIVATE_PATH'));
}

function heldForSensitiveContent(container) {
  const fixture = initialize(container, 'sensitive-content');
  const explicitPolicy = policy('sensitive-content');
  assert.equal(begin(fixture, explicitPolicy).state, 'PASS');
  const fakeShape = ['sk', 'proj', 'x'.repeat(32)].join('-');
  write(fixture.laneRoot, 'module/generated.txt', 'credential=' + fakeShape + '\n');
  const plan = Host.buildPlan(Object.assign({}, fixture, { policy: explicitPolicy }));
  assert.equal(plan.state, 'HELD');
  assert.ok(blockerCodes(plan).includes('SENSITIVE_CONTENT'));
  assert.equal(JSON.stringify(plan).includes(fakeShape), false);
}

function heldForDeletion(container) {
  const fixture = initialize(container, 'deletion');
  const explicitPolicy = policy('deletion');
  assert.equal(begin(fixture, explicitPolicy).state, 'PASS');
  fs.rmSync(path.join(fixture.laneRoot, 'module', 'base.txt'));
  const plan = Host.buildPlan(Object.assign({}, fixture, { policy: explicitPolicy }));
  assert.equal(plan.state, 'HELD');
  assert.ok(blockerCodes(plan).includes('DELETION_NOT_ALLOWED'));
}

function heldForGitFilter(container) {
  const fixture = initialize(container, 'git-filter');
  const explicitPolicy = policy('git-filter');
  assert.equal(begin(fixture, explicitPolicy).state, 'PASS');
  write(fixture.laneRoot, 'module/.gitattributes', '*.txt filter=custom-driver\n');
  write(fixture.laneRoot, 'module/output.txt', 'filtered candidate\n');
  const plan = Host.buildPlan(Object.assign({}, fixture, { policy: explicitPolicy }));
  assert.equal(plan.state, 'HELD');
  assert.ok(blockerCodes(plan).includes('GIT_FILTER_NOT_SUPPORTED'));
}

function heldForStagedContentDrift(container) {
  const fixture = initialize(container, 'staged-drift');
  const explicitPolicy = policy('staged-drift');
  assert.equal(begin(fixture, explicitPolicy).state, 'PASS');
  write(fixture.laneRoot, 'module/output.txt', 'planned bytes\n');
  const plan = Host.buildPlan(Object.assign({}, fixture, { policy: explicitPolicy }));
  assert.equal(plan.state, 'READY');
  let changed = false;
  const racingRunner = (command, args, options) => {
    if (!changed && command === 'git' && args.includes('add')) {
      write(fixture.laneRoot, 'module/output.txt', 'concurrent bytes\n');
      changed = true;
    }
    return Host.defaultRunner(command, args, options);
  };
  const receipt = Host.applyExact(Object.assign({}, fixture, {
    policy: explicitPolicy,
    plan,
    confirmation: Core.APPLY_CONFIRMATION,
    runner: racingRunner
  }));
  assert.equal(receipt.state, 'HELD');
  assert.ok(receipt.blockers.some(row => row.code === 'STAGED_CONTENT_DRIFT'));
  assert.equal(git(fixture.laneRoot, ['diff', '--cached', '--name-only']), '');
  assert.equal(git(fixture.repositoryRoot, ['rev-parse', 'HEAD']), fixture.baseCommit);
}

function heldForTargetDrift(container) {
  const fixture = initialize(container, 'target-drift');
  const explicitPolicy = policy('target-drift');
  assert.equal(begin(fixture, explicitPolicy).state, 'PASS');
  write(fixture.laneRoot, 'module/output.txt', 'lane output\n');
  const plan = Host.buildPlan(Object.assign({}, fixture, { policy: explicitPolicy }));
  assert.equal(plan.state, 'READY');
  write(fixture.repositoryRoot, 'target-drift.txt', 'new target commit\n');
  git(fixture.repositoryRoot, ['add', '--', 'target-drift.txt']);
  git(fixture.repositoryRoot, ['commit', '-m', 'target drift'], {
    env: { GIT_AUTHOR_DATE: '2000-01-01T00:00:02Z', GIT_COMMITTER_DATE: '2000-01-01T00:00:02Z' }
  });
  const driftHead = git(fixture.repositoryRoot, ['rev-parse', 'HEAD']);
  const receipt = Host.applyExact(Object.assign({}, fixture, {
    policy: explicitPolicy,
    plan,
    confirmation: Core.APPLY_CONFIRMATION
  }));
  assert.equal(receipt.state, 'HELD');
  assert.ok(receipt.blockers.some(row => row.code === 'TARGET_DRIFT'));
  assert.equal(git(fixture.repositoryRoot, ['rev-parse', 'HEAD']), driftHead);
  assert.equal(fs.existsSync(fixture.laneRoot), true);
}

function refusedBegins(container) {
  const missingConfirmation = initialize(container, 'missing-confirmation');
  const missingPolicy = policy('missing-confirmation');
  const noConfirmation = Host.beginExact(Object.assign({}, missingConfirmation, { policy: missingPolicy, confirmation: 'yes' }));
  assert.equal(noConfirmation.state, 'REFUSED');
  assert.equal(fs.existsSync(missingConfirmation.laneRoot), false);

  const dirty = initialize(container, 'dirty-target');
  write(dirty.repositoryRoot, 'dirty.txt', 'dirty\n');
  const dirtyReceipt = begin(dirty, policy('dirty-target'));
  assert.equal(dirtyReceipt.state, 'REFUSED');
  assert.equal(fs.existsSync(dirty.laneRoot), false);

  assert.throws(() => Core.normalizePolicy({
    schema: Core.POLICY_SCHEMA,
    runId: 'unsafe-main',
    targetBranch: 'main',
    allowedPaths: ['module/']
  }), /safe codex\/ or agent\/ prefix/);
}

function parserAndCliChecks() {
  const parsed = Host.parseStatusZ('?? module/name with spaces.txt\0');
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.rows[0].path, 'module/name with spaces.txt');
  assert.equal(Cli.parseArguments(['plan', '--repo', 'r', '--lane', 'l', '--policy', 'p']).action, 'plan');
  assert.throws(() => Cli.parseArguments(['plan', '--repo']), /explicit value/);
  const safeError = Host.publicError(new Error('problem at C:' + '\\' + 'Users' + '\\' + 'person' + '\\' + 'secret.txt'));
  assert.equal(safeError.includes('person'), false);
}

function main() {
  const container = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-run-integrator-'));
  try {
    parserAndCliChecks();
    const first = successfulRun(container, 'success-one');
    const second = successfulRun(container, 'success-two');
    assert.equal(first.planDigest, second.planDigest);
    assert.equal(first.runCommit, second.runCommit);
    heldForOutsidePolicy(container);
    heldForPrivatePath(container);
    heldForSensitiveContent(container);
    heldForDeletion(container);
    heldForGitFilter(container);
    heldForStagedContentDrift(container);
    heldForTargetDrift(container);
    refusedBegins(container);
    process.stdout.write('deterministic-run-integrator selftest: PASS\n');
  } finally {
    fs.rmSync(container, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write('deterministic-run-integrator selftest: FAIL\n' + Host.publicError(error) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { main };
