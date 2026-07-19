'use strict';

const fs = require('fs');
const path = require('path');
const Foundation = require('../kernel/reasoning-foundation');
const Organ = require('../organs/reasoning-structural-feature-organ');

const root = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'training', 'reasoning-strategy-train.json'), 'utf8'));
const row = fixture.cases[0];
const session = Foundation.run({
  goal: row.goal,
  evidence: row.evidence,
  unknowns: row.unknowns,
  assumptions: row.assumptions,
  constraints: row.constraints,
  permissions: row.permissions,
  actions: row.actions,
  pathProfiles: row.pathProfiles
}, { at: null });
const projection = session.pathSet.strategyGuidance.structuralProjection;
Organ.verify(projection, session);
process.stdout.write(`${JSON.stringify(projection, null, 2)}\n`);
