'use strict';

const path = require('path');
const fs = require('fs');
const core = require('./core.js');

const PACK_NAMES = ['software-workshop', 'games-entertainment', 'creative-production'];

function loadPacks() {
  return PACK_NAMES.map(function (name) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'field-packs', name + '.json'), 'utf8'));
  });
}

function findPack(id) {
  return loadPacks().find(function (pack) { return pack.id === id; }) || null;
}

module.exports = Object.assign({}, core, { loadPacks: loadPacks, findPack: findPack, PACK_NAMES: PACK_NAMES });
