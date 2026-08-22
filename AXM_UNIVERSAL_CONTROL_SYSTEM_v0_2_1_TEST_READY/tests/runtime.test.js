import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ControlRuntime } from '../src/core/control-runtime.js';

const actionsDocument = JSON.parse(fs.readFileSync(new URL('../profiles/core-actions.json', import.meta.url), 'utf8'));
const profile = JSON.parse(fs.readFileSync(new URL('../profiles/reference-twin-stick.profile.json', import.meta.url), 'utf8'));

test('control runtime gives a game one semantic integration surface', () => {
  const runtime = new ControlRuntime({actionsDocument,profile,initialContext:'gameplay'});
  const calls=[];
  const adapter={start(){calls.push('start')},stop(){calls.push('stop')}};
  runtime.addAdapter(adapter).start();
  assert.deepEqual(calls,['start']);
  runtime.bus.setSourceAction('test','MOVE',{x:1,y:0});
  assert.deepEqual(runtime.get('MOVE'),{x:1,y:0});
  runtime.setContext('menu');
  assert.deepEqual(runtime.get('MOVE'),{x:0,y:0});
  assert.deepEqual(runtime.get('NAVIGATE'),{x:1,y:0});
  runtime.destroy();
  assert.deepEqual(calls,['start','stop']);
});
