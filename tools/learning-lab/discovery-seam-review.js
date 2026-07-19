'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Core = require('./learning-lab-core');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');

assert.equal(manifest.id, 'learning-lab');
assert.equal(manifest.status, 'TEST');
assert.ok(manifest.tags.includes('modular'));
assert.ok(contract.provides.includes('single-guided-learning-workspace'));
assert.ok(contract.consumes.includes('workspace:project-room'));
assert.ok(contract.consumes.includes('workspace:knowledge-canvas'));
assert.ok(contract.consumes.includes('workspace:game-forge'));
assert.ok(contract.consumes.includes('workspace:ai-team'));
assert.ok(contract.consumes.includes('child:mirror-learning-shell'));
assert.ok(contract.boundaries.refuses.includes('automatic-enrollment'));
assert.ok(contract.boundaries.refuses.includes('identity-or-memory-merge'));
assert.ok(contract.boundaries.refuses.includes('automatic-wisdom-or-canon-promotion'));
assert.ok(contract.boundaries.refuses.includes('pretend-networked-classroom'));
assert.ok(contract.adapterSlots.includes('classroom:networked-presence'));
assert.match(readme, /independently executable/i);
assert.match(readme, /Networked classrooms/);

const project = Core.createProject();
const human = Core.addLearner(project, { id:'human-review', kind:'human', displayName:'Human Review', optedIn:true });
const machine = Core.addLearner(human.project, { id:'machine-review', kind:'machine', displayName:'Machine Review', optedIn:true });
assert.notStrictEqual(machine.project.learners[0].privateProfile, machine.project.learners[1].privateProfile);
assert.equal(Core.schoolHandoff(machine.project, { learnerId:'machine-review', curriculumId:'curriculum:test' }).separation.memoryMerge, false);

console.log('Learning Lab discovery seam review: PASS');
