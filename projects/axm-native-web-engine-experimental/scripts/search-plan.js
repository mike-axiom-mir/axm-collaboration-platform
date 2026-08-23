#!/usr/bin/env node
'use strict';

const Search = require('../src/search-broker');
const Canonical = require('../src/canonical-json');

function usage() {
  return [
    'Usage:',
    '  node scripts/search-plan.js "query" [options]',
    '',
    'Options:',
    '  --provider auto|searxng|brave|kagi',
    '  --mode single|federated',
    '  --searxng <http(s)://host/search>',
    '  --brave                 mark Brave adapter configured',
    '  --kagi                  mark Kagi adapter configured',
    '  --count <1..20>',
    '  --page <1..10>',
    '  --language <code|all>',
    '  --country <CC>',
    '  --freshness day|week|month|year',
    '  --safe-search off|moderate|strict',
    '  --pretty',
    '',
    'This command only emits a deterministic provider plan. It performs no network request and never reads API-key values.'
  ].join('\n');
}

function take(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  if (index + 1 >= args.length) throw new Error(name + ' requires a value');
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
}

function flag(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return false;
  args.splice(index, 1);
  return true;
}

function intValue(value, name) {
  if (value == null) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(name + ' requires an integer');
  return parsed;
}

function main(argv) {
  const args = argv.slice();
  if (flag(args, '--help') || flag(args, '-h')) {
    process.stdout.write(usage() + '\n');
    return;
  }
  const pretty = flag(args, '--pretty');
  const brave = flag(args, '--brave');
  const kagi = flag(args, '--kagi');
  const provider = take(args, '--provider') || 'auto';
  const mode = take(args, '--mode') || 'single';
  const searxng = take(args, '--searxng') || process.env.AXM_SEARXNG_ENDPOINT || null;
  const count = intValue(take(args, '--count'), '--count');
  const page = intValue(take(args, '--page'), '--page');
  const language = take(args, '--language');
  const country = take(args, '--country');
  const freshness = take(args, '--freshness');
  const safeSearch = take(args, '--safe-search');
  if (args.length !== 1) throw new Error('exactly one search query is required\n\n' + usage());

  const query = {
    query: args[0],
    provider,
    mode
  };
  if (count !== undefined) query.count = count;
  if (page !== undefined) query.page = page;
  if (language !== null) query.language = language;
  if (country !== null) query.country = country;
  if (freshness !== null) query.freshness = freshness;
  if (safeSearch !== null) query.safeSearch = safeSearch;

  const config = {
    searxng: searxng ? { endpoint: searxng } : {},
    brave: { enabled: brave },
    kagi: { enabled: kagi }
  };
  const plan = Search.buildSearchPlan(query, config);
  process.stdout.write(Canonical.stringify(plan, pretty ? 2 : 0) + '\n');
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write(String(error && error.code ? error.code + ': ' : '') + String(error && error.message || error) + '\n');
    process.exitCode = 1;
  }
}

module.exports = { usage, main };
