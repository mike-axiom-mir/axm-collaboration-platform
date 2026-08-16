'use strict';

const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Core = require('./publisher-core');

function defaultRunner(command, args, options) {
  const result = childProcess.spawnSync(command, args, {
    encoding:'utf8',
    windowsHide:true,
    shell:false,
    timeout:options && options.timeout || 120000,
    maxBuffer:8 * 1024 * 1024,
    env:options && options.env ? options.env : process.env
  });
  return {
    status:result.error ? -1 : result.status,
    stdout:String(result.stdout || ''),
    stderr:String(result.stderr || result.error && result.error.message || '')
  };
}

function cleanOutput(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(-1000);
}

function checked(runner, command, args, label, options) {
  const result = runner(command, args, options || {});
  if (!result || result.status !== 0) throw new Error(label + ' failed: ' + cleanOutput(result && (result.stderr || result.stdout)));
  return String(result.stdout || '').trim();
}

function tryRun(runner, command, args, options) {
  try {
    const result = runner(command, args, options || {});
    return result || { status:-1, stdout:'', stderr:'runner returned no result' };
  } catch (error) {
    return { status:-1, stdout:'', stderr:String(error.message || error) };
  }
}

function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}

function remoteIdentity(value) {
  const text = String(value || '').trim();
  let candidate = null;
  if (/^https:\/\/github\.com\//i.test(text)) candidate = text.replace(/^https:\/\//i, '').replace(/\.git$/i, '');
  else {
    const match = text.match(/^git@github\.com:([^\s]+)$/i);
    if (match) candidate = 'github.com/' + match[1].replace(/\.git$/i, '');
  }
  return candidate ? Core.repositoryIdentity(candidate) : null;
}

function parseRemoteRows(output) {
  const rows = new Map();
  String(output || '').split(/\r?\n/).filter(Boolean).forEach(line => {
    const match = line.match(/^([a-f0-9]{40,64})\s+refs\/heads\/(.+)$/i);
    if (match) rows.set(match[2], match[1].toLowerCase());
  });
  return rows;
}

function safeRemoteName(value) {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,60}$/.test(text)) throw new TypeError('checkpoint remote name is unsafe');
  return text;
}

function inspectHost(options) {
  const runner = options.runner || defaultRunner;
  const repositoryRoot = fs.realpathSync(path.resolve(options.repositoryRoot));
  const publishRoot = fs.realpathSync(path.resolve(options.publishRoot));
  const checkpoint = options.checkpoint || {};
  const remoteName = safeRemoteName(checkpoint.repository && checkpoint.repository.remoteName || 'origin');
  const expectedBranch = Core.branchName(checkpoint.repository && checkpoint.repository.branch);
  const expectedIdentity = Core.repositoryIdentity(checkpoint.repository && checkpoint.repository.identity);
  const gitProbe = tryRun(runner, 'git', ['--version'], { timeout:10000 });
  const ghProbe = tryRun(runner, 'gh', ['--version'], { timeout:10000 });
  const facts = {
    publishLaneVerified:isInside(publishRoot, repositoryRoot),
    gitAvailable:gitProbe.status === 0,
    ghAvailable:ghProbe.status === 0,
    ghAuthenticated:false,
    remoteQuerySucceeded:false,
    prQuerySucceeded:false,
    clean:false,
    branch:null,
    headCommit:null,
    repositoryIdentity:null,
    remoteBaseCommit:null,
    remoteBranchCommit:null,
    remoteBranchRelationKnown:true,
    remoteBranchFastForward:true,
    pullRequests:[]
  };
  if (!facts.gitAvailable) return facts;
  const top = fs.realpathSync(checked(runner, 'git', ['-C', repositoryRoot, 'rev-parse', '--show-toplevel'], 'Git top-level inspection'));
  if (top.toLowerCase() !== repositoryRoot.toLowerCase()) throw new Error('repositoryRoot must be the exact Git working-copy root');
  facts.branch = checked(runner, 'git', ['-C', repositoryRoot, 'branch', '--show-current'], 'Git branch inspection');
  facts.headCommit = checked(runner, 'git', ['-C', repositoryRoot, 'rev-parse', 'HEAD'], 'Git head inspection').toLowerCase();
  facts.clean = checked(runner, 'git', ['-C', repositoryRoot, 'status', '--porcelain=v1', '-z'], 'Git worktree inspection') === '';
  const remoteUrl = checked(runner, 'git', ['-C', repositoryRoot, 'remote', 'get-url', remoteName], 'Git remote inspection');
  facts.repositoryIdentity = remoteIdentity(remoteUrl);
  const remote = tryRun(runner, 'git', ['-C', repositoryRoot, 'ls-remote', '--heads', remoteName, 'refs/heads/main', 'refs/heads/' + expectedBranch], { timeout:60000 });
  if (remote.status === 0) {
    const refs = parseRemoteRows(remote.stdout);
    facts.remoteQuerySucceeded = true;
    facts.remoteBaseCommit = refs.get('main') || null;
    facts.remoteBranchCommit = refs.get(expectedBranch) || null;
    if (facts.remoteBranchCommit && facts.remoteBranchCommit !== facts.headCommit) {
      const object = tryRun(runner, 'git', ['-C', repositoryRoot, 'cat-file', '-e', facts.remoteBranchCommit + '^{commit}']);
      if (object.status !== 0) {
        facts.remoteBranchRelationKnown = false;
        facts.remoteBranchFastForward = false;
      } else {
        const relation = tryRun(runner, 'git', ['-C', repositoryRoot, 'merge-base', '--is-ancestor', facts.remoteBranchCommit, facts.headCommit]);
        facts.remoteBranchRelationKnown = relation.status === 0 || relation.status === 1;
        facts.remoteBranchFastForward = relation.status === 0;
      }
    }
  }
  if (facts.ghAvailable) {
    facts.ghAuthenticated = tryRun(runner, 'gh', ['auth', 'status', '--hostname', 'github.com'], { timeout:30000 }).status === 0;
  }
  if (facts.ghAuthenticated && facts.repositoryIdentity === expectedIdentity) {
    const listed = tryRun(runner, 'gh', ['pr', 'list', '--repo', Core.repositorySlug(expectedIdentity), '--state', 'open', '--head', expectedBranch, '--json', 'number,url,headRefName,headRefOid,baseRefName,isDraft,title'], { timeout:60000 });
    if (listed.status === 0) {
      try {
        const parsed = JSON.parse(String(listed.stdout || '[]'));
        if (!Array.isArray(parsed)) throw new Error('PR list is not an array');
        facts.pullRequests = parsed.map(row => ({
          number:Number(row.number),
          url:String(row.url || ''),
          headRefName:String(row.headRefName || ''),
          headRefOid:String(row.headRefOid || '').toLowerCase(),
          baseRefName:String(row.baseRefName || ''),
          isDraft:row.isDraft === true,
          title:String(row.title || '')
        }));
        facts.prQuerySucceeded = true;
      } catch (_) {}
    }
  }
  return facts;
}

