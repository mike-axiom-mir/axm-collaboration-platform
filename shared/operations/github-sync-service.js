'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Planner = require('../../tools/workshop-packager/package-planner');
const U = require('./operations-utils');

const CONFIG_SCHEMA = 'axm.github-sync-config/v1';
const PLAN_SCHEMA = 'axm.github-sync-plan/v1';
const PLAN_SUMMARY_SCHEMA = 'axm.github-sync-plan-summary/v1';
const RECEIPT_SCHEMA = 'axm.github-sync-receipt/v1';
const VERIFICATION_SCHEMA = 'axm.github-sync-verification/v1';
const PR_CANDIDATE_SCHEMA = 'axm.github-pr-candidate/v1';
const CONFIG_CONFIRMATION = 'CONFIGURE MACHINE GITHUB SYNC';
const MANUAL_PUSH_CONFIRMATION = 'PUSH REVIEWED PUBLIC SNAPSHOT';
const POLICY_VERSION = 'public-safe-no-delete-dedicated-branch/v1';
const MAX_FILES = 20000;
const MAX_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_GITHUB_FILE_BYTES = 100 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set(['.js','.cjs','.mjs','.html','.css','.json','.txt','.md','.bat','.cmd','.ps1','.sh','.yml','.yaml','.xml','.toml','.ini']);
const SECRET_PATTERNS = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=]{16,}/],
  ['openai-key', /\bsk-[A-Za-z0-9_-]{24,}\b/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ['google-key', /\bAIza[0-9A-Za-z_-]{20,}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ['discord-webhook', /https:\/\/(?:canary\.|ptb\.)?(?:discord(?:app)?\.com)\/api\/webhooks\/[0-9]+\/[A-Za-z0-9._-]+/],
  ['private-windows-user-path', /C:\\Users\\[^\\\r\n]+/i],
  ['assigned-api-key', /^\s*(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|GEMINI_API_KEY|AXM_BRIDGE_TOKEN)\s*=\s*[^%\s<][^\r\n]{11,}$/im]
];

function cleanBranch(value) {
  const branch = String(value || '').trim();
  if (!/^automation\/[a-z0-9][a-z0-9._/-]{0,100}$/i.test(branch) || branch.includes('..') || branch.includes('//') || branch.includes('@{')) {
    throw new Error('target branch must use the dedicated automation/ prefix');
  }
  return branch;
}

function cleanRemoteName(value) {
  const remote = String(value || 'origin').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,60}$/.test(remote)) throw new Error('Git remote name is invalid');
  return remote;
}

function cleanAuthorEmail(value) {
  const email = String(value || '').trim();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 200) throw new Error('commit author email is invalid');
  return email;
}

function isGitHubRemote(value) {
  const remote = String(value || '').trim();
  return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/i.test(remote)
    || /^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/i.test(remote)
    || /^ssh:\/\/git@github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/i.test(remote);
}

function githubRepositoryName(value) {
  const remote = String(value || '').trim();
  const match = remote.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/i)
    || remote.match(/^git@github\.com:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/i)
    || remote.match(/^ssh:\/\/git@github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/i);
  return match ? match[1] : null;
}

function resolveGit(options) {
  const candidates = [
    options && options.gitExecutable,
    process.env.AXM_GIT_EXE,
    process.platform === 'win32' && process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Git', 'cmd', 'git.exe') : null,
    process.platform === 'win32' && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'cmd', 'git.exe') : null,
    'git'
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && !fs.existsSync(candidate)) continue;
    const probe = childProcess.spawnSync(candidate, ['--version'], { windowsHide:true, shell:false, encoding:'utf8', timeout:10000 });
    if (!probe.error && probe.status === 0 && /^git version /.test(String(probe.stdout || '').trim())) return candidate;
  }
  return null;
}

