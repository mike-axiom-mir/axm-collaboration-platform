import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ActionRegistry } from '../src/core/action-registry.js';
import { InputBehaviorEngine } from '../src/core/input-behavior.js';

const actions = JSON.parse(fs.readFileSync(new URL('../profiles/core-actions.json', import.meta.url), 'utf8'));
const registry = ActionRegistry.fromDocument(actions);

test('behavior engine distinguishes tap, double tap, hold, and repeat deterministically', () => {
  const engine = new InputBehaviorEngine(registry, {
    policies: { ATTACK: { tapMaxMs: 250, doubleTapWindowMs: 350, holdThresholdMs: 400, repeatDelayMs: 450, repeatIntervalMs: 100 } }
  });
  let output = engine.ingest({id:'ATTACK',phase:'pressed',sourceId:'phone',timestamp:0});
  assert.equal(output[0].behavior,'pressed');
  assert.deepEqual(engine.tick(410).map(event=>event.behavior),['hold']);
  assert.deepEqual(engine.tick(450).map(event=>event.behavior),['repeat']);
  output = engine.ingest({id:'ATTACK',phase:'released',previousSourceId:'phone',timestamp:470});
  assert.equal(output.some(event=>event.behavior==='tap'),false,'long press is not also a tap');

  engine.ingest({id:'ATTACK',phase:'pressed',sourceId:'phone',timestamp:1000});
  output = engine.ingest({id:'ATTACK',phase:'released',previousSourceId:'phone',timestamp:1100});
  assert.equal(output.some(event=>event.behavior==='tap'),true);
  engine.ingest({id:'ATTACK',phase:'pressed',sourceId:'phone',timestamp:1250});
  output = engine.ingest({id:'ATTACK',phase:'released',previousSourceId:'phone',timestamp:1320});
  assert.equal(output.some(event=>event.behavior==='double-tap'),true);
});

test('toggle accessibility policy changes state once per press', () => {
  const engine = new InputBehaviorEngine(registry,{policies:{CROUCH:{toggle:true}}});
  let output=engine.ingest({id:'CROUCH',phase:'pressed',sourceId:'keyboard',timestamp:0});
  assert.equal(output.find(event=>event.behavior==='toggle').active,true);
  engine.ingest({id:'CROUCH',phase:'released',previousSourceId:'keyboard',timestamp:50});
  output=engine.ingest({id:'CROUCH',phase:'pressed',sourceId:'keyboard',timestamp:100});
  assert.equal(output.find(event=>event.behavior==='toggle').active,false);
});
