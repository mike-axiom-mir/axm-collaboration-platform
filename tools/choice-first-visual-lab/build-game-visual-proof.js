#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('../../shared/asset-hands/game-visual-pack-core');

const output = path.join(__dirname, 'pilots', 'game-visual-choice-proof.json');
const proof = Core.buildPilotScenarioProof();
if (proof.status !== 'PASS') throw new Error('game visual choice proof did not pass');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(proof, null, 2) + '\n');
console.log('Wrote ' + path.relative(process.cwd(), output) + ' (' + proof.scenarios.length + ' scenarios)');
