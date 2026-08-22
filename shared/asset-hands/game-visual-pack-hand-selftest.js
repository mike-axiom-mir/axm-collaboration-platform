#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Hands = require('./asset-hands');
const GameVisual = require('./game-visual-pack-core');
const Catalog = require('./artifact-schema-catalog');

async function main() {
  const request = GameVisual.createSelectionRequest({ id: 'game-visual-hand-proof', mode: 'recommend' });
  const source = {
    id: 'game-visual-request',
    role: 'selection-request',
    name: 'Game visual selection request',
    mime: 'application/json',
    format: 'JSON',
    content_schema: GameVisual.SCHEMAS.request,
    editable: true,
    text: JSON.stringify(request)
  };
  const brief = {
    id: 'game-visual-hand-proof',
    title: 'Game visual hand proof',
    kind: 'inspection',
    operation_mode: 'inspect',
    intended_use: 'inspection',
    target_canvas: { medium: 'screen', dimensions: { width: 64, height: 64, unit: 'px' }, colour: { space: 'srgb', transparency: 'allowed' }, behaviour: ['static'], intended_use: 'inspection' },
    required_outputs: ['application/json'],
    editable_recipe_formats: [GameVisual.SCHEMAS.request],
    source_artifacts: [source]
  };
  const host = { capabilities: ['json'], permissions: [], accepts: [Hands.RESULT_SCHEMA, 'application/json', GameVisual.SCHEMAS.result] };
  const diagnosis = Hands.diagnose(brief, host);
  assert.equal(diagnosis.status, 'READY');
  assert(diagnosis.compatible_hands.some(hand => hand.id === 'game-visual-pack-selection'));
  const result = await Hands.createAsync('game-visual-pack-selection', brief, { seed: 'game-visual-hand-proof', createdAt: '2026-08-12T00:00:00.000Z', host });
  assert.equal(result.status, 'READY');
  assert.equal(result.technical.pass, true);
  assert.equal(result.validation_receipt.status, 'PASS');
  assert.equal(result.artifacts.length, 6);
  const selectionArtifact = result.artifacts.find(artifact => artifact.metadata && artifact.metadata.schema === GameVisual.SCHEMAS.result);
  const selection = JSON.parse(selectionArtifact.text);
  assert.equal(selection.status, 'READY_FOR_CHOICE');
  assert.equal(selection.selection, null);
  assert.equal(selection.fallback_used, false);
  assert.equal(selection.save_digest_before, selection.save_digest_after);
  assert.equal(Catalog.validate(selection.schema, selection).pass, true);
  console.log('Game visual pack hand selftest PASS (routed, deterministic, advisory-only, save-independent)');
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
