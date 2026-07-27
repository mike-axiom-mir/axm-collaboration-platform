#!/usr/bin/env node
'use strict';

const assert = require('node:assert');
const crypto = require('node:crypto');
const FX = require('./fx-blocks');

const names = Object.keys(FX.Blocks);
assert.equal(names.length, 15, 'expected fifteen admitted FX blocks');

for (const name of names) {
  const first = FX.Blocks[name]();
  const second = FX.Blocks[name]();
  assert.deepEqual(second, first, name + ' must be byte-stable for equal parameters');
  assert.ok(first.id && first.kind && first.tokens && typeof first.css === 'string', name + ' portable contract is incomplete');
  assert.ok(!/NaN|undefined/.test(JSON.stringify(first)), name + ' emitted invalid numeric or missing values');
}

assert.equal(FX.Blocks.conicGradient().svgDefs, null, 'conic gradient must not claim native SVG parity');
assert.ok(FX.Blocks.grain().svgFilter.includes('feTurbulence'), 'grain must preserve its browser SVG primitive');
assert.equal(
  crypto.createHash('sha256').update(JSON.stringify(FX.Blocks.glow())).digest('hex'),
  crypto.createHash('sha256').update(JSON.stringify(FX.Blocks.glow())).digest('hex'),
  'equal recipes must hash equally'
);

const Hands = require('../asset-hands/asset-hands');
assert.ok(Hands.list().some(hand => hand.id === 'portable-visual-fx'), 'portable FX hand is not registered');

const brief = {
  id: 'fx-proof',
  title: 'Neon interface proof',
  purpose: 'Create a portable neon visual effect recipe',
  kind: 'effect',
  style_tags: ['neon'],
  intended_use: 'skin',
  target_canvas: {
    medium: 'ui',
    dimensions: { width: 640, height: 360, unit: 'px' },
    colour: { space: 'srgb', transparency: 'allowed' },
    behaviour: ['static', 'responsive'],
    intended_use: 'skin'
  },
  required_outputs: ['application/json', 'text/css'],
  editable_recipe_formats: ['axm.visual-fx-recipe/v1']
};
const host = { capabilities: ['svg', 'json'], permissions: [], accepts: [Hands.RESULT_SCHEMA, 'application/json', 'text/css', 'image/svg+xml'] };
const result = Hands.create('portable-visual-fx', brief, { seed: 'fx-proof', createdAt: '2026-07-24T00:00:00.000Z', host });
assert.equal(result.technical.pass, true, 'portable FX hand result must pass technical validation');
assert.ok(result.artifacts.some(item => item.metadata && item.metadata.schema === 'axm.visual-fx-recipe/v1'), 'recipe artifact missing');
assert.equal(JSON.parse(result.artifacts.find(item => item.metadata && item.metadata.schema === 'axm.visual-fx-recipe/v1').text).authority.automatic_apply, false);

console.log('visual-fx selftest: PASS - 15 blocks - deterministic - provider registered - no automatic apply');
