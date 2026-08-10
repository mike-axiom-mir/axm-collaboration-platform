'use strict';

const childProcess = require('node:child_process');
const Core = require('./sequencer-core');

function defaultRunner(command, args, options) {
  const result = childProcess.spawnSync(command, args, {
    encoding:'utf8',
    windowsHide:true,
    shell:false,
    timeout:options && options.timeout || 120000,
    maxBuffer:8 * 1024 * 1024
  });
  return {
    status:result.error ? -1 : result.status,
    stdout:String(result.stdout || ''),
    stderr:String(result.stderr || result.error && result.error.message || '')
  };
}

function tryRun(runner, command, args, options) {
  try {
    const result = runner(command, args, options || {});
    return result || { status:-1, stdout:'', stderr:'runner returned no result' };
  } catch (error) {
    return { status:-1, stdout:'', stderr:String(error.message || error) };
  }
}

function publicError(error) {
  return String(error && (error.message || error) || 'unknown GitHub observation failure')
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

function parseJsonResult(result, label) {
  if (!result || result.status !== 0) throw new Error(label + ' failed: ' + publicError(result && (result.stderr || result.stdout)));
  try { return JSON.parse(String(result.stdout || '')); }
  catch (_) { throw new Error(label + ' returned invalid JSON'); }
}

function normalizePullRequest(row) {
  return {
    number:Number(row.number),
    url:String(row.url || ''),
    title:String(row.title || ''),
    state:String(row.state || '').toUpperCase(),
    isDraft:row.isDraft === true,
    mergeable:String(row.mergeable || '').toUpperCase(),
    mergeStateStatus:String(row.mergeStateStatus || '').toUpperCase(),
    headRefName:String(row.headRefName || ''),
    headRefOid:String(row.headRefOid || '').toLowerCase(),
    baseRefName:String(row.baseRefName || ''),
    baseRefOid:String(row.baseRefOid || '').toLowerCase(),
    mergedAt:row.mergedAt || null,
    checks:(Array.isArray(row.statusCheckRollup) ? row.statusCheckRollup : []).filter(check => check && check.__typename === 'CheckRun').map(check => ({
      name:String(check.name || ''),
      status:String(check.status || '').toUpperCase(),
      conclusion:String(check.conclusion || '').toUpperCase()
    }))
  };
}

function inspectGitHub(options) {
  const runner = options && options.runner || defaultRunner;
  const policy = Core.normalizePolicy(options && options.policy);
  const ghProbe = tryRun(runner, 'gh', ['--version'], { timeout:10000 });
  const facts = {
    ghAvailable:ghProbe.status === 0,
    ghAuthenticated:false,
    remoteQuerySucceeded:false,
    prQuerySucceeded:false,
    openInventoryComplete:false,
    repositoryIdentity:policy.repository,
    remoteMainCommit:null,
    pullRequests:[],
    openPullRequests:[],
    queryErrors:[]
  };
  if (!facts.ghAvailable) return facts;
  facts.ghAuthenticated = tryRun(runner, 'gh', ['auth', 'status', '--hostname', 'github.com'], { timeout:30000 }).status === 0;
  if (!facts.ghAuthenticated) return facts;

  const main = tryRun(runner, 'gh', ['api', 'repos/' + policy.slug + '/git/ref/heads/main', '--jq', '.object.sha'], { timeout:60000 });
  if (main.status === 0 && /^[a-f0-9]{40}$/i.test(String(main.stdout || '').trim())) {
    facts.remoteQuerySucceeded = true;
    facts.remoteMainCommit = String(main.stdout).trim().toLowerCase();
  }

  const fields = 'number,url,title,state,isDraft,mergeable,mergeStateStatus,headRefName,headRefOid,baseRefName,baseRefOid,mergedAt,statusCheckRollup';
  const listed = tryRun(runner, 'gh', ['pr', 'list', '--repo', policy.slug, '--state', 'open', '--limit', '200', '--json', fields], { timeout:120000 });
  let rows = [];
  if (listed.status === 0) {
    try {
      const parsed = JSON.parse(String(listed.stdout || '[]'));
      if (!Array.isArray(parsed)) throw new Error('not an array');
      rows = parsed.map(normalizePullRequest);
      facts.openInventoryComplete = rows.length < 200;
    } catch (error) {
      facts.queryErrors.push({ code:'PULL_REQUEST_LIST_INVALID_JSON', detail:publicError(error) });
    }
  } else facts.queryErrors.push({ code:'PULL_REQUEST_LIST_FAILED', detail:publicError(listed.stderr || listed.stdout) });

  const byNumber = new Map(rows.map(row => [row.number, row]));
  policy.candidates.forEach(candidate => {
    if (byNumber.has(candidate.number)) return;
    const viewed = tryRun(runner, 'gh', ['pr', 'view', String(candidate.number), '--repo', policy.slug, '--json', fields], { timeout:60000 });
    if (viewed.status !== 0) {
      facts.queryErrors.push({ code:'PULL_REQUEST_VIEW_FAILED', number:candidate.number, detail:publicError(viewed.stderr || viewed.stdout) });
      return;
    }
    try {
      const row = normalizePullRequest(JSON.parse(String(viewed.stdout || '{}')));
      byNumber.set(row.number, row);
    } catch (error) {
      facts.queryErrors.push({ code:'PULL_REQUEST_VIEW_INVALID_JSON', number:candidate.number, detail:publicError(error) });
    }
  });
  facts.pullRequests = policy.candidates.map(candidate => byNumber.get(candidate.number)).filter(Boolean);
  facts.openPullRequests = Array.from(byNumber.values()).filter(row => row.state === 'OPEN');
  facts.prQuerySucceeded = listed.status === 0 && facts.queryErrors.length === 0 && facts.pullRequests.length === policy.candidates.length;
  return facts;
}

module.exports = {
  defaultRunner,
  publicError,
  normalizePullRequest,
  inspectGitHub
};
