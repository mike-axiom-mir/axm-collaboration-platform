'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Discovery = require('./discovery-core');

const ROOT = path.resolve(__dirname, '..', '..');
const CONTROLS = path.join(ROOT, 'shared', 'controls');
const BASE = Date.parse('2026-07-18T02:30:00.000Z');

function meta(id, offset) {
  return {
    actorId: 'axiom-mir',
    actorKind: 'MACHINE',
    provider: 'codex-local-workshop',
    model: 'gpt-5',
    now: new Date(BASE + offset * 1000).toISOString(),
    recordId: id,
    eventId: `event-${id}`,
  };
}

function record(state, stage, id, text, rationale, offset) {
  const result = Discovery.recordDiscovery(state, stage, {
    text,
    claimLabel: 'OBSERVED',
    source: 'AXM Shared Controls source, schemas, route contract and executable local tests',
    rationale,
    status: 'INTERNAL_MACHINE_REVIEW',
  }, meta(id, offset));
  if (!result.ok) throw new Error(result.errors[0].message);
  return result.state;
}

function candidate(state, id, data, offset) {
  const result = Discovery.createCandidate(state, data, meta(id, offset));
  if (!result.ok) throw new Error(result.errors[0].message);
  return result.state;
}

function read(relative) {
  return fs.readFileSync(path.join(CONTROLS, relative), 'utf8');
}

