#!/usr/bin/env node
'use strict';

const POLICY_SCHEMA = 'axm.universal-gamepad-default/v1';
const DEFAULT_INPUT_PROFILE = 'axm-universal-xbox-brawl-v0.2.1';

function text(value) { return String(value || '').toLowerCase(); }

function cooperativeSignals(manifest) {
  const rules = manifest && manifest.rules || {};
  const modes = Array.isArray(manifest && manifest.play_modes) ? manifest.play_modes : [];
  return [
    manifest && manifest.name,
    manifest && manifest.description,
    rules.team_mode,
    rules.intended_pair,
    ...modes.flatMap(mode => [mode && mode.id, mode && mode.label, mode && mode.description])
  ].map(text).join(' ');
}

function isSharedScreenPartyCoop(manifest) {
  const controls = manifest && manifest.controls || {};
  if (controls.party_coop === false || controls.shared_screen !== true || Number(manifest && manifest.max_players || 0) < 2) return false;
  if (controls.party_coop === true) return true;
  const signals = cooperativeSignals(manifest);
  return /(?:\bco-?op\b|\bcooperative\b|\bduet\b|\brelay\b|\bshared[- ]objective\b)/.test(signals);
}

function evaluateUniversalGamepad(manifest) {
  const controls = manifest && manifest.controls || {};
  const applicable = isSharedScreenPartyCoop(manifest);
  const optedOut = controls.universal_gamepad === false;
  const required = applicable && !optedOut;
  const declaredProfile = String(controls.gamepad_profile || '');
  let status = 'not-applicable';
  if (applicable && optedOut) status = 'opted-out';
  else if (required && controls.gamepad === true && declaredProfile === DEFAULT_INPUT_PROFILE) status = 'integrated';
  else if (required && controls.gamepad === true) status = 'adapter-migration-required';
  else if (required) status = 'mapping-required';
  return {
    schema: POLICY_SCHEMA,
    policy: 'default-for-party-coop-shared-screen',
    applicable,
    required,
    inherited: required && controls.universal_gamepad == null,
    status,
    input_profile: DEFAULT_INPUT_PROFILE,
    semantic_profile: controls.profile_id || null,
    gamepad_declared: controls.gamepad === true,
    explicit_opt_out: optedOut,
    opt_out_reason: optedOut ? String(controls.universal_gamepad_opt_out_reason || '') : null
  };
}

function applyUniversalControlDefaults(manifest) {
  const effective = Object.assign({}, manifest || {});
  effective.controls = Object.assign({}, manifest && manifest.controls || {});
  effective.controls.universal_gamepad = evaluateUniversalGamepad(manifest);
  return effective;
}

module.exports = {
  DEFAULT_INPUT_PROFILE,
  POLICY_SCHEMA,
  applyUniversalControlDefaults,
  evaluateUniversalGamepad,
  isSharedScreenPartyCoop
};
