'use strict';

const assert = require('assert');
const FSM = require('./index.js');

assert(FSM.validateDefinition(FSM.PLAYER_BODY).ok);
const events = ['MOVE', 'SPRINT', 'HIT', 'RECOVER', 'DIE', 'RESPAWN'];
const first = FSM.runTrace(FSM.PLAYER_BODY, events);
const second = FSM.runTrace(FSM.PLAYER_BODY, events);
assert.deepStrictEqual(first, second, 'same definition and events must make the same trace');
assert.strictEqual(first.current_state, 'idle');
assert(first.events.some((item) => item.clip === 'locomotion-run'));
assert(first.events.some((item) => item.clip === 'respawn-long-reach'));

const guarded = {
  schema: FSM.SCHEMA,
  id: 'guarded-run',
  initial: 'idle',
  states: {
    idle: {on: {SPRINT: {target: 'run', guard: 'has-stamina', action: 'spend-stamina'}}},
    run: {on: {STOP: 'idle'}}
  }
};
const context = {stamina: 1};
const machine = FSM.createMachine(guarded, context, {guards: {'has-stamina': (ctx) => ctx.stamina > 0}, actions: {'spend-stamina': (ctx) => { ctx.stamina -= 1; }}});
assert(machine.can('SPRINT'));
assert.strictEqual(machine.send('SPRINT'), 'run');
assert.strictEqual(context.stamina, 0);
machine.send('STOP');
assert.strictEqual(machine.send('SPRINT'), 'idle');
assert.strictEqual(machine.trace().at(-1).status, 'BLOCKED');

const dishonest = clone => ({schema: FSM.SCHEMA, id: 'dishonest', initial: 'a', states: {a: {on: {GO: {target: 'b', guard: clone}}}, b: {}}});
assert(!FSM.validateDefinition(dishonest(() => true)).ok, 'embedded functions must not be called plain JSON');
assert(FSM.toDiagram(FSM.PLAYER_BODY, 'run').includes('<svg'));

console.log(`Portable Game FSM selftest: PASS (${Object.keys(FSM.PLAYER_BODY.states).length} states, bounded named-handler trace)`);
