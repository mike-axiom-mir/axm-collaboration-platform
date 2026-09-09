#!/usr/bin/env node
'use strict';

const Search = require('../src/search-broker');
const Executor = require('../src/search-executor');
const Canonical = require('../src/canonical-json');

function usage() {
  return [
    'Usage:',
    '  node scripts/search-execute.js "query" --allow-network [options]',
    '',
    'Provider options:',
    '  --provider auto|searxng|brave|kagi',
    '  --mode single|federated',
    '  --searxng <http(s)://host/search>   configure + exact-allowlist this SearXNG endpoint',
    '  --brave                             configure Brave; reads BRAVE_SEARCH_API_KEY only during execution',
    '  --kagi                              configure Kagi; reads KAGI_API_TOKEN only during execution',
    '',
    'Query options:',
    '  --count <1..20>',
    '  --page <1..10>',
    '  --language <code|all>',
    '  --country <CC>',
    '  --freshness day|week|month|year',
    '  --safe-search off|moderate|strict',
    '',
    'Execution options:',
    '  --failure-mode require-all|best-effort',
    '  --timeout-ms <100..60000>',
    '  --max-response-bytes <1024..8388608>',
    '  --pretty',
    '',
    'The command refuses to run without --allow-network. It does not grant page navigation or trust search-result content.'
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

async function main(argv) {
  const args = argv.slice();
  if (flag(args, '--help') || flag(args, '-h')) {
    process.stdout.write(usage() + '\n');
    return;
  }
  const allowNetwork = flag(args, '--allow-network');
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
  const failureMode = take(args, '--failure-mode') || 'require-all';
  const timeoutMs = intValue(take(args, '--timeout-ms'), '--timeout-ms');
  const maxResponseBytes = intValue(take(args, '--max-response-bytes'), '--max-response-bytes');
  if (args.length !== 1) throw new Error('exactly one search query is required\n\n' + usage());

  const query = { query: args[0], provider, mode };
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
  const executionOptions = {
    networkAuthority: allowNetwork ? Executor.NETWORK_AUTHORITY : null,
    failureMode,
    allowedSearxngEndpoints: searxng ? [searxng] : [],
    env: process.env
  };
  if (timeoutMs !== undefined) executionOptions.timeoutMs = timeoutMs;
  if (maxResponseBytes !== undefined) executionOptions.maxResponseBytes = maxResponseBytes;
  const result = await Executor.executeSearchPlan(plan, executionOptions);
  process.stdout.write(Canonical.stringify(result, pretty ? 2 : 0) + '\n');
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(function (error) {
    process.stderr.write(String(error && error.code ? error.code + ': ' : '') + String(error && error.message || error) + '\n');
    process.exitCode = 1;
  });
}

module.exports = { usage, main };
