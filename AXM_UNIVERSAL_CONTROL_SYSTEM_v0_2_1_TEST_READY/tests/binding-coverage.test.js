import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { effectivePhoneBindings, missingRequiredPhoneActions, compatibleProfileActions } from '../src/core/binding-coverage.js';

const profile=JSON.parse(fs.readFileSync(new URL('../profiles/reference-twin-stick.profile.json',import.meta.url),'utf8'));
const actions=JSON.parse(fs.readFileSync(new URL('../profiles/core-actions.json',import.meta.url),'utf8'));
const definitions=new Map(actions.actions.map(action=>[action.id,action]));

test('phone binding coverage detects an orphaned required action',()=>{
  assert.deepEqual(missingRequiredPhoneActions(profile,{}),[]);
  const bindings=effectivePhoneBindings(profile,{A:'DODGE'});
  assert.equal(bindings.A,'DODGE');
  assert.ok(missingRequiredPhoneActions(profile,{A:'DODGE'}).includes('PRIMARY_ACTION'));
});

test('stick remapping only offers compatible axis actions',()=>{
  const compatible=compatibleProfileActions(profile,definitions,'leftStick');
  assert.ok(compatible.includes('MOVE'));
  assert.ok(compatible.includes('AIM'));
  assert.equal(compatible.includes('PRIMARY_ACTION'),false);
});
