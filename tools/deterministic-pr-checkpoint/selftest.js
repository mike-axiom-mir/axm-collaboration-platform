#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Core = require('../../shared/deterministic-pr-checkpoint/checkpoint-core');
const ContractVerifier = require('../../hub/module-contract-verifier');

const FIXED_ENV = {
  GIT_AUTHOR_NAME:'AXM Checkpoint Test',
  GIT_AUTHOR_EMAIL:'checkpoint@example.invalid',
  GIT_COMMITTER_NAME:'AXM Checkpoint Test',
  GIT_COMMITTER_EMAIL:'checkpoint@example.invalid',
  GIT_AUTHOR_DATE:'2026-08-10T08:00:00Z',
  GIT_COMMITTER_DATE:'2026-08-10T08:00:00Z'
};

function git(cwd, args, options) {
  const result = childProcess.spawnSync('git', ['-C', cwd].concat(args), {
    encoding:'utf8',
    windowsHide:true,
    shell:false,
    timeout:30000,
    env:Object.assign({}, process.env, FIXED_ENV, options && options.env)
  });
  if (result.error || result.status !== 0) throw new Error(String(result.stderr || result.stdout || result.error));
  return String(result.stdout || '').trim();
}

function write(repositoryRoot, relativePath, content) {
  const target = path.join(repositoryRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive:true });
  fs.writeFileSync(target, content);
}

function commitAll(repositoryRoot, message) {
  git(repositoryRoot, ['add', '--all']);
  git(repositoryRoot, ['commit', '--no-gpg-sign', '-m', message]);
  return git(repositoryRoot, ['rev-parse', 'HEAD']);
}

function cloneFixture(source, target) {
  const result = childProcess.spawnSync('git', ['clone', '--no-local', '--branch', 'codex/demo', source, target], {
    encoding:'utf8', windowsHide:true, shell:false, timeout:30000
  });
  if (result.error || result.status !== 0) throw new Error(String(result.stderr || result.stdout || result.error));
  git(target, ['branch', 'main', 'origin/main']);
  git(target, ['remote', 'set-url', 'origin', 'https://github.com/acme/demo.git']);
  return target;
}

function blocker(packet, code) {
  return packet.blockers.some(row => row.code === code);
}

