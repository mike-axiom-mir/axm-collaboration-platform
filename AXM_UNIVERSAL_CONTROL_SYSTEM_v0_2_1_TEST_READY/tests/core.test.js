import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ActionRegistry } from '../src/core/action-registry.js';
import { ActionBus } from '../src/core/action-bus.js';
import { normalizeStick, applyDeadZone1D } from '../src/core/normalization.js';
import { validateControlProfile } from '../src/core/profile.js';

const actions = JSON.parse(fs.readFileSync(new URL('../profiles/core-actions.json', import.meta.url), 'utf8'));
const registry = ActionRegistry.fromDocument(actions);

test('core action registry loads all declared actions', () => {
  assert.ok(registry.has('MOVE'));
  assert.ok(registry.has('AIM'));
  assert.ok(registry.has('OPEN_MENU'));
  assert.ok(registry.list().length >= 20);
});

test('dead zone removes center drift and preserves direction', () => {
  assert.equal(applyDeadZone1D(0.05, 0.12, 1), 0);
  const stick = normalizeStick(0.8, 0.2, { inner: 0.12, sensitivity: 1 });
  assert.ok(stick.x > 0.7);
  assert.ok(stick.y > 0);
  assert.ok(stick.magnitude <= 1);
});

test('action bus arbitrates sources by priority then magnitude', () => {
  const bus = new ActionBus(registry);
  bus.setSourceAction('keyboard', 'MOVE', {x:1,y:0}, {priority:1});
  bus.setSourceAction('phone', 'MOVE', {x:0.3,y:0}, {priority:5});
  assert.deepEqual(bus.get('MOVE'), {x:0.3,y:0});
  bus.releaseSource('phone');
  assert.deepEqual(bus.get('MOVE'), {x:1,y:0});
});


test('neutral high-priority source does not block an active lower-priority device', () => {
  const bus = new ActionBus(registry);
  bus.setSourceAction('phone', 'MOVE', {x:0,y:0}, {priority:5});
  bus.setSourceAction('keyboard', 'MOVE', {x:-1,y:0}, {priority:1});
  assert.deepEqual(bus.get('MOVE'), {x:-1,y:0});
});

test('digital actions combine safely across devices', () => {
  const bus = new ActionBus(registry);
  bus.setSourceAction('keyboard','PRIMARY_ACTION',1);
  bus.setSourceAction('phone','PRIMARY_ACTION',0);
  assert.equal(bus.get('PRIMARY_ACTION'),1);
  bus.releaseSource('keyboard');
  assert.equal(bus.get('PRIMARY_ACTION'),0);
});

test('all scenario profiles validate against the shared registry', () => {
  const directory = new URL('../profiles/scenarios/', import.meta.url);
  for (const file of fs.readdirSync(directory)) {
    const profile = JSON.parse(fs.readFileSync(new URL(file, directory), 'utf8'));
    assert.deepEqual(validateControlProfile(profile, registry), [], file);
  }
});

test('the Xbox/Brawl reference profile validates its controller binding contract', () => {
  const profile = JSON.parse(fs.readFileSync(new URL('../profiles/reference-twin-stick.profile.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateControlProfile(profile, registry), []);
});

test('profiles reject unknown physical controller control names', () => {
  const profile={
    id:'bad-pad',version:'1',gameId:'bad-pad',actions:[{id:'MOVE',required:false}],
    phoneLayout:{mode:'simple',twinStick:false,controls:[]},
    controllerLayout:{MOVE:'mysteryStick'},contexts:[{id:'default',visibleLabel:'Default',allowedActions:['MOVE']}]
  };
  assert.ok(validateControlProfile(profile,registry).some(error=>error.includes('unknown standard control')));
});

test('profiles cannot silently omit a required action from phone access', () => {
  const profile={
    id:'bad',version:'1',gameId:'bad',
    actions:[{id:'MOVE',required:true}],
    phoneLayout:{mode:'simple',twinStick:false,controls:[]},
    controllerLayout:{},contexts:[{id:'default',visibleLabel:'Default',allowedActions:['MOVE']}]
  };
  assert.ok(validateControlProfile(profile,registry).some(error=>error.includes('no phone control path')));
});
