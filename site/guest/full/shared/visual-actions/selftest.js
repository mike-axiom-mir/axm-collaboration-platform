'use strict';

const Actions = require('./visual-actions.js');
let failed = 0;
function test(ok, name) { if (ok) console.log('PASS', name); else { failed++; console.error('FAIL', name); } }

const base = {
  schema:Actions.SCHEMA,
  id:'history.undo',
  title:'Undo',
  family:'history',
  level:'core',
  summary:'Undo the latest editable change.',
  aliases:['step back'],
  handler:'studio.canvas',
  contexts:['studio', 'canvas'],
  requires:['studio.canvas'],
  payload:{command:'history.undo'},
  bindings:[{keys:'Mod+Z', platform:'all', context:'canvas'}]
};

test(Actions.validateAction(base).ok, 'valid action contract is accepted');
test(!Actions.validateAction({...base, id:'Bad ID'}).ok, 'invalid action id is refused');

const registry = Actions.createRegistry([
  base,
  {...base, id:'history.redo', title:'Redo', aliases:['step forward'], payload:{command:'history.redo'}, bindings:[{keys:'Mod+Shift+Z', platform:'all', context:'canvas'}]},
  {...base, id:'filter.polish', title:'Polish active layer', family:'filter', level:'advanced', aliases:['sharpen finish'], payload:{command:'filter.polish'}, bindings:[]}
]);
const handlers = {'studio.canvas':(action, payload)=>payload.command};

test(registry.search('step back', {contexts:['canvas'], capabilities:['studio.canvas'], handlers})[0].id === 'history.undo', 'aliases rank the intended action');
test(registry.search('', {contexts:['canvas'], capabilities:['studio.canvas'], handlers}).length === 2, 'advanced actions stay hidden by default');
test(registry.search('', {contexts:['canvas'], includeAdvanced:true, capabilities:['studio.canvas'], handlers}).length === 3, 'advanced actions remain one explicit toggle away');
test(registry.search('undo', {contexts:['canvas'], capabilities:[], handlers})[0].availability === 'UNSUPPORTED_CAPABILITY', 'missing host capability stays visible and explicit');
test(registry.dispatch('history.undo', handlers, {capabilities:['studio.canvas']}).value === 'history.undo', 'dispatch resolves only the named handler');
test(registry.dispatch('history.undo', {}, {capabilities:['studio.canvas']}).status === 'UNBOUND_HANDLER', 'unbound handler is refused');
test(Actions.bindingLabel(base.bindings[0], 'macOS') === '⌘+Z', 'macOS trigger label is platform aware');
test(Actions.bindingLabel(base.bindings[0], 'Windows') === 'Ctrl+Z', 'Windows trigger label is platform aware');
test(registry.detectConflicts().length === 0, 'distinct bindings have no conflict');

const conflict = Actions.createRegistry([base, {...base, id:'history.undo-copy', title:'Undo copy'}]);
test(conflict.detectConflicts().length === 1, 'exact same-context binding conflict is detected');
const platformConflict = Actions.createRegistry([base, {...base, id:'history.undo-windows', title:'Undo Windows', bindings:[{keys:'Mod+Z', platform:'windows', context:'canvas'}]}]);
test(platformConflict.detectConflicts().length === 1, 'all-platform binding conflicts with an overlapping platform binding');

if (failed) process.exit(1);
console.log('AXM Visual Actions selftest: PASS');