function gitRun(git, repositoryRoot, args, options) {
  const result = childProcess.spawnSync(git, ['-C', repositoryRoot].concat(args), {
    windowsHide:true,
    shell:false,
    encoding: options && options.binary ? null : 'utf8',
    input: options && options.input,
    env: Object.assign({}, process.env, options && options.env || {}),
    timeout: options && options.timeout || 120000,
    maxBuffer: 8 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    const message = String(result.stderr || result.stdout || result.error && result.error.message || 'Git command failed').trim().slice(-3000);
    throw new Error('Git refused ' + args[0] + ': ' + message);
  }
  return options && options.binary ? result.stdout : String(result.stdout || '').trim();
}

function gitTry(git, repositoryRoot, args, options) {
  const result = childProcess.spawnSync(git, ['-C', repositoryRoot].concat(args), { windowsHide:true, shell:false, encoding:'utf8', input:options && options.input, timeout:30000, maxBuffer:8*1024*1024 });
  return { ok:!result.error && result.status === 0, stdout:String(result.stdout || '').trim(), stderr:String(result.stderr || '').trim() };
}

function pathListFromNul(value) {
  return String(value || '').split('\0').filter(Boolean).map(row => row.length > 3 ? row.slice(3).replace(/\\/g, '/') : '').filter(Boolean);
}

function canonicalConfig(value) {
  return {
    repositoryRoot:path.resolve(value.repositoryRoot),
    remoteName:value.remoteName,
    approvedRemoteUrl:value.approvedRemoteUrl,
    targetBranch:value.targetBranch,
    authorName:value.authorName,
    authorEmail:value.authorEmail,
    sourcePolicy:POLICY_VERSION,
    pushEnabled:value.pushEnabled === true
  };
}

function create(options) {
  options = options || {};
  const root = path.resolve(options.root);
  const stateRoot = path.resolve(options.stateRoot);
  const stateDir = path.join(stateRoot, 'github-sync');
  const configFile = path.join(stateDir, 'config.json');
  const auditFile = path.join(stateDir, 'receipts.jsonl');
  const candidateFile = path.join(stateDir, 'latest-pr-candidate.json');
  const lockFile = path.join(stateDir, 'sync.lock');
  const git = resolveGit(options);

  function readConfig() {
    const loaded = U.loadJson(configFile, null);
    if (!loaded || loaded.schema !== CONFIG_SCHEMA) return {
      schema:CONFIG_SCHEMA, enabled:false, pushEnabled:false, repositoryRoot:null, remoteName:'origin', targetBranch:'automation/workshop-sync',
      approvedRemoteUrl:null, authorName:'AXM Workshop Sync', authorEmail:null, configuredAt:null, configuredBy:null, authorizationDigest:null
    };
    return loaded;
  }

  function repoFacts(repositoryRoot, remoteName) {
    if (!git) throw new Error('Git executable is unavailable');
    const repo = path.resolve(String(repositoryRoot || ''));
    if (!fs.existsSync(repo) || !fs.statSync(repo).isDirectory()) throw new Error('configured Git working copy is unavailable');
    const top = path.resolve(gitRun(git, repo, ['rev-parse','--show-toplevel']));
    if (top.toLowerCase() !== repo.toLowerCase()) throw new Error('repositoryRoot must be the exact Git working-copy root');
    const branch = gitRun(git, repo, ['branch','--show-current']);
    if (!branch) throw new Error('detached Git HEAD is refused');
    const head = gitRun(git, repo, ['rev-parse','HEAD']);
    const remoteUrl = gitRun(git, repo, ['remote','get-url',remoteName]);
    const dirty = pathListFromNul(gitRun(git, repo, ['status','--porcelain=v1','-z']));
    return { repositoryRoot:repo, branch, head, remoteUrl, dirty };
  }

  function configure(input) {
    input = input || {};
    if (input.confirmation !== CONFIG_CONFIRMATION) throw new Error('exact machine GitHub sync configuration confirmation is required');
    if (!git) throw new Error('Git executable is unavailable');
    const repositoryRoot = path.resolve(String(input.repositoryRoot || ''));
    const remoteName = cleanRemoteName(input.remoteName);
    const targetBranch = cleanBranch(input.targetBranch || 'automation/workshop-sync');
    const authorName = String(input.authorName || 'AXM Workshop Sync').trim().slice(0, 160);
    const authorEmail = cleanAuthorEmail(input.authorEmail);
    if (!authorName) throw new Error('commit author name is required');
    const rootLower = root.toLowerCase(), repoLower = repositoryRoot.toLowerCase();
    if (repoLower === rootLower || repoLower.startsWith(rootLower + path.sep.toLowerCase()) || rootLower.startsWith(repoLower + path.sep.toLowerCase())) {
      throw new Error('Git sync requires a separate working copy outside the live Workshop');
    }
    const facts = repoFacts(repositoryRoot, remoteName);
    if (facts.branch !== targetBranch) throw new Error('working copy must already be on the approved automation branch');
    if (facts.dirty.length) throw new Error('Git working copy is dirty; sync configuration is refused');
    if (!options.allowLocalRemote && !isGitHubRemote(facts.remoteUrl)) throw new Error('remote must be a credential-free github.com URL');
    if (/https?:\/\/[^/@]+:[^/@]+@/i.test(facts.remoteUrl)) throw new Error('credential-bearing remote URLs are refused');
    if (input.pushEnabled === true) throw new Error('unattended push is reserved until the future verifier gate is approved');
    const pushEnabled = false;
    const config = {
      schema:CONFIG_SCHEMA,
      enabled:input.enabled === true,
      pushEnabled,
      repositoryRoot,
      remoteName,
      targetBranch,
      approvedRemoteUrl:facts.remoteUrl,
      authorName,
      authorEmail,
      configuredAt:U.now(),
      configuredBy:String(input.actor || 'local-user').slice(0,120),
      approvedBy:null,
      policy:POLICY_VERSION
    };
    config.authorizationDigest = U.sha256(JSON.stringify(canonicalConfig(config)));
    U.atomicJson(configFile, config);
    return publicStatus(config, facts);
  }

  function publicStatus(config, knownFacts) {
    config = config || readConfig();
    let facts = knownFacts || null, capability = git ? 'READY_FOR_CONFIGURATION' : 'MISSING_GIT';
    let hold = null;
    if (config.repositoryRoot && git) {
      try {
        facts = facts || repoFacts(config.repositoryRoot, config.remoteName);
        if (facts.remoteUrl !== config.approvedRemoteUrl) { capability = 'HELD'; hold = 'REMOTE_URL_CHANGED'; }
        else if (facts.branch !== config.targetBranch) { capability = 'HELD'; hold = 'WRONG_BRANCH'; }
        else if (facts.dirty.length) { capability = 'HELD'; hold = 'DIRTY_WORKING_COPY'; }
        else capability = config.enabled ? 'MANUAL_REVIEW_READY' : 'DISABLED';
      } catch (error) { capability = 'HELD'; hold = String(error.message || error).slice(0,500); }
    }
    return {
      schema:CONFIG_SCHEMA,
      git:{ available:!!git, executable:git ? path.basename(git) : null },
      config:{
        enabled:config.enabled === true,
        pushEnabled:config.pushEnabled === true,
        repositoryRoot:config.repositoryRoot,
        remoteName:config.remoteName,
        targetBranch:config.targetBranch,
        approvedRemoteUrl:config.approvedRemoteUrl,
        authorName:config.authorName,
        authorEmail:config.authorEmail,
        configuredAt:config.configuredAt,
        configuredBy:config.configuredBy,
        approvedBy:config.approvedBy || null,
        authorizationDigest:config.authorizationDigest
      },
      runtime:facts ? { branch:facts.branch, head:facts.head, remoteUrl:facts.remoteUrl, dirtyPaths:facts.dirty } : null,
      capability,
      hold,
      runner:{
        file:'tools/source-control-merge-workbench/sync-runner.js',
        dryRunArgument:'--dry-run',
        manualArgument:'--manual-reviewed-push --plan-digest <digest> --confirmation "' + MANUAL_PUSH_CONFIRMATION + '"',
        verifierArgument:'--verify-plan --plan-digest <digest>',
        scheduledArgument:null
      },
      truth:{
        liveWorkshopIsNeverGitMutated:true,
        separateWorkingCopyRequired:true,
        dedicatedAutomationBranchRequired:true,
        deletionsAreAdvisoryOnly:true,
        credentialsStoredByAxm:false,
        cloneOrRepositoryInitialization:false,
        directMainPush:false,
        reviewedPlanDigestRequired:true,
        manualPushIsOneUse:true,
        pullRequestCreation:false,
        githubMerge:false,
        canonAuthority:false
      }
    };
  }

  function sourceInventory() {
    const collected = Planner.collectFiles(root, []);
    if (collected.files.size > MAX_FILES) throw new Error('public-safe source exceeds the Git sync file limit');
    const rows = [];
    let totalBytes = 0;
    const findings = [];
    for (const relative of Array.from(collected.files.keys()).sort()) {
      const absolute = collected.files.get(relative), stat = fs.statSync(absolute);
      totalBytes += stat.size;
      if (totalBytes > MAX_BYTES) throw new Error('public-safe source exceeds the Git sync byte limit');
      if (stat.size > MAX_GITHUB_FILE_BYTES) findings.push({ path:relative, rule:'github-file-over-100mb' });
      if (stat.size <= 2 * 1024 * 1024 && TEXT_EXTENSIONS.has(path.extname(relative).toLowerCase())) {
        const content = fs.readFileSync(absolute, 'utf8');
        SECRET_PATTERNS.forEach(pattern => { if (pattern[1].test(content)) findings.push({ path:relative, rule:pattern[0] }); });
      }
      rows.push({ path:relative, bytes:stat.size, sha256:U.fileSha256(absolute) });
    }
    const sourceDigest = U.sha256(rows.map(row => row.path + '\0' + row.bytes + '\0' + row.sha256).join('\n'));
    return { rows, totalBytes, sourceDigest, findings };
  }

  function buildPlan() {
    const config = readConfig();
    if (!config.enabled) throw new Error('machine GitHub sync is disabled');
    const expectedAuthorization = U.sha256(JSON.stringify(canonicalConfig(config)));
    if (expectedAuthorization !== config.authorizationDigest) throw new Error('Git sync authorization digest is stale');
    const facts = repoFacts(config.repositoryRoot, config.remoteName);
    if (facts.remoteUrl !== config.approvedRemoteUrl) throw new Error('Git remote URL changed after approval');
    if (facts.branch !== config.targetBranch) throw new Error('Git working copy is not on the approved automation branch');
    if (facts.dirty.length) throw new Error('Git working copy is dirty; automatic sync is refused');
    const inventory = sourceInventory();
    const changes = [];
    inventory.rows.forEach(row => {
      const target = U.resolveUnder(config.repositoryRoot, row.path);
      const targetSha256 = fs.existsSync(target) && fs.statSync(target).isFile() ? U.fileSha256(target) : null;
      if (targetSha256 !== row.sha256) changes.push(Object.assign({}, row, { action:targetSha256 ? 'UPDATE' : 'ADD', targetSha256 }));
    });
    const sourcePaths = new Set(inventory.rows.map(row => row.path));
    const trackedRaw = gitRun(git, config.repositoryRoot, ['ls-files','-z']);
    const advisoryRemovals = String(trackedRaw || '').split('\0').filter(Boolean).map(value => value.replace(/\\/g,'/')).filter(value => !sourcePaths.has(value)).sort();
    const blockers = inventory.findings.map(finding => ({ code:'PUBLIC_SAFETY_REFUSAL', path:finding.path, rule:finding.rule }));
    const digestBody = {
      policy:POLICY_VERSION,
      authorizationDigest:config.authorizationDigest,
      sourceDigest:inventory.sourceDigest,
      repositoryHead:facts.head,
      branch:facts.branch,
      remoteUrl:facts.remoteUrl,
      changes:changes.map(row => ({ path:row.path, action:row.action, bytes:row.bytes, sha256:row.sha256 })),
      advisoryRemovals
    };
    return {
      schema:PLAN_SCHEMA,
      generatedAt:U.now(),
      planDigest:U.sha256(JSON.stringify(digestBody)),
      policy:POLICY_VERSION,
      authorizationDigest:config.authorizationDigest,
      source:{ root:path.basename(root), files:inventory.rows.length, bytes:inventory.totalBytes, digest:inventory.sourceDigest, publicSafety: blockers.length ? 'REFUSED' : 'PASS' },
      repository:{ root:path.basename(config.repositoryRoot), head:facts.head, branch:facts.branch, remoteName:config.remoteName, remoteUrl:facts.remoteUrl },
      changes,
      advisoryRemovals,
      blockers,
      executable:blockers.length === 0,
      unattendedExecutable:false,
      truth:{ dryRun:true, liveWorkshopWrites:false, deletionWrites:false, commitWrites:false, pushWrites:false, reviewedPlanDigestRequired:true, githubMerge:false, canonAuthority:false }
    };
  }

  function summarizePlan(plan) {
    const areas = new Map();
    let addCount = 0, updateCount = 0, changedBytes = 0;
    plan.changes.forEach(change => {
      if (change.action === 'ADD') addCount += 1;
      else if (change.action === 'UPDATE') updateCount += 1;
      changedBytes += change.bytes;
      const slash = change.path.indexOf('/');
      const area = slash === -1 ? '(root)' : change.path.slice(0, slash);
      const current = areas.get(area) || { area, changes:0, adds:0, updates:0, bytes:0 };
      current.changes += 1;
      current.bytes += change.bytes;
      if (change.action === 'ADD') current.adds += 1;
      else if (change.action === 'UPDATE') current.updates += 1;
      areas.set(area, current);
    });
    const areaRows = Array.from(areas.values()).sort((a,b) => b.changes - a.changes || a.area.localeCompare(b.area));
    const largestChanges = plan.changes.slice().sort((a,b) => b.bytes - a.bytes || a.path.localeCompare(b.path)).slice(0,12).map(change => ({ path:change.path, action:change.action, bytes:change.bytes, sha256:change.sha256 }));
    return {
      schema:PLAN_SUMMARY_SCHEMA,
      generatedAt:plan.generatedAt,
      planDigest:plan.planDigest,
      policy:plan.policy,
      authorizationDigest:plan.authorizationDigest,
      source:plan.source,
      repository:plan.repository,
      counts:{ changes:plan.changes.length, adds:addCount, updates:updateCount, changedBytes, advisoryRemovals:plan.advisoryRemovals.length, blockers:plan.blockers.length },
      areas:areaRows,
      sampleChanges:plan.changes.slice(0,40).map(change => ({ path:change.path, action:change.action, bytes:change.bytes, sha256:change.sha256 })),
      largestChanges,
      advisoryRemovals:{ count:plan.advisoryRemovals.length, sample:plan.advisoryRemovals.slice(0,40) },
      blockers:plan.blockers,
      executable:plan.executable,
      unattendedExecutable:false,
      fullPlanRequiresExactDigest:true,
      truth:plan.truth
    };
  }

  function buildPlanSummary() { return summarizePlan(buildPlan()); }

  function buildExactPlan(expectedPlanDigest) {
    const expected = String(expectedPlanDigest || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('an exact reviewed plan digest is required');
    const plan = buildPlan();
    if (plan.planDigest !== expected) throw new Error('reviewed plan digest is stale; rebuild and review the dry plan');
    return plan;
  }

  function verifyPlan(expectedPlanDigest) {
    const expected = String(expectedPlanDigest || '').trim().toLowerCase();
    const plan = buildPlan();
    const checks = [
      { id:'plan-digest-match', pass:/^[a-f0-9]{64}$/.test(expected) && plan.planDigest === expected },
      { id:'public-safety', pass:plan.source.publicSafety === 'PASS' && plan.blockers.length === 0 },
      { id:'clean-dedicated-branch', pass:plan.repository.branch.startsWith('automation/') },
      { id:'no-delete-policy', pass:plan.truth.deletionWrites === false },
      { id:'no-merge-authority', pass:plan.truth.githubMerge === false && plan.truth.canonAuthority === false }
    ];
    const stable = {
      schema:VERIFICATION_SCHEMA,
      state:checks.every(check => check.pass) ? 'PASS' : 'REFUSED',
      expectedPlanDigest:expected || null,
      currentPlanDigest:plan.planDigest,
      sourceDigest:plan.source.digest,
      repositoryHead:plan.repository.head,
      branch:plan.repository.branch,
      checks
    };
    return Object.assign({ verifiedAt:U.now(), verificationDigest:U.sha256(JSON.stringify(stable)) }, stable);
  }

  function acquireLock() {
    fs.mkdirSync(stateDir, { recursive:true });
    try { return fs.openSync(lockFile, 'wx'); }
    catch (error) { throw new Error('another Git sync run is active or left a lock requiring review'); }
  }

  function releaseLock(fd) {
    try { fs.closeSync(fd); } catch (_) {}
    try { fs.unlinkSync(lockFile); } catch (_) {}
  }

  function restorePreCommit(repositoryRoot, backupRoot, manifest) {
    manifest.forEach(item => {
      const target = U.resolveUnder(repositoryRoot, item.path);
      if (item.existed) {
        const source = U.resolveUnder(backupRoot, item.path);
        fs.mkdirSync(path.dirname(target), { recursive:true });
        fs.copyFileSync(source, target);
      } else if (fs.existsSync(target)) fs.rmSync(target, { force:true });
    });
    if (manifest.length) {
      const input = Buffer.from(manifest.map(item => item.path).join('\0') + '\0');
      gitTry(git, repositoryRoot, ['reset','--mixed','HEAD','--pathspec-from-file=-','--pathspec-file-nul'], { input });
    }
  }

  function execute(mode, request) {
    request = request || {};
    const config = readConfig();
    if (!config.enabled) throw new Error('machine GitHub sync planning is not enabled');
    const manual = mode === 'MANUAL_REVIEWED_PUSH';
    if (manual) {
      if (request.confirmation !== MANUAL_PUSH_CONFIRMATION) throw new Error('exact reviewed public snapshot confirmation is required');
      if (!/^[a-f0-9]{64}$/i.test(String(request.planDigest || ''))) throw new Error('an exact reviewed plan digest is required');
    } else if (!config.pushEnabled) throw new Error('authorized unattended machine GitHub sync is not enabled');
    const lock = acquireLock();
    let plan, committed = false, commitSha = null;
    const runId = U.uid('github-sync');
    const backupRoot = path.join(stateDir, 'precommit', runId);
    const backupManifest = [];
    try {
      plan = buildPlan();
      if (manual && plan.planDigest !== String(request.planDigest).toLowerCase()) throw new Error('reviewed plan digest is stale; rebuild and review the dry plan');
      if (plan.blockers.length) throw new Error('public-safe source scan refused Git sync');
      if (!plan.changes.length) {
        const receipt = {
          schema:RECEIPT_SCHEMA, runId, at:U.now(), state:'NO_CHANGES', mode, planDigest:plan.planDigest, sourceDigest:plan.source.digest,
          commitSha:plan.repository.head, committed:false, pushed:false, changedFiles:0, branch:config.targetBranch, remoteName:config.remoteName,
          actor:String(request.actor || 'local-user').slice(0,120), credentialsStoredByAxm:false, pullRequestCreated:false, githubMerge:false, canonAuthority:false
        };
        U.appendJsonl(auditFile, receipt);
        return receipt;
      }
      plan.changes.forEach(change => {
        const source = U.resolveUnder(root, change.path);
        if (U.fileSha256(source) !== change.sha256) throw new Error('Workshop source changed after Git sync planning');
        const target = U.resolveUnder(config.repositoryRoot, change.path);
        const existed = fs.existsSync(target);
        backupManifest.push({ path:change.path, existed });
        if (existed) {
          const backup = U.resolveUnder(backupRoot, change.path);
          fs.mkdirSync(path.dirname(backup), { recursive:true });
          fs.copyFileSync(target, backup);
        }
        fs.mkdirSync(path.dirname(target), { recursive:true });
        fs.copyFileSync(source, target);
      });
      const pathInput = Buffer.from(plan.changes.map(change => change.path).join('\0') + '\0');
      gitRun(git, config.repositoryRoot, ['add','--pathspec-from-file=-','--pathspec-file-nul'], { input:pathInput });
      const dirty = pathListFromNul(gitRun(git, config.repositoryRoot, ['status','--porcelain=v1','-z']));
      const planned = new Set(plan.changes.map(change => change.path));
      const unexpected = dirty.filter(relative => !planned.has(relative));
      if (unexpected.length) throw new Error('Git working copy changed outside the approved sync plan');
      const currentInventory = sourceInventory();
      if (currentInventory.sourceDigest !== plan.source.digest || currentInventory.findings.length) throw new Error('Workshop public-safe source changed after reviewed planning');
      const currentHead = gitRun(git, config.repositoryRoot, ['rev-parse','HEAD']);
      const currentBranch = gitRun(git, config.repositoryRoot, ['branch','--show-current']);
      const currentRemoteUrl = gitRun(git, config.repositoryRoot, ['remote','get-url',config.remoteName]);
      if (currentHead !== plan.repository.head || currentBranch !== plan.repository.branch || currentRemoteUrl !== plan.repository.remoteUrl) throw new Error('Git state changed after reviewed planning');
      const commitMessage = 'chore(sync): update public Workshop snapshot\n\nAXM-Source-Digest: ' + plan.source.digest + '\nAXM-Plan-Digest: ' + plan.planDigest;
      gitRun(git, config.repositoryRoot, ['commit','--no-gpg-sign','-m',commitMessage], { env:{ GIT_AUTHOR_NAME:config.authorName, GIT_AUTHOR_EMAIL:config.authorEmail, GIT_COMMITTER_NAME:config.authorName, GIT_COMMITTER_EMAIL:config.authorEmail } });
      committed = true;
      commitSha = gitRun(git, config.repositoryRoot, ['rev-parse','HEAD']);
      try {
        const pushOutput = gitRun(git, config.repositoryRoot, ['push','--porcelain',config.remoteName,'HEAD:refs/heads/' + config.targetBranch], { timeout:5*60*1000 });
        const repository = githubRepositoryName(config.approvedRemoteUrl);
        const prCandidate = {
          schema:PR_CANDIDATE_SCHEMA,
          createdAt:U.now(),
          repository,
          baseBranch:'main',
          headBranch:config.targetBranch,
          commitSha,
          planDigest:plan.planDigest,
          sourceDigest:plan.source.digest,
          changedFiles:plan.changes.length,
          title:'chore(sync): update public Workshop snapshot',
          body:'Deterministic public-safe Workshop sync.\n\n- Plan digest: `' + plan.planDigest + '`\n- Source digest: `' + plan.source.digest + '`\n- Changed files: ' + plan.changes.length + '\n- Advisory removals (not deleted): ' + plan.advisoryRemovals.length,
          draftRecommended:true,
          pullRequestCreated:false,
          mergeAuthority:false,
          canonAuthority:false
        };
        U.atomicJson(candidateFile, prCandidate);
        const receipt = {
          schema:RECEIPT_SCHEMA, runId, at:U.now(), state:'PUSHED', mode, planDigest:plan.planDigest, sourceDigest:plan.source.digest,
          commitSha, committed, changedFiles:plan.changes.length, advisoryRemovals:plan.advisoryRemovals, branch:config.targetBranch,
          remoteName:config.remoteName, actor:String(request.actor || 'local-user').slice(0,120), pushOutputSha256:U.sha256(pushOutput),
          prCandidate, credentialsStoredByAxm:false, pullRequestCreated:false, githubMerge:false, canonAuthority:false
        };
        U.appendJsonl(auditFile, receipt);
        return receipt;
      } catch (error) {
        const commitWasCreated = committed;
        const rollback = { attempted:commitWasCreated, restored:false, error:null };
        if (commitWasCreated) {
          try {
            gitRun(git, config.repositoryRoot, ['reset','--mixed',plan.repository.head]);
            restorePreCommit(config.repositoryRoot, backupRoot, backupManifest);
            const remaining = pathListFromNul(gitRun(git, config.repositoryRoot, ['status','--porcelain=v1','-z']));
            const restoredHead = gitRun(git, config.repositoryRoot, ['rev-parse','HEAD']);
            if (remaining.length || restoredHead !== plan.repository.head) throw new Error('pre-push Git state was not restored cleanly');
            rollback.restored = true;
            committed = false;
            backupManifest.length = 0;
          } catch (rollbackError) {
            rollback.error = String(rollbackError.message || rollbackError).slice(0,1000);
          }
        }
        const receipt = {
          schema:RECEIPT_SCHEMA, runId, at:U.now(), state:rollback.restored ? 'PUSH_FAILED_ROLLED_BACK' : commitWasCreated ? 'COMMITTED_NOT_PUSHED' : 'PUSH_FAILED', mode, planDigest:plan.planDigest,
          sourceDigest:plan.source.digest, commitSha, committed:commitWasCreated, localHeadRestored:rollback.restored, rollback, changedFiles:plan.changes.length, branch:config.targetBranch,
          remoteName:config.remoteName, actor:String(request.actor || 'local-user').slice(0,120), error:String(error.message || error).slice(0,1000),
          credentialsStoredByAxm:false, pullRequestCreated:false, githubMerge:false, canonAuthority:false
        };
        U.appendJsonl(auditFile, receipt);
        const wrapped = new Error(receipt.state + ': ' + receipt.error); wrapped.receipt = receipt; throw wrapped;
      }
    } catch (error) {
      if (!committed && backupManifest.length) restorePreCommit(config.repositoryRoot, backupRoot, backupManifest);
      throw error;
    } finally {
      if (fs.existsSync(backupRoot)) fs.rmSync(backupRoot, { recursive:true, force:true });
      releaseLock(lock);
    }
  }

  function executeManual(request) { return execute('MANUAL_REVIEWED_PUSH', request); }
  function executeAuthorized() { throw new Error('unattended push is reserved until the future verifier gate is approved'); }

  return { status:() => publicStatus(readConfig()), configure, buildPlan, buildPlanSummary, buildExactPlan, verifyPlan, executeManual, executeAuthorized, readConfig, configFile, auditFile, candidateFile, gitExecutable:git };
}

module.exports = { CONFIG_SCHEMA, PLAN_SCHEMA, PLAN_SUMMARY_SCHEMA, RECEIPT_SCHEMA, VERIFICATION_SCHEMA, PR_CANDIDATE_SCHEMA, CONFIG_CONFIRMATION, MANUAL_PUSH_CONFIRMATION, POLICY_VERSION, create, resolveGit, isGitHubRemote, cleanBranch };
