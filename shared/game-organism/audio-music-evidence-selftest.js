'use strict';

const assert = require('assert');
const GameOrganism = require('./game-organism');
const AudioEvidence = require('./audio-music-evidence');

const registry = AudioEvidence.loadRegistry();
const checked = AudioEvidence.validateRegistry(registry);
assert(checked.pass, checked.errors.join('; '));
assert.strictEqual(checked.moduleCount, 100);
assert.strictEqual(checked.familyCount, 10);
assert.strictEqual(checked.capabilityCount, 400);

const organ = AudioEvidence.createEvidenceOrgan(registry);
assert(GameOrganism.validateOrgan(organ).pass);
assert.strictEqual(organ.category, 'evidence');
assert(organ.verification.automatic_checks.length >= 108);
assert(organ.verification.human_judgments.includes('audible-quality-and-musical-fit'));

const example = AudioEvidence.createAudioGameEvidenceExample(registry);
assert.strictEqual(example.receipt.verdict, 'CANDIDATE_READY');
assert.strictEqual(example.receipt.errors.length, 0);
assert(example.receipt.evidence_plan.some((item) => item.includes('audio-module:axm.audio.game-audio-event-bridge:local-stewardship-pass')));
assert(example.receipt.human_judgments.some((item) => item.includes('rights-consent-and-licensing-clearance')));
assert.strictEqual(example.receipt.truth.executionStarted, false);
assert.strictEqual(example.receipt.truth.canonicalGameChanged, false);
assert.strictEqual(example.receipt.truth.automaticPromotion, false);
assert.strictEqual(example.receipt.truth.humanReleaseRequired, true);

const readiness = AudioEvidence.readiness(registry);
assert.strictEqual(readiness.candidate_ready, true);
assert.strictEqual(readiness.local_stewardship, 'PASS');
assert.strictEqual(readiness.static_offline_artifacts, 'PASS');
assert.strictEqual(readiness.later_python_audio_regressions, 'BLOCKED_MISSING_DEPENDENCIES');
assert.strictEqual(readiness.strict_notation_adapter_holds, 4);
assert.strictEqual(readiness.live_audio_runtime_proven, false);
assert.strictEqual(readiness.human_listening_approved, false);
assert.strictEqual(readiness.real_devices_proven, false);
assert.strictEqual(readiness.rights_cleared, false);
assert.strictEqual(readiness.published, false);
assert.strictEqual(readiness.canon, false);
assert.strictEqual(readiness.release_approved, false);

console.log('Audio/Music Run 106 game evidence adapter: PASS - 100 locally stewarded modules and 351 structurally validated WAV fixtures compose into a candidate-only game evidence plan; listening, devices, rights, publication, and release remain gated');
