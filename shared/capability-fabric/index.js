'use strict';

const fs = require('fs');
const path = require('path');
const core = require('./core.js');

function loadCatalog() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'recipes', 'catalog.json'), 'utf8'));
}

function findRecipe(id) {
  return loadCatalog().recipes.find(function (recipe) { return recipe.id === id; }) || null;
}

module.exports = Object.assign({}, core, { loadCatalog:loadCatalog, findRecipe:findRecipe });
