#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ACTIVE = new Map([
  [1, ['MERGE_EXISTING', 'offline candidate target profile and package manifest']],
  [2, ['MERGE_EXISTING', 'read-only host probe and diagnostics']],
  [3, ['PATCH_MISSING_BEHAVIOR', 'manifest-bound bundled runtime resolver']],
  [4, ['MERGE_EXISTING', 'explicit pinned runtime preparation']],
  [5, ['PATCH_MISSING_BEHAVIOR', 'runtime bundled before first launch']],
  [6, ['MERGE_EXISTING', 'rooted launcher and package path confinement']],
  [7, ['MERGE_EXISTING', 'bounded loopback port selection']],
  [8, ['MERGE_EXISTING', 'health and restored-Hub boot gate']],
  [10, ['PATCH_MISSING_BEHAVIOR', 'token-owned graceful stop and restart receipt']],
  [11, ['MERGE_EXISTING', 'per-file SHA-256 package manifest']],
  [15, ['PATCH_MISSING_BEHAVIOR', 'architecture-qualified x64 and arm64 runtime manifests']],
  [16, ['MERGE_EXISTING', 'complete candidate closure; modular inference remains held']],
  [17, ['PATCH_MISSING_BEHAVIOR', 'license and provenance companions required']],
  [18, ['REJECT_DUPLICATE', 'stronger archive intake and restore verification already present']],
  [19, ['PATCH_MISSING_BEHAVIOR', 'stable entry order and fixed ZIP metadata']],
  [20, ['REJECT_DUPLICATE', 'stronger restore drill already present']],
  [71, ['MERGE_EXISTING', 'diagnostics and candidate readiness gates']],
  [72, ['PATCH_MISSING_BEHAVIOR', 'restored candidate boots with bundled runtime']],
  [73, ['PATCH_MISSING_BEHAVIOR', 'offline evidence gate and lifecycle proof control']],
  [79, ['MERGE_EXISTING', 'beginner-readable launcher report']],
  [80, ['PATCH_MISSING_BEHAVIOR', 'read-only safe-mode launcher and runtime']],
  [92, ['PATCH_MISSING_BEHAVIOR', 'one-click local offline proof control']],
  [93, ['PATCH_MISSING_BEHAVIOR', 'candidate-specific Windows launch guide']],
  [96, ['PATCH_MISSING_BEHAVIOR', 'deduplicated deployment capability catalog']],
  [97, ['PATCH_MISSING_BEHAVIOR', 'candidate-bound clean-device test matrix']],
  [98, ['PATCH_MISSING_BEHAVIOR', 'truth draft separated from publication authority']]
]);

function parse(values) {
  const out = {};
  for (let index = 0; index < values.length; index += 1) {
    if (!values[index].startsWith('--')) throw new Error('unexpected argument: ' + values[index]);
    const key = values[index].slice(2).replace(/-/g, '_');
    const value = values[index + 1];
    if (!value || value.startsWith('--')) throw new Error('missing value for --' + key.replace(/_/g, '-'));
    out[key] = values[++index];
  }
  return out;
}

function owner(seed) {
  if (seed <= 10) return seed === 10 ? 'RECOVERY_CENTER' : 'PUBLIC_WINDOWS_LAUNCHER';
  if (seed <= 20) return 'WORKSHOP_PACKAGER';
  if (seed <= 40) return 'DEVICE_HANDOFF_AND_LAN';
  if (seed <= 50) return 'CONTINUITY_AND_RECOVERY';
  if (seed <= 70) return 'WORKSHOP_UPDATER_AND_INSTALLER';
  if (seed <= 80) return seed === 80 ? 'RECOVERY_CENTER' : 'DIAGNOSTICS';
  if (seed <= 90) return 'HOST_AND_DEVICE_COORDINATION';
  return seed <= 97 ? 'WORKSHOP_PACKAGER' : seed === 98 ? 'PUBLIC_RELEASE_ADAPTER' : 'DIAGNOSTICS_AND_ORCHESTRATION';
}

function main() {
  const args = parse(process.argv.slice(2));
  if (!args.source || !args.output) throw new Error('--source and --output are required');
  const source = path.resolve(args.source);
  const output = path.resolve(args.output);
  const inputBytes = fs.readFileSync(source);
  const input = JSON.parse(inputBytes.toString('utf8').replace(/^\uFEFF/, ''));
  if (!Array.isArray(input.cards) || input.cards.length !== 100) throw new Error('expected the V106 100-card deployment registry');
  const cards = input.cards.map(card => {
    const seed = Number(card.seed_number);
    const active = ACTIVE.get(seed);
    return {
      seed_number: seed,
      id: String(card.seed_id || ''),
      title: String(card.title || ''),
      purpose: String(card.source_purpose_exact || ''),
      intake_stage: String(card.pilot_a_stage || ''),
      local_owner: owner(seed),
      local_disposition: active ? active[0] : 'KEEP_REFERENCE',
      integration_note: active ? active[1] : 'retained as a future capability contract; no dormant duplicate implementation copied'
    };
  });
  const counts = cards.reduce((out, card) => {
    out.intake_stage[card.intake_stage] = (out.intake_stage[card.intake_stage] || 0) + 1;
    out.local_disposition[card.local_disposition] = (out.local_disposition[card.local_disposition] || 0) + 1;
    return out;
  }, { intake_stage: {}, local_disposition: {} });
  const catalog = {
    schema: 'axm.deploy.capability-catalog.v1',
    source: {
      registry_schema: input.schema,
      registry_digest: input.registry_digest,
      registry_file_sha256: crypto.createHash('sha256').update(inputBytes).digest('hex'),
      source_seed_file_sha256: input.source_sha256,
      history_runs_reviewed: input.runs_included
    },
    policy: {
      automatic_merge: false,
      automatic_canon: false,
      duplicate_history_copied: false,
      future_contracts_are_executable_claims: false
    },
    summary: { total: cards.length, ...counts },
    cards
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  process.stdout.write(JSON.stringify({ ok: true, output, summary: catalog.summary }) + '\n');
}

try { main(); }
catch (error) { process.stderr.write(String(error.stack || error.message || error) + '\n'); process.exitCode = 1; }

