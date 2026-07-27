#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./core');
const Goals = require('./goal-normalizer');
const Runner = require('./runner');

function argumentsMap(args) {
  const out = {};
  for (let index = 0; index < args.length; index += 1) {
    if (!args[index].startsWith('--')) continue;
    const key = args[index].slice(2), value = args[index + 1] && !args[index + 1].startsWith('--') ? args[++index] : true;
    out[key] = value;
  }
  return out;
}
function atomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp-' + process.pid;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, file);
}
function execute(argv) {
  const args = argumentsMap(argv || []);
  const root = path.resolve(args.root || path.join(__dirname, '..', '..'));
  let goal;
  if (args.direction) {
    const state = JSON.parse(fs.readFileSync(path.join(root, 'state', 'workshop-direction', 'directions.json'), 'utf8'));
    const plan = state.directions && state.directions[args.direction];
    if (!plan) throw new Error('direction not found: ' + args.direction);
    goal = Goals.fromDirection(plan);
  } else {
    const goalFile = path.resolve(root, args.goal || 'shared/deterministic-research/examples/current-workshop-goal.json');
    goal = JSON.parse(fs.readFileSync(goalFile, 'utf8'));
  }
  const output = path.resolve(root, args.out || 'exports/deterministic-research/latest');
  const allowed = path.resolve(root, 'exports', 'deterministic-research') + path.sep;
  Core.assert(output.startsWith(allowed), 'research output must stay inside exports/deterministic-research');
  const result = Runner.run({ root, goal, observedAt: args['observed-at'] || new Date().toISOString(), includeWorkshopGaps: args['goal-only'] !== true });
  atomic(path.join(output, 'research-report.json'), JSON.stringify(result.report, null, 2) + '\n');
  atomic(path.join(output, 'research-report.md'), result.markdown + '\n');
  atomic(path.join(output, 'workshop-snapshot.json'), JSON.stringify(result.inventory, null, 2) + '\n');
  atomic(path.join(output, 'evidence-ledger.json'), JSON.stringify(result.ledger, null, 2) + '\n');
  const receipt = {
    schema: 'axm.deterministic-research-run-receipt/v1',
    researchDigest: result.report.researchDigest,
    goalDigest: result.report.goal.goalDigest,
    workshopSnapshotDigest: result.inventory.snapshotDigest,
    outputs: ['research-report.json', 'research-report.md', 'workshop-snapshot.json', 'evidence-ledger.json'],
    automaticBuild: false, automaticPromotion: false, automaticPermission: false
  };
  atomic(path.join(output, 'run-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  return { output, result, receipt };
}

if (require.main === module) {
  try {
    const done = execute(process.argv.slice(2));
    console.log('Deterministic Research Foundry: ' + done.result.report.route + ' · ' + done.result.report.gaps.length + ' gap(s) · ' + done.result.report.researchDigest);
    console.log(done.output);
  } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { execute };
