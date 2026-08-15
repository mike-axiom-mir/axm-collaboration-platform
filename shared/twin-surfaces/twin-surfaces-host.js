'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./twin-surfaces-core');
const OUTPUTS = ['registry/generated/city-twins.json', 'docs/generated/LEGO_CITY_BEGINNER_MAP.md'];

function load(root) {
  root = fs.realpathSync(path.resolve(root));
  const graph = JSON.parse(fs.readFileSync(path.join(root, 'registry/generated/city-graph.json'), 'utf8'));
  const schemas = JSON.parse(fs.readFileSync(path.join(root, 'registry/generated/city-schemas.json'), 'utf8'));
  return Core.compile(graph, schemas);
}
function views(twin) { return { [OUTPUTS[0]]: JSON.stringify(twin, null, 2) + '\n', [OUTPUTS[1]]: Core.humanMarkdown(twin) }; }
function check(root) {
  const twin = load(root), expected = views(twin), failures = [];
  for (const [name, content] of Object.entries(expected)) { const file = path.join(root, name); const actual = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null; if (actual !== content) failures.push({ code: actual == null ? 'TWIN_VIEW_MISSING' : name.endsWith('.md') ? 'HUMAN_TWIN_DRIFT' : 'MACHINE_TWIN_DRIFT', path: name }); }
  return { state: failures.length ? 'FAIL' : 'PASS', twin, failures };
}
function write(root) {
  root = fs.realpathSync(path.resolve(root));
  const twin = load(root), expected = views(twin);
  for (const [name, content] of Object.entries(expected)) { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); const temp = `${file}.tmp-${process.pid}`; fs.writeFileSync(temp, content, { flag: 'wx' }); fs.renameSync(temp, file); }
  return twin;
}
module.exports = { OUTPUTS, load, views, check, write };