function run() {
  const route = JSON.parse(read('PHYSICAL_CONTROLLER_ROUTE.json'));
  const packetSchema = JSON.parse(read('schemas/input-packet.schema.json'));
  const runtime = read('src/browser/axm-controller-runtime.mjs');
  const gate = read('src/host/seat-input-gate.js');
  const gateTests = read('tests/input-gate.test.js');
  const runtimeTests = read('tests/controller-runtime.test.js');

  let state = Discovery.createSession({
    id: 'shared-physical-controller-route-discovery',
    title: 'AXM Shared Physical Controller Adapter seam review',
    subject: 'Dormant USB and Bluetooth gamepad route for AXM Shared Controls',
    question: 'What missing boundary would make a later physical-controller adapter unsafe, ambiguous, incompatible, or falsely claimed?',
    intendedUse: 'Phone-first local Game Hub play with optional Steam-like personal controllers through the same semantic host gate',
    boundaries: [
      'do not implement or claim hardware support without a physical controller',
      'controller identity and input hardware remain separate',
      'host remains authoritative',
      'party screen remains input-free',
      'no automatic AI substitution',
    ],
    exclusions: ['raw device identity as player identity', 'silent seat claiming', 'WebHID as baseline', 'game-specific hardware forks'],
    stakes: 'MEDIUM',
    evidenceProfile: 'SOFTWARE',
    discoveryMode: 'MANUAL',
  }, meta('controller-route-session', 0));

  const findings = [
    ['knownSpace', 'pc-known-runtime', 'AxmControllerRuntime already accepts abstract vectors, held buttons and pulses, so hardware polling can remain a replaceable source adapter.', 'Reuse the proven semantic transport instead of adding a second gameplay protocol.'],
    ['knownSpace', 'pc-known-authority', 'The human, adapter and Host AI controller kinds describe authority; they do not describe USB, Bluetooth, phone or keyboard hardware.', 'A gamepad must not become a fourth controller kind.'],
    ['blindSpots', 'pc-seam-concurrent-hands', 'A seat token and sequence alone cannot distinguish an old phone from a newly claimed gamepad when both legitimately know the same seat token.', 'Mixed input needs one exclusive versioned source binding per human seat.'],
    ['blindSpots', 'pc-seam-local-reset', 'Clearing local vectors without transmitting a neutral packet can leave the authoritative host acting on the last non-zero input until its idle timeout.', 'Disconnect neutralization must flush through the ordinary semantic gate immediately.'],
    ['seams', 'pc-seam-identity-privacy', 'Browser gamepad identifiers may contain vendor or product details and are neither stable nor unique player identity.', 'Use an opaque session-local binding id; never persist or expose the raw device id.'],
    ['seams', 'pc-seam-claim-collision', 'Unconditionally treating any observed button as a claim can bind a controller because of a held button, accidental input, or activity outside a visible claim flow.', 'Arm a visible claim window, require a new press edge, and confirm replacement of an active source.'],
    ['seams', 'pc-seam-nonstandard-map', 'A device without the standard browser mapping cannot safely inherit Xbox-like axis and button indices.', 'Pause for explicit mapping and calibration instead of guessing.'],
    ['seams', 'pc-seam-authority-selector', 'Listing Connected AI inside a human hardware selector would hide an authority transition inside an input-source choice.', 'Human-to-adapter remains a separate explicit-consent operation.'],
    ['rejectedDirections', 'pc-reject-party-poll', 'Do not poll gamepads from the shared party or spectator display.', 'Display-only surfaces must never gain player-input authority.'],
    ['rejectedDirections', 'pc-reject-auto-ai', 'Do not replace a disconnected human controller with Host AI.', 'The seat and progression belong to the human identity and remain available for reconnection or phone fallback.'],
    ['patterns', 'pc-pattern-lease', 'An opaque binding id plus monotonically increasing source epoch lets the host reject delayed packets from a previous hand while preserving the seat token.', 'This is the smallest backward-compatible authority repair.'],
    ['minimalChecks', 'pc-checks', 'Require old-source rejection after a switch, sequence restart only under a new epoch, immediate neutral transmission, raw-id non-persistence, explicit claim flow, and unchanged human seat identity.', 'These controls disconfirm the highest-impact seams without requiring fake hardware evidence.'],
  ];
  findings.forEach((item, index) => {
    state = record(state, item[0], item[1], item[2], item[3], 10 + index);
  });

  state = candidate(state, 'candidate-exclusive-input-source-lease', {
    term: 'Exclusive Input Source Lease',
    summary: 'Bind exactly one phone, keyboard or gamepad hand to a human seat through an opaque session-local id and monotonic epoch.',
    mechanism: 'Neutralize and revoke the old source, increment the epoch, start a fresh packet sequence, and reject every packet whose binding id or epoch no longer matches the active human seat.',
    whyNotYet: 'The phone-only reference had no need to distinguish two valid hands sharing one seat token.',
    viableNowBecause: 'The semantic packet, runtime identity and host gate are all versioned, local and backward-compatible with optional binding fields.',
    dependencies: ['AxmControllerRuntime', 'seat token gate', 'semantic input packet', 'visible Controller Dock'],
    noveltyStatus: 'UNCHECKED',
    soulGate: {
      genuineNeed: 'PASS', nonCommercialWorth: 'PASS', reducesPain: 'PASS', sameGateAccess: 'PASS', avoidsLockIn: 'PASS',
      notes: ['The lease protects player choice while remaining hardware- and vendor-neutral.'],
    },
    minimalForm: 'Optional packet binding id/epoch, host-side bind/revoke helpers, immediate neutral flush, and executable contract tests.',
    cheapestDisconfirmingCheck: 'Bind phone epoch 0, accept it, bind gamepad epoch 1, prove the old phone fails even at a high sequence, prove gamepad sequence 0 succeeds, then revoke and prove neutral state.',
    disconfirmingOutcome: 'Any previous source remains accepted, the seat changes away from human, neutral input is not sent, or legacy unbound sessions stop working.',
    limitations: ['No gamepad polling implementation', 'No physical hardware evidence', 'Target games must opt into binding enforcement when switching sources'],
    supersedes: null,
  }, 40);

  const properties = packetSchema.properties || {};
  const controls = {
    seatKindsUnchanged: JSON.stringify(route.controllerKindsRemain) === JSON.stringify(['human', 'adapter', 'ai']),
    exclusiveLeaseDeclared: route.sourceLease?.exactlyOneActivePerHumanSeat === true,
    rawIdNotPersisted: route.sourceLease?.rawGamepadIdPersisted === false,
    explicitClaimWindow: route.assignment?.explicitClaimWindowRequired === true,
    nonStandardMappingHeld: route.mapping?.nonStandardRequiresExplicitCalibration === true,
    aiAuthoritySeparate: route.authorityTransitions?.connectedAiIsHumanInputSource === false,
    packetBindingFields: !!properties.inputSourceBindingId && !!properties.inputSourceEpoch,
    hostRejectsOldBinding: gate.includes('input-source-binding-rejected') && gate.includes('bindHumanInputSource'),
    immediateNeutralFlush: runtime.includes('async neutralize()') && runtime.includes('return this.flush()'),
    leaseTestPresent: gateTests.includes('excludes the previous hand'),
    neutralTestPresent: runtimeTests.includes('immediately transmits zero vectors'),
    noHardwareClaim: route.truth?.hardwareTested === false && route.truth?.runtimeAdapterIncluded === false,
  };

  state = record(state, 'realityChecks', 'pc-repair-result',
    'The active contracts now include a backward-compatible source binding id/epoch, host rejection of the previous binding, bind/revoke helpers, and immediate semantic neutralization.',
    'All bounded software controls pass while the physical adapter remains explicitly absent.', 50);
  state = record(state, 'soulChecks', 'pc-repair-agency',
    'Input switching preserves the human seat, requires explicit claiming, offers phone fallback, and never hides an AI authority transition inside a hardware menu.',
    'The repair adds capability without removing player choice or creating automatic substitutes.', 51);
  state = record(state, 'seams', 'pc-open-hardware-proof',
    'Actual USB, Bluetooth, mixed-party, reconnect, focus, fullscreen and multi-device behavior remains unknown until physical hardware testing.',
    'A software contract cannot substitute for device evidence.', 52);

  if (!Object.values(controls).every(Boolean)) {
    throw new Error(`physical controller discovery controls failed: ${JSON.stringify(controls)}`);
  }
  const validation = Discovery.validate(state);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  return {
    schema: 'axm.shared-controls.physical-controller-discovery/v1',
    passes: 2,
    state,
    controls,
    repairedSeams: ['concurrent valid hands', 'local reset without immediate host neutralization'],
    documentedSeams: ['raw device id privacy', 'claim collision', 'non-standard mapping', 'AI authority selector confusion'],
    remainingEvidenceGate: 'physical hardware proof',
    truth: {
      internalReviewOnly: true,
      independentValidation: false,
      hardwareTested: false,
      runtimeGamepadAdapterImplemented: false,
    },
  };
}

if (require.main === module) {
  const result = run();
  console.log(`AXM Physical Controller Discovery: PASS - passes=${result.passes}`);
  result.repairedSeams.forEach((item, index) => console.log(`REPAIRED ${index + 1} - ${item}`));
  result.documentedSeams.forEach((item, index) => console.log(`DOCUMENTED ${index + 1} - ${item}`));
  console.log(`OPEN EVIDENCE GATE - ${result.remainingEvidenceGate}`);
  console.log('TRUTH - no gamepad runtime or hardware claim');
}

module.exports = { run };

