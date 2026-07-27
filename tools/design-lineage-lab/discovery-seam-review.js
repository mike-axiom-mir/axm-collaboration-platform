'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const visualDirector = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'visual-art-director-lab', 'module.contract.json'), 'utf8'));
const fabric = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'asset-fabric', 'module.contract.json'), 'utf8'));
const canvas = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'knowledge-canvas', 'module.contract.json'), 'utf8'));

assert.ok(contract.provides.includes('design.lineage.compile'));
assert.ok(visualDirector.provides.includes('visible-outcome-inspection'), 'visual judgment remains in the visual director');
assert.ok(fabric.provides.includes('quality-diversity-visual-archive'), 'asset candidates remain owned by Fabric');
assert.ok(canvas.provides.includes('sourced-research-notebook'), 'general sourced knowledge remains owned by Knowledge Canvas');
assert.ok(contract.boundaries.refuses.includes('taste-reduced-to-score'));
assert.ok(contract.boundaries.refuses.includes('source-artifact-rewrite'));
console.log('design lineage discovery seam review passed · evidence ledger stays separate from judgment, creation, and notebook ownership');

