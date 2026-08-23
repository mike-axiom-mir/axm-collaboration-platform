'use strict';

const fs = require('fs');
const path = require('path');
const Codec = require('./canonical');

function modulePath(root, relative) { return path.join(path.resolve(root), relative); }
function available(root, relative) { try { return fs.statSync(modulePath(root, relative)).isFile(); } catch (_) { return false; } }
function load(root, relative) { return require(modulePath(root, relative)); }

function inspect(root) {
  const checks = [
    ['game-organism', 'shared/game-organism/game-organism.js'],
    ['verification-spine', 'shared/verification-spine/verification-spine.js'],
    ['game-forge-candidate-service', 'tools/game-forge/package-service.js'],
    ['game-hub-package-verifier', 'tools/game-hub/game-package-verifier.js'],
    ['godot-live-executor', 'shared/asset-hands/substrate-pack/godot-live-executor.js']
  ].map(([id, relative]) => ({ id, relative, available: available(root, relative) }));
  return { schema: 'axm.game-production-runner-integration-status/v1', status: checks.every((item) => item.available) ? 'AVAILABLE_WITH_RUNTIME_HOLDS' : 'DEGRADED', checks, native_runtime_probed: false, authority_granted: false };
}

function adaptGameOrganismReceipt(receipt) {
  if (!receipt || receipt.schema !== 'axm.game-organism-assembly-receipt/v1') throw new Error('Game Organism assembly receipt required');
  if (receipt.verdict !== 'CANDIDATE_READY' || !receipt.truth || receipt.truth.assemblyPlanCreated !== true || receipt.truth.executionStarted !== false || receipt.truth.automaticPromotion !== false) throw new Error('only non-executing candidate-ready Game Organism receipts may be adapted');
  if (!/^[a-f0-9]{64}$/.test(String(receipt.digest || ''))) throw new Error('Game Organism receipt needs exact digest');
  return Codec.seal({ schema: 'axm.game-production-planning-input/v1', source: 'game-organism', source_receipt_digest: receipt.digest, execution_order: (receipt.execution_order || []).slice(), evidence_plan: (receipt.evidence_plan || []).slice(), human_judgments: (receipt.human_judgments || []).slice(), grants_execution_authority: false });
}

function verificationReceiptValidator(root) {
  const spine = load(root, 'shared/verification-spine/verification-spine.js');
  return (receipt) => {
    const result = spine.validateReceipt(receipt);
    return result.pass ? [] : result.errors;
  };
}

function verifyGameHubCandidate(root, candidateDirectory) {
  const verifier = load(root, 'tools/game-hub/game-package-verifier.js');
  const result = verifier.verifyGameDir(candidateDirectory);
  return { schema: 'axm.game-production-runner-game-hub-check/v1', pass: result.errors.length === 0, errors: result.errors, automatic_install: false };
}

function probeGodot(root, options) {
  options = options || {};
  if (options.explicitReadOnlyProbe !== true) return { status: 'NOT_PROBED', reason: 'read-only native availability probe requires explicit opt-in', execution_authority: false };
  const Godot = load(root, 'shared/asset-hands/substrate-pack/godot-live-executor.js');
  const executor = Godot.createExecutor({ root: options.substrateRoot, visual: false });
  const resolution = executor.resolve();
  return { status: resolution.status, identity: executor.identity, missing: resolution.missing || [], execution_authority: false, installation_performed: false };
}

module.exports = { inspect, adaptGameOrganismReceipt, verificationReceiptValidator, verifyGameHubCandidate, probeGodot };
