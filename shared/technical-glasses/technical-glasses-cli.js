#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const Glasses = require('./technical-glasses-core');
const Capabilities = require('../capabilities/workshop-capability-index');

const ROOT = path.resolve(__dirname, '..', '..');
const focusArg = process.argv.find(value => value.startsWith('--focus='));
const jsonMode = process.argv.includes('--json');
const writeMode = process.argv.includes('--write');
const focus = focusArg ? focusArg.slice('--focus='.length) : '';

function tools() {
  const output = [];
  const metadataFile = path.join(ROOT, 'shared', 'capabilities', 'capability-metadata.json');
  let metadata = { modules: {} };
  try { metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8')); } catch (error) {}
  fs.readdirSync(path.join(ROOT, 'tools'), { withFileTypes: true }).forEach(entry => {
    if (!entry.isDirectory() || entry.name.startsWith('_')) return;
    const file = path.join(ROOT, 'tools', entry.name, 'manifest.json');
    try {
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
      const authored = metadata.modules && metadata.modules[manifest.id || entry.name] || {};
      output.push(Object.assign({ folder: entry.name }, manifest, {
        id: manifest.id || entry.name,
        summary: manifest.summary || authored.summary || '',
        actions: manifest.actions || authored.actions || [],
        accepts: manifest.accepts || authored.accepts || [],
        produces: manifest.produces || authored.produces || [],
        readiness: manifest.readiness || authored.readiness || []
      }));
    } catch (error) {
      output.push({ folder: entry.name, id: entry.name, name: entry.name, status: 'BROKEN', entry: null, error: 'manifest missing or invalid', actions: [], accepts: [], produces: [], readiness: [] });
    }
  });
  return output;
}

const catalog = tools();
const focusRoutes = focus ? Capabilities.search(catalog, focus, { limit: 8 }) : [];
const snapshot = Glasses.compile({ root: ROOT, tools: catalog, readiness: {}, focus, focusRoutes });
if (writeMode) {
  const target = path.join(ROOT, 'state', 'technical-glasses', 'latest.json');
  Glasses.writeSnapshot(target, snapshot);
  process.stderr.write('Technical Glasses snapshot written: ' + target + '\n');
}
process.stdout.write(jsonMode ? JSON.stringify(snapshot, null, 2) + '\n' : snapshot.briefing);
