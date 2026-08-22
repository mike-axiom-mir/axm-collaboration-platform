#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const ContractVerifier = require('../../hub/module-contract-verifier');
const PermissionService = require('../../shared/operations/permission-service');
const ReviewService = require('../../shared/operations/review-service');
const SecretsService = require('../../shared/operations/secrets-service');
const PublicReleaseService = require('../../shared/operations/public-release-service');

const moduleRoot = __dirname;
const workshopRoot = path.resolve(moduleRoot, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(moduleRoot, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(moduleRoot, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(moduleRoot, 'app.js'), 'utf8');
const operationsApiSource = fs.readFileSync(path.join(workshopRoot, 'shared', 'operations', 'operations-api.js'), 'utf8');

let evidenceGroups = 0;
function check(message, test) {
  test();
  evidenceGroups += 1;
}
async function rejects(message, promise, pattern) {
  await assert.rejects(promise, pattern, message);
  evidenceGroups += 1;
}
const settle = () => new Promise(resolve => setImmediate(resolve));

async function verifyClient() {
  const elementIds = ['notice', 'source', 'title', 'version', 'stage', 'releaseId', 'digest', 'channel', 'deploy', 'refresh', 'facts', 'out'];
  const elements = Object.fromEntries(elementIds.map(id => [id, {
    id,
    value: ({ source: 'release-note.txt', title: 'Reviewed release', version: '1.2.3', channel: 'local-preview' })[id] || '',
    innerHTML: '',
    textContent: '',
    onclick: null
  }]));
  const requests = [];
  const notices = [];
  const state = {
    channels: [
      { id: 'local-preview', name: 'Local signed preview', kind: 'local-folder', enabled: true },
      { id: 'disabled-channel', name: 'Disabled channel', kind: 'https-put', enabled: false }
    ],
    releases: [{ id: 'release-existing' }],
    deployments: Array.from({ length: 25 }, (_, index) => ({ id: `deployment-${index}` })),
    signing: { configured: false, algorithm: 'Ed25519', privateKeyExposed: false },
    automaticDeploy: false,
    automaticUpdates: false
  };
  const AXMOps = {
    get(route) {
      requests.push({ method: 'GET', route });
      return Promise.resolve(state);
    },
    post(route, body, headers) {
      requests.push({ method: 'POST', route, body, headers });
      if (route === '/api/public-release/stage') {
        return Promise.resolve({ id: 'release-new', artifactDigest: 'a'.repeat(64) });
      }
      return Promise.resolve({ deployment: { destination: 'exports/public-deployments/local-preview/release-new' } });
    },
    esc(value) {
      return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    },
    pretty(value) { return JSON.stringify(value, null, 2); },
    notice(element, message, tone) { notices.push({ element: element.id, message, tone }); }
  };
  const context = vm.createContext({
    AXMOps,
    document: { getElementById(id) { return elements[id]; } },
    Promise,
    Array
  });

  new vm.Script(source, { filename: 'app.js' }).runInContext(context);
  await settle();

  check('client initially reads and renders release status', () => {
    assert.deepEqual(requests[0], { method: 'GET', route: '/api/public-release' });
    assert(elements.facts.innerHTML.includes('1 candidates'));
    assert(elements.facts.innerHTML.includes('25 deployments'));
    assert(elements.facts.innerHTML.includes('auto deploy false'));
    assert(elements.facts.innerHTML.includes('auto update false'));
  });
  check('client exposes only enabled channels and bounds rendered history', () => {
    assert(elements.channel.innerHTML.includes('local-preview'));
    assert(!elements.channel.innerHTML.includes('disabled-channel'));
    assert.equal(JSON.parse(elements.out.textContent).deployments.length, 20);
  });
  check('all explicit controls are wired', () => {
    assert.equal(typeof elements.stage.onclick, 'function');
    assert.equal(typeof elements.deploy.onclick, 'function');
    assert.equal(typeof elements.refresh.onclick, 'function');
  });

  elements.stage.onclick();
  await settle();
  await settle();
  const stageRequest = requests.find(request => request.route === '/api/public-release/stage');
  check('client stages the exact form values with an explicit-stage header', () => {
    assert.deepEqual(stageRequest, {
      method: 'POST',
      route: '/api/public-release/stage',
      body: { source: 'release-note.txt', title: 'Reviewed release', version: '1.2.3' },
      headers: { 'x-axm-release': 'explicit-stage' }
    });
    assert.equal(elements.releaseId.value, 'release-new');
    assert.equal(elements.digest.value, 'a'.repeat(64));
    assert(notices.some(item => item.message.includes('two-seat digest review') && item.tone === 'ok'));
  });

  elements.deploy.onclick();
  await settle();
  await settle();
  const deployRequest = requests.find(request => request.route === '/api/public-release/deploy');
  check('client deployment binds exact release, digest, channel, confirmation, and header', () => {
    assert.deepEqual(deployRequest, {
      method: 'POST',
      route: '/api/public-release/deploy',
      body: {
        releaseId: 'release-new',
        artifactDigest: 'a'.repeat(64),
        channelId: 'local-preview',
        confirmation: 'DEPLOY APPROVED RELEASE'
      },
      headers: { 'x-axm-release': 'deploy-approved-digest' }
    });
    assert(notices.some(item => item.message.includes('exports/public-deployments/local-preview/release-new') && item.tone === 'ok'));
  });

  const getCount = requests.filter(request => request.method === 'GET').length;
  elements.refresh.onclick();
  await settle();
  check('manual refresh is read only', () => {
    assert.equal(requests.filter(request => request.method === 'GET').length, getCount + 1);
  });
}

async function verifyReleaseService() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-public-release-adapter-'));
  try {
    const root = path.join(temporary, 'workshop');
    const stateRoot = path.join(root, 'state');
    const exportRoot = path.join(root, 'exports');
    fs.mkdirSync(exportRoot, { recursive: true });
    const toolRoot = path.join(root, 'tools', manifest.id);
    fs.mkdirSync(toolRoot, { recursive: true });
    fs.writeFileSync(path.join(toolRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
    const payload = 'reviewed public release fixture\n';
    fs.writeFileSync(path.join(exportRoot, 'release-note.txt'), payload);

    const permissions = PermissionService.create({ root, stateRoot });
    check('release.deploy is default-denied for the declared module permission', () => {
      const decision = permissions.decision(manifest.id, 'release.deploy');
      assert.equal(decision.declared, true);
      assert.equal(decision.state, 'UNDECIDED');
      assert.equal(decision.effective, false);
    });
    check('an explicit temporary grant enables only the declared module permission', () => {
      const grant = permissions.setGrant({ moduleId: manifest.id, permission: 'release.deploy', allowed: true, reason: 'selftest allowed decision', actor: 'Selftest Gate' });
      assert.equal(grant.state, 'ALLOWED');
      assert.equal(permissions.allowed(manifest.id, 'release.deploy'), true);
      assert.throws(() => permissions.setGrant({ moduleId: manifest.id, permission: 'release.undeclared', allowed: true, reason: 'must refuse', actor: 'Selftest Gate' }), /not declared/);
    });
    check('a later explicit deny revokes the temporary module permission', () => {
      const denial = permissions.setGrant({ moduleId: manifest.id, permission: 'release.deploy', allowed: false, reason: 'selftest denied decision', actor: 'Selftest Gate' });
      assert.equal(denial.state, 'DENIED');
      assert.equal(permissions.allowed(manifest.id, 'release.deploy'), false);
    });

    const reviews = ReviewService.create({ stateRoot });
    const secrets = SecretsService.create({ stateRoot, unlockTtlMs: 60000 });
    secrets.initialize('public release selftest passphrase', 'selftest');
    const releases = PublicReleaseService.create({ root, stateRoot, exportRoot, reviewService: reviews, secretsService: secrets });

    check('service starts manual with no browser-exposed private key', () => {
      const status = releases.status();
      assert.equal(status.reviewRequired, true);
      assert.equal(status.automaticDeploy, false);
      assert.equal(status.automaticUpdates, false);
      assert.equal(status.signing.privateKeyExposed, false);
    });
    check('service refuses unsupported and non-public channel protocols', () => {
      assert.throws(() => releases.configure({ id: 'ftp', kind: 'ftp' }, 'selftest'), /unsupported/);
      assert.throws(() => releases.configure({ id: 'http', kind: 'https-put', baseUrl: 'http://example.com', tokenSecretId: 'token' }, 'selftest'), /credential-free HTTPS/);
      assert.throws(() => releases.configure({ id: 'private', kind: 'https-put', baseUrl: 'https://127.0.0.1', tokenSecretId: 'token' }, 'selftest'), /loopback or private/);
    });

    const candidate = releases.stage({ source: 'release-note.txt', title: 'Selftest release', version: '1.2.3' }, 'selftest');
    const request = { releaseId: candidate.id, artifactDigest: candidate.artifactDigest, channelId: 'local-preview', confirmation: 'DEPLOY APPROVED RELEASE' };
    check('staging creates an immutable-digest review candidate without deployment', () => {
      assert.equal(candidate.schema, 'axm.release-candidate/v1');
      assert.equal(candidate.automaticDeploy, false);
      assert.equal(candidate.state, 'STAGED');
      assert.equal(candidate.artifactDigest.length, 64);
      assert.equal(releases.status().deployments.length, 0);
    });
    await rejects('exact deployment confirmation is mandatory', releases.deploy({ ...request, confirmation: 'DEPLOY' }, 'selftest'), /exact release deployment confirmation/);
    await rejects('digest drift at request time is refused', releases.deploy({ ...request, artifactDigest: '0'.repeat(64) }, 'selftest'), /digest confirmation does not match/);
    await rejects('an unapproved digest cannot deploy', releases.deploy(request, 'selftest'), /not approved/);

    reviews.vote(candidate.reviewId, { actor: 'Mike', verdict: 'APPROVE', artifactDigest: candidate.artifactDigest });
    await rejects('one review seat is insufficient', releases.deploy(request, 'selftest'), /not approved/);
    reviews.vote(candidate.reviewId, { actor: 'Mirror', verdict: 'APPROVE', artifactDigest: candidate.artifactDigest });

    const stagedFile = path.join(root, candidate.stagedPath, 'release-note.txt');
    fs.appendFileSync(stagedFile, 'digest drift\n');
    await rejects('post-review staged-file drift is refused', releases.deploy(request, 'selftest'), /changed after review/);
    fs.writeFileSync(stagedFile, payload);

    const deployed = await releases.deploy(request, 'selftest');
    const { signature, signatureAlgorithm, publicKey, ...unsignedManifest } = deployed.manifest;
    check('approved local deployment creates a verifiable Ed25519 manifest', () => {
      assert.equal(signatureAlgorithm, 'Ed25519');
      assert(crypto.verify(null, Buffer.from(JSON.stringify(unsignedManifest)), publicKey, Buffer.from(signature, 'base64')));
      assert.equal(unsignedManifest.automaticUpdate, false);
      assert.equal(unsignedManifest.updatePolicy, 'manual-explicit');
    });
    check('deployment writes an exact-digest receipt and signed local manifest', () => {
      assert.equal(deployed.deployment.schema, 'axm.public-deployment-receipt/v1');
      assert.equal(deployed.deployment.artifactDigest, candidate.artifactDigest);
      assert.equal(deployed.deployment.automatic, false);
      assert(fs.existsSync(path.join(root, deployed.deployment.destination, 'release-manifest.json')));
    });
    check('service status exposes only public signing metadata after deployment', () => {
      const status = releases.status();
      assert.equal(status.signing.configured, true);
      assert.equal(status.signing.privateKeyExposed, false);
      assert.equal(typeof status.signing.fingerprint, 'string');
      assert.equal(status.automaticUpdates, false);
    });
    const firstFingerprint = releases.status().signing.fingerprint;
    const reopenedReleases = PublicReleaseService.create({ root, stateRoot, exportRoot, reviewService: reviews, secretsService: secrets });
    check('a fresh service instance reopens the persisted signing identity', () => {
      assert.equal(reopenedReleases.status().signing.fingerprint, firstFingerprint);
    });
    fs.writeFileSync(path.join(exportRoot, 'second-release.txt'), 'second reviewed release fixture\n');
    const secondCandidate = reopenedReleases.stage({ source: 'second-release.txt', title: 'Second selftest release', version: '1.2.4' }, 'selftest');
    reviews.vote(secondCandidate.reviewId, { actor: 'Mike', verdict: 'APPROVE', artifactDigest: secondCandidate.artifactDigest });
    reviews.vote(secondCandidate.reviewId, { actor: 'Mirror', verdict: 'APPROVE', artifactDigest: secondCandidate.artifactDigest });
    await reopenedReleases.deploy({
      releaseId: secondCandidate.id,
      artifactDigest: secondCandidate.artifactDigest,
      channelId: 'local-preview',
      confirmation: 'DEPLOY APPROVED RELEASE'
    }, 'selftest');
    check('later deployments reuse the persisted signing identity', () => {
      assert.equal(reopenedReleases.status().signing.fingerprint, firstFingerprint);
    });
    secrets.upsert({ id: 'selftest-release-token', label: 'Selftest release endpoint token', scopes: [manifest.id], value: 'temporary-selftest-token', actor: 'selftest' });
    const remoteChannel = reopenedReleases.configure({ id: 'https-preview', name: 'Captured HTTPS preview', kind: 'https-put', baseUrl: 'https://releases.example.com/axm', tokenSecretId: 'selftest-release-token' }, 'selftest');
    check('explicit HTTPS configuration keeps a public credential-free destination', () => {
      assert.equal(remoteChannel.kind, 'https-put');
      assert.equal(remoteChannel.baseUrl, 'https://releases.example.com/axm');
      assert.equal(remoteChannel.automaticUpdates, false);
      assert(!remoteChannel.baseUrl.includes('temporary-selftest-token'));
    });
    const originalFetch = global.fetch;
    let capturedHttpsRequest = null;
    let remoteDeployment;
    try {
      global.fetch = async (url, options) => {
        capturedHttpsRequest = { url, options, body: JSON.parse(options.body) };
        return { ok: true, status: 200 };
      };
      remoteDeployment = await reopenedReleases.deploy({
        releaseId: secondCandidate.id,
        artifactDigest: secondCandidate.artifactDigest,
        channelId: remoteChannel.id,
        confirmation: 'DEPLOY APPROVED RELEASE'
      }, 'selftest');
    } finally {
      global.fetch = originalFetch;
    }
    check('captured HTTPS PUT binds digest, bearer secret, signed payload and receiver acknowledgement', () => {
      assert.equal(capturedHttpsRequest.url, `https://releases.example.com/axm/releases/${secondCandidate.id}`);
      assert.equal(capturedHttpsRequest.options.method, 'PUT');
      assert.equal(capturedHttpsRequest.options.redirect, 'error');
      assert.equal(capturedHttpsRequest.options.headers.authorization, 'Bearer temporary-selftest-token');
      assert.equal(capturedHttpsRequest.options.headers['x-axm-release-digest'], secondCandidate.artifactDigest);
      assert.equal(capturedHttpsRequest.body.manifest.releaseId, secondCandidate.id);
      assert.equal(capturedHttpsRequest.body.manifest.artifactDigest, secondCandidate.artifactDigest);
      assert.equal(capturedHttpsRequest.body.files.length, 1);
      assert.equal(remoteDeployment.deployment.schema, 'axm.public-deployment-receipt/v1');
      assert.equal(remoteDeployment.deployment.destination, `https://releases.example.com/axm/releases/${secondCandidate.id}`);
      assert.equal(remoteDeployment.deployment.automatic, false);
    });
    check('rollback requires exact confirmation and a local channel', () => {
      assert.throws(() => reopenedReleases.rollback({ channelId: 'local-preview', releaseId: candidate.id, confirmation: 'ROLL BACK' }, 'selftest'), /exact release rollback confirmation/);
      assert.throws(() => reopenedReleases.rollback({ channelId: remoteChannel.id, releaseId: candidate.id, confirmation: 'ROLL BACK RELEASE CHANNEL' }, 'selftest'), /local release channel not found/);
    });
    const rollback = reopenedReleases.rollback({ channelId: 'local-preview', releaseId: candidate.id, confirmation: 'ROLL BACK RELEASE CHANNEL' }, 'selftest');
    check('explicit local rollback selects a previously signed release without deleting files', () => {
      assert.equal(rollback.releaseId, candidate.id);
      assert.equal(rollback.artifactDigest, candidate.artifactDigest);
      assert.equal(rollback.filesDeleted, false);
      const channel = reopenedReleases.status().channels.find(item => item.id === 'local-preview');
      assert.equal(channel.currentReleaseId, candidate.id);
      assert.equal(channel.currentDigest, candidate.artifactDigest);
    });
    const afterRollbackRestart = PublicReleaseService.create({ root, stateRoot, exportRoot, reviewService: reviews, secretsService: secrets });
    check('fresh service state preserves the explicit rollback selection', () => {
      const channel = afterRollbackRestart.status().channels.find(item => item.id === 'local-preview');
      assert.equal(channel.currentReleaseId, candidate.id);
      assert.equal(channel.currentDigest, candidate.artifactDigest);
      assert.equal(afterRollbackRestart.status().signing.fingerprint, firstFingerprint);
    });
  } finally {
    const resolved = path.resolve(temporary);
    const allowedPrefix = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(allowedPrefix) || !path.basename(resolved).startsWith('axm-public-release-adapter-')) {
      throw new Error('temporary cleanup boundary refused');
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

async function main() {
  check('manifest identity and high-risk status are explicit', () => {
    assert.equal(manifest.schema, 'axm.tool-manifest/v1');
    assert.equal(manifest.kind, 'product');
    assert.equal(manifest.id, 'public-release-deployment-adapter');
    assert.equal(manifest.status, 'TEST');
    assert.equal(manifest.risk, 'HIGH');
    assert.equal(manifest.entry, 'index.html');
    assert.equal(manifest.contract, 'module.contract.json');
  });
  check('contract validates against the manifest', () => {
    assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
  });
  check('identity, version, permission, and handoffs align', () => {
    assert.equal(contract.id, manifest.id);
    assert.equal(contract.version, manifest.version);
    assert.deepEqual(contract.permissions, manifest.permissions);
    assert.deepEqual(contract.handoffs.accepts, manifest.accepts);
    assert.deepEqual(contract.handoffs.emits, manifest.produces);
  });
  check('contract preserves all declared release refusals', () => {
    for (const refusal of ['undeclared-or-denied-release-deploy-permission', 'missing-explicit-release-action', 'unreviewed-deploy', 'digest-drift', 'disabled-channel', 'project-source-outside-exports', 'non-https-remote-channel', 'loopback-or-private-remote-channel', 'redirected-https-deploy', 'oversized-https-release', 'remote-channel-rollback', 'automatic-deploy', 'automatic-update', 'private-key-browser-exposure', 'arbitrary-protocol']) {
      assert(contract.boundaries.refuses.includes(refusal), `missing refusal: ${refusal}`);
    }
  });
  check('browser surface uses local assets and retains the human review boundary', () => {
    for (const id of ['notice', 'source', 'title', 'version', 'stage', 'releaseId', 'digest', 'channel', 'deploy', 'refresh', 'facts', 'out']) {
      assert(html.includes(`id="${id}"`), `missing browser control: ${id}`);
    }
    assert(html.includes('../review-inbox/index.html'));
    assert(html.includes('two-seat digest approval'));
    assert(html.includes('No automatic updates'));
    assert(!/https?:\/\//i.test(html), 'module UI must not load a remote resource');
  });
  check('client source is valid JavaScript with only fixed release routes', () => {
    new vm.Script(source, { filename: 'app.js' });
    const routes = Array.from(source.matchAll(/(?:get|post)\('([^']+)'/g), match => match[1]);
    assert.deepEqual(Array.from(new Set(routes)).sort(), ['/api/public-release', '/api/public-release/deploy', '/api/public-release/stage']);
    assert(!/https?:\/\//i.test(source), 'client source must not contain a remote URL literal');
  });
  check('owning server routes retain explicit and permission guards', () => {
    const deployLine = operationsApiSource.split(/\r?\n/).find(line => line.includes("url === '/api/public-release/deploy'"));
    const rollbackLine = operationsApiSource.split(/\r?\n/).find(line => line.includes("url === '/api/public-release/rollback'"));
    assert(deployLine.includes("explicit(req, 'x-axm-release', 'deploy-approved-digest')"));
    assert(deployLine.includes("requirePermission('public-release-deployment-adapter','release.deploy')"));
    assert(rollbackLine.includes("explicit(req, 'x-axm-release', 'explicit-rollback')"));
    assert(rollbackLine.includes("requirePermission('public-release-deployment-adapter','release.deploy')"));
  });

  await verifyClient();
  await verifyReleaseService();
  console.log(`Public Release & Deployment Adapter selftest: PASS (${evidenceGroups} evidence groups; no external deployment performed)`);
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