function writeBodyFile(body) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-pr-publisher-'));
  const file = path.join(directory, 'body.md');
  fs.writeFileSync(file, body, { encoding:'utf8', flag:'wx' });
  return { directory, file };
}

function removeBodyFile(value) {
  if (!value || !value.directory) return;
  try { fs.rmSync(value.directory, { recursive:true, force:true }); } catch (_) {}
}

function viewPullRequest(runner, slug, number) {
  const raw = checked(runner, 'gh', ['pr', 'view', String(number), '--repo', slug, '--json', 'number,url,state,isDraft,headRefOid,baseRefOid,headRefName,baseRefName,title,body,mergedAt'], 'GitHub pull-request receiver inspection', { timeout:60000 });
  const row = JSON.parse(raw);
  return {
    pullRequestNumber:Number(row.number),
    pullRequestUrl:String(row.url || ''),
    pullRequestHeadCommit:String(row.headRefOid || '').toLowerCase(),
    pullRequestBaseCommit:String(row.baseRefOid || '').toLowerCase(),
    pullRequestBaseBranch:String(row.baseRefName || ''),
    pullRequestState:String(row.state || '').toUpperCase(),
    pullRequestDraft:row.isDraft === true,
    pullRequestTitle:String(row.title || ''),
    pullRequestBody:String(row.body || '').replace(/\r\n/g, '\n').trim(),
    merged:!!row.mergedAt
  };
}

function publicError(error) {
  return String(error && (error.message || error) || 'unknown publication failure')
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*/gi, '[private-key-redacted]')
    .replace(/\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, '[credential-redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{24,}\b/g, '[credential-redacted]')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[credential-redacted]')
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[credential-redacted]')
    .replace(/https:\/\/[^\s/@:]+:[^\s/@]+@/gi, 'https://[credential-redacted]@')
    .replace(/[A-Za-z]:\\(?:Users|AXM_ACTIVE|AXM_MIRROR_LOCAL)\\[^\s]+/gi, '[local-path]')
    .replace(/\/(?:home|Users)\/[^/\s]+\/[^\s]*/g, '[local-path]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0,1000);
}

