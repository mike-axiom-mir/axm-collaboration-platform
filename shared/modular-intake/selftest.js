'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Review = require('../operations/review-service');
const Intake = require('./modular-intake-service');
const Needs = require('./needs-observatory-service');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-modular-intake-'));
const options = { root, stateRoot: path.join(root, 'state') };
fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
let installerBundle = null;
const review = Review.create(options);
const installer = { stage(bundle) { installerBundle = bundle; return { id: 'installer-candidate-1' }; } };
const intake = Intake.create(Object.assign({}, options, { reviewService: review, installerService: installer }));
const needs = Needs.create(Object.assign({}, options, { modularIntakeService: intake }));

function file(name, value) { return { path: name, encoding: 'utf8', content: typeof value === 'string' ? value : JSON.stringify(value) }; }
function pack(family, id, files, provides) {
  return { schema: Intake.PACKAGE_SCHEMA, piece: { id, family, version: '1.0.0', title: id, capabilities: { provides: provides || [], requires: [] }, protocols: [] }, files, requiredSeats: 'dual' };
}
function approve(candidate) {
  review.vote(candidate.reviewId, { artifactDigest: candidate.packageDigest, actor: 'Mike', actorKind: 'human', verdict: 'APPROVE' });
  review.vote(candidate.reviewId, { artifactDigest: candidate.packageDigest, actor: 'Codex', actorKind: 'machine', verdict: 'APPROVE' });
}

try {
  const unknown = intake.stage(pack('future-thing', 'future-piece', [file('future.json', { schema: 'future/v1' })]), 'test');
  assert.equal(unknown.state, 'QUARANTINED_CATEGORY_PROPOSAL');
  assert.equal(unknown.reviewId, null);

  const schemaPackage = pack('schema', 'city-material-schema', [file('schema.json', { schema: 'json-schema-draft', id: 'city-material-schema', type: 'object' })], ['asset.material.import']);
  const inspected = intake.inspect(schemaPackage);
  assert.equal(inspected.pass, true);
  const candidate = intake.stage(schemaPackage, 'test');
  assert.equal(candidate.state, 'QUARANTINED_REVIEW');
  assert.throws(() => intake.promote(candidate.id, { confirmation: 'PROMOTE REVIEWED PIECE' }), /not approved/);
  approve(candidate);
  const promoted = intake.promote(candidate.id, { confirmation: 'PROMOTE REVIEWED PIECE', actor: 'Mike' });
  assert.equal(promoted.state, 'PROMOTED');
  assert.ok(fs.existsSync(path.join(root, promoted.libraryRef, 'schema.json')));
  assert.equal(promoted.backupRequest.state, 'AWAITING_CONFIGURED_TARGET');

  const need = needs.createNeed({ title: 'Need material imports', requiredCapabilities: ['asset.material.import'] }, 'Mike');
  const matched = needs.match(need.id, candidate.id, 'Mike');
  assert.equal(matched.state, 'READY_TO_CLOSE');
  const satisfied = needs.transition(need.id, { state: 'SATISFIED', confirmation: 'ACCEPT BUILT CAPABILITY', actor: 'Mike' });
  assert.equal(satisfied.state, 'SATISFIED');

  const customContract = { schema: 'axm.modular-family-contract/v1', id: 'future-thing', version: '1.0.0', title: 'Future thing', descriptorFile: 'future.json', storagePolicy: 'neutral-library', verificationProfile: 'foundation', executionAuthority: 'none', boundaries: ['no-auto-execution'] };
  const proposal = intake.proposeFamily(customContract, 'Mike');
  review.vote(proposal.reviewId, { artifactDigest: proposal.contractDigest, actor: 'Mike', verdict: 'APPROVE' });
  review.vote(proposal.reviewId, { artifactDigest: proposal.contractDigest, actor: 'Codex', verdict: 'APPROVE' });
  intake.applyFamily(proposal.id, { confirmation: 'REGISTER REVIEWED FAMILY', actor: 'Mike' });
  const reopened = intake.openReview(unknown.id, 'Mike');
  assert.equal(reopened.state, 'QUARANTINED_REVIEW');

  const modulePackage = pack('module', 'small-module', [file('manifest.json', { id: 'small-module', name: 'Small', version: 'v1', contract: 'module.contract.json' }), file('module.contract.json', { schema: 'axm.module-contract/v1', id: 'small-module', version: 'v1' })], ['small.module']);
  const moduleCandidate = intake.stage(modulePackage, 'test'); approve(moduleCandidate);
  const routed = intake.promote(moduleCandidate.id, { confirmation: 'PROMOTE REVIEWED PIECE', actor: 'Mike' });
  assert.equal(routed.state, 'ROUTED_TO_MODULE_INSTALLER');
  assert.equal(installerBundle.schema, 'axm.module-bundle/v1');

  const status = intake.status();
  assert.equal(status.boundaries.autoExecute, false);
  assert.ok(status.candidates.every(item => !Object.prototype.hasOwnProperty.call(item, 'package')));
  assert.ok(needs.status().derived.some(item => item.id === 'external-component-backup'));
  console.log('modular intake and needs observatory self-test passed');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