(() => {
  const moduleRoot = __dirname;
  const manifest = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'manifest.json'), 'utf8'));
  const contract = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.contract.json'), 'utf8'));
  let checks = 0;
  const ok = (value, message) => { assert.ok(value, message); checks += 1; };
  const equal = (left, right, message) => { assert.equal(left, right, message); checks += 1; };

  equal(manifest.id, 'deterministic-pr-checkpoint', 'manifest identity');
  equal(manifest.version, 'v0.1', 'manifest version');
  equal(manifest.status, 'EXPERIMENTAL', 'honest status');
  ok(ContractVerifier.validateContract(contract, manifest).pass, 'module contract validates');
  ok(contract.boundaries.refuses.includes('git-push') && contract.boundaries.refuses.includes('pull-request-creation') && contract.boundaries.refuses.includes('canon-change'), 'authority boundaries are explicit');
  ok(manifest.machine.actions.join(',') === 'inspect,verify,render', 'bounded machine actions declared');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-pr-checkpoint-selftest-'));
  try {
    const source = path.join(temp, 'source');
    fs.mkdirSync(source, { recursive:true });
    git(source, ['init', '-b', 'main']);
    git(source, ['remote', 'add', 'origin', 'https://github.com/acme/demo.git']);
    write(source, 'README.md', 'fixture\n');
    write(source, 'tools/demo/base.txt', 'base material\n');
    const baseCommit = commitAll(source, 'fixture base');
    git(source, ['checkout', '-b', 'codex/demo']);
    write(source, 'tools/demo/feature.txt', 'deterministic feature\n');
    write(source, 'tools/demo/evidence/focused.txt', 'focused evidence\n');
    const featureCommit = commitAll(source, 'feat: deterministic demo');

    const receiptDigest = crypto.createHash('sha256').update('focused evidence\n').digest('hex');
    const policy = {
      schema:Core.POLICY_SCHEMA,
      id:'fixture-scope-v1',
      baseRef:'main',
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
      requiredEvidenceClaims:['focused'],
      allowDeletions:false,
      allowRenames:false,
      allowCopies:false,
      scanSecrets:true,
      maxFiles:20,
      maxChangedBytes:1024 * 1024,
      maxCommits:10
    };
    const evidence = {
      schema:Core.EVIDENCE_SCHEMA,
      claims:[{
        claimId:'focused',
        status:'PASS',
        command:'node focused-selftest.js',
        summary:'Focused assertions passed.',
        evidenceDigest:receiptDigest,
        evidenceLocator:'tools/demo/evidence/focused.txt'
      }]
    };
    const metadata = {
      schema:Core.REVIEW_METADATA_SCHEMA,
      title:'feat: deterministic demo',
      summary:'Adds one deterministic fixture.',
      changeNotes:['One allowed file is added.'],
      riskNotes:['Remote freshness remains outside this local proof.'],
      followUps:['Human merge review remains required.']
    };

    const first = Core.inspectRepository({ repositoryRoot:source, policy, evidence });
    equal(first.state, 'READY', 'clean in-scope branch is READY');
    equal(first.repository.identity, 'github.com/acme/demo', 'credential-free repository identity retained');
    equal(first.repository.baseCommit, baseCommit, 'exact base commit bound');
    equal(first.repository.headCommit, featureCommit, 'exact head commit bound');
    equal(first.summary.files, 2, 'feature and evidence files counted');
    ok(first.changes.some(change => change.path === 'tools/demo/feature.txt'), 'changed path bound');
    ok(first.changes.every(change => /^[a-f0-9]{64}$/.test(change.after.sha256)), 'changed blob SHA-256 values bound');
    equal(first.evidence.claims[0].locatorBinding, 'DIGEST_MATCH', 'PASS evidence is bound to the committed Git blob');
    ok(!JSON.stringify(first).includes(source), 'filesystem root excluded from checkpoint');
    ok(Object.values(first.authority).every(value => value === false), 'checkpoint grants no authority');

    const copied = cloneFixture(source, path.join(temp, 'copied'));
    const second = Core.inspectRepository({ repositoryRoot:copied, policy, evidence });
    equal(second.checkpointDigest, first.checkpointDigest, 'same Git objects produce same digest at another path');
    equal(Core.canonicalDigest(Core.normalizePolicy(policy)), first.policy.digest, 'policy digest is independently reproducible');

    const verification = Core.verifyCheckpoint(first);
    equal(verification.state, 'PASS', 'saved checkpoint verifies');
    ok(verification.checks.every(row => row.pass), 'all checkpoint verification checks pass');
    const repeatedVerification = Core.verifyCheckpoint(first);
    equal(repeatedVerification.verificationDigest, verification.verificationDigest, 'verification receipt is deterministic');

    const review = Core.renderReviewPacket(first, metadata);
    equal(review.state, 'READY', 'READY review packet rendered');
    ok(review.body.includes(first.checkpointDigest) && review.body.includes('does not create or merge a PR'), 'review body carries digest and boundary');
    equal(Core.renderReviewPacket(first, metadata).reviewPacketDigest, review.reviewPacketDigest, 'review rendering is deterministic');
    ok(review.pullRequestCreated === false && review.mergeAuthority === false && review.canonAuthority === false, 'review packet carries no publication authority');

    const tampered = JSON.parse(JSON.stringify(first));
    tampered.summary.files = 99;
    equal(Core.verifyCheckpoint(tampered).state, 'FAIL', 'checkpoint tampering is detected');

    const dirty = cloneFixture(source, path.join(temp, 'dirty'));
    write(dirty, 'tools/demo/feature.txt', 'uncommitted change\n');
    const dirtyPacket = Core.inspectRepository({ repositoryRoot:dirty, policy, evidence });
    equal(dirtyPacket.state, 'HELD', 'dirty working tree is held');
    ok(blocker(dirtyPacket, 'DIRTY_WORKTREE'), 'dirty hold is typed');
    ok(!JSON.stringify(dirtyPacket).includes('uncommitted change'), 'dirty content is not retained');

    const outside = cloneFixture(source, path.join(temp, 'outside'));
    write(outside, 'README.md', 'scope leak\n');
    commitAll(outside, 'chore: leak outside scope');
    const outsidePacket = Core.inspectRepository({ repositoryRoot:outside, policy, evidence });
    equal(outsidePacket.state, 'HELD', 'out-of-scope path is held');
    ok(blocker(outsidePacket, 'PATH_OUTSIDE_SCOPE'), 'scope leak is typed');

    const deletion = cloneFixture(source, path.join(temp, 'deletion'));
    fs.rmSync(path.join(deletion, 'tools', 'demo', 'base.txt'));
    commitAll(deletion, 'chore: delete feature');
    const deletionPacket = Core.inspectRepository({ repositoryRoot:deletion, policy:Object.assign({}, policy, { requiredPaths:[] }), evidence });
    equal(deletionPacket.state, 'HELD', 'undeclared deletion is held');
    ok(blocker(deletionPacket, 'DELETION_NOT_ALLOWED'), 'deletion hold is typed');

    const rename = cloneFixture(source, path.join(temp, 'rename'));
    git(rename, ['mv', 'tools/demo/base.txt', 'tools/demo/renamed-base.txt']);
    commitAll(rename, 'chore: rename feature');
    const renamePacket = Core.inspectRepository({ repositoryRoot:rename, policy:Object.assign({}, policy, { requiredPaths:[] }), evidence });
    equal(renamePacket.state, 'HELD', 'undeclared rename is held');
    ok(blocker(renamePacket, 'RENAME_NOT_ALLOWED'), 'rename hold is typed');

    const secret = cloneFixture(source, path.join(temp, 'secret'));
    const secretValue = 'sk-' + 'A'.repeat(32);
    write(secret, 'tools/demo/private.txt', secretValue + '\n');
    commitAll(secret, 'chore: accidental credential');
    const secretPacket = Core.inspectRepository({ repositoryRoot:secret, policy, evidence });
    equal(secretPacket.state, 'HELD', 'sensitive changed content is held');
    ok(secretPacket.blockers.some(row => row.code === 'SENSITIVE_CONTENT' && row.rule === 'openai-key'), 'sensitive content rule is typed');
    ok(!JSON.stringify(secretPacket).includes(secretValue), 'secret value is never retained');

    const credentialRemote = cloneFixture(source, path.join(temp, 'credential-remote'));
    git(credentialRemote, ['remote', 'set-url', 'origin', 'https:' + '//' + 'user:' + 'remote-secret' + '@' + 'github.com/acme/demo.git']);
    const credentialPacket = Core.inspectRepository({ repositoryRoot:credentialRemote, policy, evidence });
    equal(credentialPacket.state, 'HELD', 'credential-bearing remote is held');
    ok(blocker(credentialPacket, 'CREDENTIAL_BEARING_REMOTE'), 'remote credential hold is typed');
    ok(!JSON.stringify(credentialPacket).includes('remote-secret'), 'remote credential is never retained');

    const drift = cloneFixture(source, path.join(temp, 'drift'));
    git(drift, ['checkout', 'main']);
    write(drift, 'base-advance.txt', 'advanced base\n');
    commitAll(drift, 'chore: advance base separately');
    git(drift, ['checkout', 'codex/demo']);
    const driftPacket = Core.inspectRepository({ repositoryRoot:drift, policy, evidence });
    equal(driftPacket.state, 'HELD', 'base drift is held');
    ok(blocker(driftPacket, 'BASE_NOT_ANCESTOR'), 'base drift hold is typed');

    const missingEvidence = Core.inspectRepository({ repositoryRoot:source, policy });
    equal(missingEvidence.state, 'HELD', 'missing required evidence is held');
    ok(blocker(missingEvidence, 'REQUIRED_EVIDENCE_MISSING'), 'missing evidence hold is typed');
    const unknownEvidence = JSON.parse(JSON.stringify(evidence));
    unknownEvidence.claims[0].status = 'UNKNOWN';
    unknownEvidence.claims[0].evidenceDigest = null;
    unknownEvidence.claims[0].evidenceLocator = null;
    const unknownPacket = Core.inspectRepository({ repositoryRoot:source, policy, evidence:unknownEvidence });
    ok(blocker(unknownPacket, 'REQUIRED_EVIDENCE_NOT_PASSING'), 'unknown required evidence remains held');
    const mismatchedEvidence = JSON.parse(JSON.stringify(evidence));
    mismatchedEvidence.claims[0].evidenceDigest = '0'.repeat(64);
    const mismatchPacket = Core.inspectRepository({ repositoryRoot:source, policy, evidence:mismatchedEvidence });
    ok(blocker(mismatchPacket, 'EVIDENCE_DIGEST_MISMATCH'), 'claimed PASS with the wrong blob digest is held');
    assert.throws(() => Core.normalizeEvidence({ schema:Core.EVIDENCE_SCHEMA, claims:[{ claimId:'bad', status:'PASS', command:'x', summary:'x' }] }), /requires a digest/);
    checks += 1;
    assert.throws(() => Core.normalizeEvidence({
      schema:Core.EVIDENCE_SCHEMA,
      claims:[{ claimId:'private-path', status:'UNKNOWN', command:'node C:' + '\\Users\\mike\\private.js', summary:'not run' }]
    }), /sensitive or machine-local/);
    checks += 1;
    assert.throws(() => Core.renderReviewPacket(first, Object.assign({}, metadata, { summary:'See /' + 'home/mike/private/report.txt' })), /sensitive or machine-local/);
    checks += 1;

    const sensitiveSubject = cloneFixture(source, path.join(temp, 'sensitive-subject'));
    write(sensitiveSubject, 'tools/demo/subject-safe.txt', 'safe content\n');
    const subjectSecret = 'sk-' + 'B'.repeat(32);
    commitAll(sensitiveSubject, 'fix: ' + subjectSecret);
    const subjectPacket = Core.inspectRepository({ repositoryRoot:sensitiveSubject, policy:Object.assign({}, policy, { requiredPaths:[] }), evidence });
    ok(blocker(subjectPacket, 'SENSITIVE_COMMIT_SUBJECT'), 'sensitive commit subject is held');
    ok(subjectPacket.commits.some(row => row.subject === '(sensitive subject withheld)'), 'sensitive commit subject is redacted');
    ok(!JSON.stringify(subjectPacket).includes(subjectSecret), 'sensitive commit subject value is not retained');

    const sensitivePath = cloneFixture(source, path.join(temp, 'sensitive-path'));
    const pathSecret = 'sk-' + 'C'.repeat(32);
    write(sensitivePath, 'tools/demo/' + pathSecret + '.txt', 'safe content\n');
    commitAll(sensitivePath, 'chore: unusual path');
    const pathPacket = Core.inspectRepository({ repositoryRoot:sensitivePath, policy:Object.assign({}, policy, { requiredPaths:[] }), evidence });
    ok(blocker(pathPacket, 'SENSITIVE_GIT_PATH'), 'sensitive Git path is held');
    ok(!JSON.stringify(pathPacket).includes(pathSecret), 'sensitive Git path value is not retained');

    const mainBranch = cloneFixture(source, path.join(temp, 'main-branch'));
    git(mainBranch, ['checkout', 'main']);
    const mainPacket = Core.inspectRepository({ repositoryRoot:mainBranch, policy:Object.assign({}, policy, { requiredPaths:[], requiredPrefixes:[] }), evidence });
    equal(mainPacket.state, 'HELD', 'default branch is held');
    ok(blocker(mainPacket, 'REFUSED_BRANCH'), 'default branch refusal is typed');

    const policyFile = path.join(temp, 'policy.json');
    const evidenceFile = path.join(temp, 'evidence.json');
    const packetFile = path.join(temp, 'checkpoint.json');
    fs.writeFileSync(policyFile, JSON.stringify(policy));
    fs.writeFileSync(evidenceFile, JSON.stringify(evidence));
    const cli = path.join(moduleRoot, 'pr-checkpoint-cli.js');
    const cliRun = childProcess.spawnSync(process.execPath, [cli, 'inspect', '--repo', source, '--policy', policyFile, '--evidence', evidenceFile, '--out', packetFile], { encoding:'utf8', windowsHide:true, shell:false, timeout:30000 });
    equal(cliRun.status, 0, 'CLI emits READY checkpoint');
    equal(JSON.parse(fs.readFileSync(packetFile, 'utf8')).checkpointDigest, first.checkpointDigest, 'CLI output matches core output');
    const overwrite = childProcess.spawnSync(process.execPath, [cli, 'inspect', '--repo', source, '--policy', policyFile, '--evidence', evidenceFile, '--out', packetFile], { encoding:'utf8', windowsHide:true, shell:false, timeout:30000 });
    equal(overwrite.status, 1, 'CLI refuses overwrite');
    ok(overwrite.stderr.includes('overwrite is refused'), 'overwrite refusal is explicit');
    const inside = childProcess.spawnSync(process.execPath, [cli, 'inspect', '--repo', source, '--policy', policyFile, '--evidence', evidenceFile, '--out', path.join(source, 'checkpoint.json')], { encoding:'utf8', windowsHide:true, shell:false, timeout:30000 });
    equal(inside.status, 1, 'CLI refuses source-tree output');
    ok(!fs.existsSync(path.join(source, 'checkpoint.json')), 'refused source-tree output leaves no file');
    const heldCli = childProcess.spawnSync(process.execPath, [cli, 'inspect', '--repo', outside, '--policy', policyFile, '--evidence', evidenceFile], { encoding:'utf8', windowsHide:true, shell:false, timeout:30000 });
    equal(heldCli.status, 2, 'CLI emits held packet with distinct exit code');
    equal(JSON.parse(heldCli.stdout).state, 'HELD', 'held CLI output remains machine-readable');

    ok(!fs.readdirSync(temp).some(name => name.includes('.axm-tmp-')), 'CLI leaves no temporary output file');
  } finally {
    fs.rmSync(temp, { recursive:true, force:true });
  }

  console.log('deterministic-pr-checkpoint selftest PASS (' + checks + ' checks)');
})();