function failureReceipt(plan, state, error, pushAction) {
  const stable = {
    schema:'axm.git-pr-publish-failure-receipt/v1',
    state,
    planDigest:plan && plan.planDigest || null,
    checkpointDigest:plan && plan.checkpointDigest || null,
    pushAction:pushAction || 'NOT_ATTEMPTED',
    pullRequestConfirmed:false,
    error:publicError(error),
    recovery:state === 'REMOTE_BRANCH_PUSHED_PR_UNCONFIRMED'
      ? 'Do not repush blindly. Inspect the exact remote branch head, then retry PR upsert with the same checkpointed head.'
      : 'Resolve the refusal and rebuild the deterministic publish plan.',
    authority:{ merge:false, branchDeletion:false, promotion:false, canon:false, roots:false }
  };
  return Object.assign({}, stable, { receiptDigest:Core.digest(stable) });
}

function pushExactBranch(runner, repositoryRoot, remoteName, branch) {
  const emptyHooks = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-pr-publisher-hooks-'));
  const env = Object.assign({}, process.env, {
    GIT_CONFIG_COUNT:'1',
    GIT_CONFIG_KEY_0:'core.hooksPath',
    GIT_CONFIG_VALUE_0:emptyHooks
  });
  try {
    return checked(
      runner,
      'git',
      ['-C', repositoryRoot, 'push', '--porcelain', remoteName, 'HEAD:refs/heads/' + branch],
      'exact review-branch push',
      { timeout:5 * 60 * 1000, env }
    );
  } finally {
    try { fs.rmSync(emptyHooks, { recursive:true, force:true }); } catch (_) {}
  }
}

function publishExact(options) {
  const runner = options.runner || defaultRunner;
  const plan = options.plan;
  let pushAction = 'NOT_ATTEMPTED';
  let remoteConfirmed = false;
  if (options.confirmation !== Core.CONFIRMATION) return failureReceipt(plan, 'REFUSED', new Error('exact publication confirmation is required'), pushAction);
  const planVerification = Core.verifyPlan(plan);
  if (planVerification.state !== 'PASS' || !plan || plan.state !== 'READY') return failureReceipt(plan, 'REFUSED', new Error('a verified READY publish plan is required'), pushAction);
  try {
    const facts = inspectHost(options);
    const current = Core.buildPlan({ checkpoint:options.checkpoint, verification:options.verification, review:options.review, facts });
    if (current.planDigest !== plan.planDigest) throw new Error('publish plan is stale; rebuild after the current local and remote state is observed');
    const repo = fs.realpathSync(path.resolve(options.repositoryRoot));
    if (facts.remoteBranchCommit !== plan.repository.headCommit) {
      pushExactBranch(runner, repo, plan.repository.remoteName, plan.repository.branch);
      pushAction = facts.remoteBranchCommit ? 'FAST_FORWARD_PUSHED' : 'CREATED_REMOTE_BRANCH';
    } else pushAction = 'REMOTE_HEAD_ALREADY_EXACT';
    const afterPush = inspectHost(options);
    if (afterPush.remoteBranchCommit !== plan.repository.headCommit) throw new Error('receiver did not report the exact checkpointed branch head after push');
    remoteConfirmed = true;
    const bodyFile = writeBodyFile(plan.pullRequest.body);
    let pullRequestAction;
    let number;
    try {
      const currentPr = afterPush.pullRequests.length === 1 ? afterPush.pullRequests[0] : null;
      if (!currentPr) {
        const created = checked(runner, 'gh', ['pr', 'create', '--repo', plan.repository.slug, '--base', 'main', '--head', plan.repository.branch, '--title', plan.pullRequest.title, '--body-file', bodyFile.file, '--draft'], 'GitHub draft pull-request creation', { timeout:60000 });
        const match = created.match(/https:\/\/github\.com\/[^\s]+\/pull\/(\d+)/i);
        if (!match) throw new Error('GitHub did not return a pull-request URL');
        number = Number(match[1]);
        pullRequestAction = 'CREATED_DRAFT';
      } else {
        number = currentPr.number;
        checked(runner, 'gh', ['pr', 'edit', String(number), '--repo', plan.repository.slug, '--title', plan.pullRequest.title, '--body-file', bodyFile.file], 'GitHub pull-request update', { timeout:60000 });
        pullRequestAction = 'UPDATED_EXISTING';
      }
    } finally {
      removeBodyFile(bodyFile);
    }
    const transport = viewPullRequest(runner, plan.repository.slug, number);
    transport.remoteHeadCommit = afterPush.remoteBranchCommit;
    return Core.buildReceipt({ plan, pushAction, pullRequestAction, transport });
  } catch (error) {
    return failureReceipt(plan, remoteConfirmed ? 'REMOTE_BRANCH_PUSHED_PR_UNCONFIRMED' : 'REFUSED', error, pushAction);
  }
}

module.exports = {
  defaultRunner,
  isInside,
  remoteIdentity,
  parseRemoteRows,
  inspectHost,
  publishExact,
  viewPullRequest,
  failureReceipt,
  publicError,
  pushExactBranch
};
