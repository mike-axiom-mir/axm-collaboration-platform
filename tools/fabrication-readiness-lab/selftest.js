'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function assert(value, message) { if (!value) throw new Error(message); }
assert(manifest.id === 'fabrication-readiness-lab', 'manifest id');
assert(manifest.permissions.length === 0 && contract.permissions.length === 0, 'lab must request no permissions');
assert(contract.boundaries.refuses.includes('hardware-execution'), 'hardware execution refusal');
assert(contract.boundaries.refuses.includes('advertisement-as-proof'), 'advertisement proof refusal');
assert(html.includes('No printer attached'), 'visible no-printer boundary');
assert(html.includes('UNVERIFIED ADVERTISING'), 'visible evidence boundary');
assert(!/<button[^>]*(print|execute|connect)/i.test(html), 'no printer execution/connect button');
assert(app.includes("hardwareCommand: null"), 'candidate cannot contain a hardware command');
assert(app.includes('buildBoundedTestPackage'), 'bounded package is the strongest UI output');
console.log('fabrication readiness lab self-test passed (research-only; no hardware control)');
