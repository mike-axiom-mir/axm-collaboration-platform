'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const FSM = require('../../shared/game-fsm/index.js');

// Shapeable's model is deliberately a browser script, not a CommonJS module.
// Give it only the browser global it declares and read the same public API the
// live Builder receives, instead of pretending it has a Node export.
const previousWindow = global.window;
global.window = {};
require('../shapeable-builder/model.js');
const Shapeable = global.window.AXMBuilderModel;
if (previousWindow === undefined) delete global.window;
else global.window = previousWindow;

require('../../shared/game-fsm/selftest.js');
const pack = JSON.parse(fs.readFileSync(path.join(__dirname, 'shapeable-block-pack.json'), 'utf8'));
const result = Shapeable.validateBlockPack(pack);
assert(result.valid, result.errors.join('; '));
assert.strictEqual(result.pack.blocks.length, 3);
assert.strictEqual(result.pack.blocks.every((item) => item.layer === 'logic'), true);
assert(FSM.toDiagram(FSM.PLAYER_BODY).includes('portable game FSM'));
console.log('FSM Kit selftest: PASS (3 Shapeable logic blocks, existing state authorities preserved)');
