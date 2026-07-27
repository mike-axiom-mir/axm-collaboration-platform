'use strict';

const fs = require('fs');
const path = require('path');
const C = require('../core');

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}
function create(options) {
  options = options || {};
  const root = path.resolve(C.assertExactIdentifier(options.ownedRoot, 'ownedRoot'));
  const file = path.resolve(C.assertExactIdentifier(options.file, 'file'));
  if (!inside(root, file)) throw new Error('store file must stay inside the exact owned root');
  if (path.extname(file).toLowerCase() !== '.jsonl') throw new Error('store file must be an exact .jsonl path');
  function list() {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(function (line) { return JSON.parse(line); });
  }
  function append(row) {
    if (options.writeAuthorized !== true) throw new Error('owned continuity write authority is required');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(C.clone(row)) + '\n', 'utf8');
  }
  function latest() { const rows = list(); return rows.length ? C.clone(rows[rows.length - 1]) : null; }
  return { append, list, latest, status: function () { return { file, ownedRoot: root, writeAuthorized: options.writeAuthorized === true }; } };
}

module.exports = { create, inside };
