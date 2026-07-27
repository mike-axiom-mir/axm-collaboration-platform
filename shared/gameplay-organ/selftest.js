'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const GameplayOrgans = require('./gameplay-organ');
const Adapter = require('./candidate-adapter');
const CandidateExamples = require('../game-organism/examples');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validOrgan() {
  return GameplayOrgans.sealOrgan({
    id: 'axm.gameplay.zone.anchor-rotation-stub',
    version: '0.1.0',
    family: 'zone',
    title: 'Anchor rotation stub',
    description: 'Headless-only stub that announces and then rotates the active Grow-Control anchors.',
    interface: {
      inputs: [
        { id: 'match.tick', type: 'game.match-tick/v1' },
        { id: 'active.anchors', type: 'game.active-anchor-set/v1' }
      ],
      outputs: [
        { id: 'next.anchors', type: 'game.active-anchor-set/v1' }
      ]
    },
    owned_state: [
      { id: 'activation.count', type: 'integer', initial: 0 }
    ],
    authority: {
      truth_owner: 'authoritative-server',
      client_scope: 'intent-and-presentation-only',
      grants_from_planning: false
    },
    activation: {
      causes: ['match-tick-threshold'],
      telegraph: {
        receipt_type: 'organ.telegraph',
        minimum_lead_ticks: 1,
        matching_key: 'activation_id'
      },
      effect: {
        receipt_type: 'organ.effect',
        matching_key: 'activation_id'
      }
    },
    determinism: {
      pure: true,
      seed_inputs: ['match-seed', 'activation-count'],
      forbidden_sources: ['wall-clock', 'system-random', 'network']
    },
    bounds: {
      spatial: { kind: 'anchor-set', ids: ['anchor-a', 'anchor-b', 'anchor-c'] },
      time: { max_active_ticks: 1, cooldown_ticks: 2 },
      resources: { max_activations: 1, max_receipts_per_activation: 2 }
    },
    conflicts: {
      precedence: 10,
      exclusive_with: [],
      on_conflict: 'refuse'
    },
    refusals: GameplayOrgans.REQUIRED_REFUSALS,
    receipts: {
      append_only: true,
      types: GameplayOrgans.REQUIRED_RECEIPTS,
      replay_inputs: GameplayOrgans.REQUIRED_REPLAY_INPUTS
    },
    failure: {
      mode: 'disable-and-receipt',
      state_recovery: 'restore-last-authoritative-state'
    },
    migration: {
      automatic: false,
      requires_exact_version: true,
      human_review_required: true
    },
    verification: {
      automatic_checks: [
        'schema-validation',
        'telegraph-precedes-effect',
        'same-seed-same-digest'
      ],
      human_judgments: ['readability', 'fun'],
      assurance_ceiling: 'headless-contract-only'
    },
    implementation: {
      kind: 'stub',
      reference: 'projects/game-org-001/stub-organ.js',
      status: 'EXPERIMENTAL'
    }
  });
}

const runtime = validOrgan();
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'gameplay-organ.schema.json'), 'utf8'));
assert.equal(schema.$id, GameplayOrgans.ORGAN_SCHEMA);
assert.equal(GameplayOrgans.validateOrgan(runtime).pass, true, GameplayOrgans.validateOrgan(runtime).errors.join('; '));

const candidate = CandidateExamples.createStreetLifeExample().organs[0];
assert.equal(GameplayOrgans.validateOrgan(candidate).pass, false, 'planning organ must not validate as runtime gameplay organ');

const clientAuthority = clone(runtime);
clientAuthority.authority.truth_owner = 'client';
clientAuthority.digest = GameplayOrgans.digest(clientAuthority);
assert.equal(GameplayOrgans.validateOrgan(clientAuthority).pass, false);
assert.ok(GameplayOrgans.validateOrgan(clientAuthority).errors.includes('authoritative server must own gameplay truth'));

const planningGrant = clone(runtime);
planningGrant.authority.grants_from_planning = true;
planningGrant.digest = GameplayOrgans.digest(planningGrant);
assert.equal(GameplayOrgans.validateOrgan(planningGrant).pass, false);
assert.ok(GameplayOrgans.validateOrgan(planningGrant).errors.includes('planning organs must never grant runtime authority'));

const noTelegraphLead = clone(runtime);
noTelegraphLead.activation.telegraph.minimum_lead_ticks = 0;
noTelegraphLead.digest = GameplayOrgans.digest(noTelegraphLead);
assert.equal(GameplayOrgans.validateOrgan(noTelegraphLead).pass, false);

const unseeded = clone(runtime);
unseeded.determinism.pure = false;
unseeded.determinism.seed_inputs = [];
unseeded.digest = GameplayOrgans.digest(unseeded);
assert.equal(GameplayOrgans.validateOrgan(unseeded).pass, false);

const draft = Adapter.adaptCandidateToDraft(candidate, {
  family: 'zone',
  runtime_id: 'axm.gameplay.zone.intent-derived-draft',
  authority: { truth_owner: 'authoritative-server' }
});
assert.equal(draft.verdict, 'DRAFT_ONLY');
assert.equal(draft.authority.state, 'UNGRANTED');
assert.equal(draft.authority.gameplay_truth, false);
assert.equal(draft.next_gate.adapter_can_promote, false);
assert.equal(Object.isFrozen(draft.authority), true, 'adapter authority metadata must be recursively immutable');
assert.equal(Adapter.validateDraft(draft).pass, true);
assert.equal(GameplayOrgans.validateOrgan(draft).pass, false, 'adapter draft must never validate as an executable runtime organ');

const invalidCandidate = clone(candidate);
invalidCandidate.authority.canonical_writes = true;
invalidCandidate.digest = '0'.repeat(64);
const refused = Adapter.adaptCandidateToDraft(invalidCandidate, { family: 'zone' });
assert.equal(refused.verdict, 'REFUSED');
assert.equal(refused.code, 'INVALID_CANDIDATE_ORGAN');

console.log('gameplay-organ selftest: PASS · separate runtime contract · fail-closed authority · adapter draft only');

module.exports = { validOrgan };
