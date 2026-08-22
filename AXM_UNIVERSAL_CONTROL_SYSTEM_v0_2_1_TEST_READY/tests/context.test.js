import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ActionRegistry } from '../src/core/action-registry.js';
import { ActionBus } from '../src/core/action-bus.js';
import { InputContextStack } from '../src/core/context-stack.js';

const actions = JSON.parse(fs.readFileSync(new URL('../profiles/core-actions.json', import.meta.url), 'utf8'));
const profile = JSON.parse(fs.readFileSync(new URL('../profiles/reference-twin-stick.profile.json', import.meta.url), 'utf8'));
const registry = ActionRegistry.fromDocument(actions);

test('context changes are visible and remap at the adapter boundary', () => {
  const contexts = new InputContextStack(profile.contexts);
  const bus = new ActionBus(registry,{contexts});
  contexts.replace('gameplay');
  bus.setSourceAction('keyboard','MOVE',{x:1,y:0});
  assert.deepEqual(bus.get('MOVE'),{x:1,y:0});

  bus.clear();
  contexts.replace('menu');
  assert.equal(contexts.currentLabel(),'Menu controls');
  bus.setSourceAction('keyboard','MOVE',{x:0,y:1});
  assert.deepEqual(bus.get('NAVIGATE'),{x:0,y:1});
  assert.deepEqual(bus.get('MOVE'),{x:0,y:0});
});

test('disallowed actions are ignored in menu context', () => {
  const contexts = new InputContextStack(profile.contexts);
  contexts.replace('menu');
  const bus = new ActionBus(registry,{contexts});
  bus.setSourceAction('keyboard','AIM',{x:1,y:0});
  assert.deepEqual(bus.get('AIM'),{x:0,y:0});
});

test('held input transfers safely across visible context changes', () => {
  const contexts = new InputContextStack(profile.contexts);
  const bus = new ActionBus(registry,{contexts});
  contexts.replace('gameplay');
  bus.setSourceAction('keyboard','MOVE',{x:0,y:1});
  assert.deepEqual(bus.get('MOVE'),{x:0,y:1});
  assert.deepEqual(bus.get('NAVIGATE'),{x:0,y:0});

  contexts.replace('menu');
  assert.deepEqual(bus.get('MOVE'),{x:0,y:0},'old gameplay action must be released');
  assert.deepEqual(bus.get('NAVIGATE'),{x:0,y:1},'held raw input must remap immediately');

  contexts.replace('gameplay');
  assert.deepEqual(bus.get('MOVE'),{x:0,y:1},'held input must return when gameplay resumes');
  assert.deepEqual(bus.get('NAVIGATE'),{x:0,y:0});
});
