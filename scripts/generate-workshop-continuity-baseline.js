#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const Continuity = require('../shared/continuity/workshop-inventory-continuity');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'registry', 'workshop-continuity-baseline.json');
const EXCLUDED_TOP_LEVEL = new Set(['.git', 'node_modules', 'exports', 'backups', 'logs', 'state', 'local-data', 'intakes', '.cache', 'coverage', 'tmp']);
const REQUIRED_GATE_PATHS = [
  '.github/CODEOWNERS',
  '.github/workflows/public-launch.yml',
  'docs/steward-runs/2026-08-23-workshop-continuity-recovery/WORKSHOP_CONTINUITY_RECOVERY_RECEIPT.md',
  'registry/workshop-continuity-baseline.json',
  'registry/workshop-continuity-retirements.json',
  'scripts/generate-workshop-continuity-baseline.js',
  'shared/continuity/workshop-inventory-continuity.js',
  'tests/workshop-continuity-gate-test.js',
  'verify.js'
];

function portable(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function included(relative) {
  relative = portable(relative);
  if (!relative) return false;
  const top = relative.split('/')[0];
  if (EXCLUDED_TOP_LEVEL.has(top)) return false;
  if (relative === 'bridge/bridge-token.txt' || relative === 'bridge/bridge.log' || relative === 'logs/workshop.log') return false;
  return true;
}

function walkActiveFiles(root) {
  const found = [];
  function walk(folder, relativeFolder) {
    fs.readdirSync(folder, { withFileTypes:true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
      const relative = relativeFolder ? relativeFolder + '/' + entry.name : entry.name;
      if (!included(relative)) return;
      const absolute = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(absolute, relative);
      else if (entry.isFile()) found.push(relative);
    });
  }
  walk(root, '');
  return Continuity.sortedUnique(found);
}

function git(args, options) {
  const result = childProcess.spawnSync('git', args, Object.assign({ cwd:ROOT, encoding:'utf8', windowsHide:true, maxBuffer:64 * 1024 * 1024 }, options || {}));
  if (result.status !== 0) throw new Error('git ' + args.join(' ') + ' failed: ' + String(result.stderr || result.stdout || '').trim());
  return result.stdout;
}

function revisionPaths(revision) {
  return String(git(['ls-tree', '-r', '--name-only', '-z', revision]) || '').split('\0').map(portable).filter(included);
}

function resolveRevision(revision) {
  return String(git(['rev-parse', '--verify', revision + '^{commit}']) || '').trim();
}

function parseOptions(argv) {
  const revisions = argv.filter(value => value.startsWith('--revision=')).map(value => value.slice('--revision='.length)).filter(Boolean);
  const asOfArg = argv.find(value => value.startsWith('--as-of='));
  const asOf = asOfArg ? new Date(asOfArg.slice('--as-of='.length)) : new Date();
  if (!Number.isFinite(asOf.getTime())) throw new Error('--as-of must be a valid date/time');
  return { revisions, asOf:asOf.toISOString(), write:argv.includes('--write'), confirmed:argv.includes('--confirm-mike-reviewed') };
}

function buildBaseline(root, options) {
  const live = Continuity.collectLiveInventory(root);
  if (live.errors.length) throw new Error('live tool inventory is invalid: ' + live.errors.join('; '));
  const references = options.revisions.map(resolveRevision);
  const protectedPaths = Continuity.sortedUnique((options.revisions.length ? options.revisions.flatMap(revisionPaths) : walkActiveFiles(root)).concat(REQUIRED_GATE_PATHS));
  const missing = protectedPaths.filter(relative => relative !== 'registry/workshop-continuity-baseline.json' && !fs.existsSync(path.join(root, ...relative.split('/'))));
  if (missing.length) throw new Error('cannot baseline absent active paths: ' + missing.slice(0, 20).join(', ') + (missing.length > 20 ? ' (+' + (missing.length - 20) + ' more)' : ''));
  return {
    schema:Continuity.BASELINE_SCHEMA,
    generatedAt:options.asOf,
    referenceRevisions:references,
    inventory:{
      protectedPaths,
      toolIds:live.toolIds,
      providedCapabilityIds:live.providedCapabilityIds,
      providerBindings:live.providerBindings,
      consumerBindings:live.consumerBindings
    },
    counts:{
      protectedPaths:protectedPaths.length,
      tools:live.toolIds.length,
      providedCapabilities:live.providedCapabilityIds.length,
      providerBindings:live.providerBindings.length,
      consumerBindings:live.consumerBindings.length
    },
    truth:{
      protectsPresenceNotContent:true,
      additionsDoNotFail:true,
      retirementRequiresExplicitMikeRecord:true,
      moduleMayNotSelfRetire:true,
      rawIntakesExcludedFromActiveSource:true,
      automaticBaselineRewrite:false
    }
  };
}

function main(argv) {
  const options = parseOptions(argv || process.argv.slice(2));
  const baseline = buildBaseline(ROOT, options);
  const checked = Continuity.validateBaseline(baseline);
  if (!checked.pass) throw new Error(checked.errors.join('; '));
  if (options.write) {
    if (!options.confirmed) throw new Error('--write requires --confirm-mike-reviewed; baseline changes remain review material until Mike accepts them');
    fs.mkdirSync(path.dirname(OUTPUT), { recursive:true });
    fs.writeFileSync(OUTPUT, JSON.stringify(baseline, null, 2) + '\n');
  }
  process.stdout.write('Workshop continuity baseline: ' + baseline.counts.protectedPaths + ' paths · ' + baseline.counts.tools + ' tools · ' + baseline.counts.providedCapabilities + ' provided capabilities · ' + baseline.counts.providerBindings + ' provider bindings' + (options.write ? ' · WRITTEN FOR REVIEW' : ' · DRY RUN') + '\n');
  return baseline;
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.stack || error.message || error); process.exitCode = 1; }
}

module.exports = { EXCLUDED_TOP_LEVEL, REQUIRED_GATE_PATHS, included, walkActiveFiles, revisionPaths, parseOptions, buildBaseline, main };
