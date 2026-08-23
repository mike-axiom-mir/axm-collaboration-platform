#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Engine = require('./src/engine');
const Metadata = require('./src/metadata');
const Canonical = require('./src/canonical-json');

const COMMANDS = new Set(['tokenize', 'parse', 'inspect', 'full', 'profile']);

function usage() {
  return [
    'AXM Web Headless — EXPERIMENTAL offline Phase 1',
    '',
    'Usage:',
    '  node cli.js tokenize <file|-> [--pretty] [--omit-source-bytes]',
    '  node cli.js parse <file|-> [--pretty] [--omit-source-bytes]',
    '  node cli.js inspect <file|-> [--pretty] [--omit-source-bytes]',
    '  node cli.js full <file|-> [--pretty] [--omit-source-bytes]',
    '  node cli.js profile [--pretty]',
    '',
    'Bounds:',
    '  --max-bytes <n>       default 1048576',
    '  --max-tokens <n>      default 100000',
    '  --max-attributes <n>  default 128 per element',
    '  --max-nesting <n>     default 256',
    '',
    'Network URLs are intentionally refused in this phase.'
  ].join('\n');
}

function parseInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw Object.assign(new Error(flag + ' requires a positive integer'), { code: 'INVALID_ARGUMENT' });
  return number;
}

function parseArgs(argv) {
  const command = argv[0];
  if (!command || command === '--help' || command === '-h') return { help: true };
  if (!COMMANDS.has(command)) throw Object.assign(new Error('unknown command: ' + command), { code: 'UNKNOWN_COMMAND' });
  const result = { command, input: null, pretty: false, omitSourceBytes: false };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--pretty') result.pretty = true;
    else if (arg === '--omit-source-bytes') result.omitSourceBytes = true;
    else if (arg === '--max-bytes') result.maxBytes = parseInteger(argv[++i], arg);
    else if (arg === '--max-tokens') result.maxTokens = parseInteger(argv[++i], arg);
    else if (arg === '--max-attributes') result.maxAttributes = parseInteger(argv[++i], arg);
    else if (arg === '--max-nesting') result.maxNesting = parseInteger(argv[++i], arg);
    else if (arg.startsWith('--')) throw Object.assign(new Error('unknown option: ' + arg), { code: 'UNKNOWN_OPTION' });
    else if (result.input === null) result.input = arg;
    else throw Object.assign(new Error('unexpected argument: ' + arg), { code: 'UNEXPECTED_ARGUMENT' });
  }
  if (command !== 'profile' && result.input === null) throw Object.assign(new Error(command + ' requires a local file or -'), { code: 'MISSING_INPUT' });
  return result;
}

function readInput(locator) {
  if (/^https?:\/\//i.test(locator)) {
    throw Object.assign(new Error('network fetching is held in Phase 1'), { code: 'NETWORK_HELD', locator });
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(locator)) {
    throw Object.assign(new Error('non-file URL schemes are unsupported in Phase 1'), { code: 'URL_SCHEME_UNSUPPORTED', locator });
  }
  if (locator === '-') return { bytes: fs.readFileSync(0), requestedUrl: 'stdin:' };
  return { bytes: fs.readFileSync(locator), requestedUrl: locator.replace(/\\/g, '/') };
}

function print(value, pretty, stream) {
  (stream || process.stdout).write(Canonical.stringify(value, pretty ? 2 : 0) + '\n');
}

function errorEnvelope(error) {
  return {
    schema: 'axm.web.error/v1',
    code: String(error && error.code || 'UNEXPECTED_ERROR'),
    message: String(error && error.message || error),
    details: error && error.details ? error.details : null,
    locator: error && error.locator ? error.locator : null,
    status: 'FAIL'
  };
}

function main(argv) {
  try {
    const args = parseArgs(argv);
    if (args.help) {
      process.stdout.write(usage() + '\n');
      return 0;
    }
    if (args.command === 'profile') {
      print({
        schema: 'axm.web.profile-result/v1',
        engine: Metadata.engineMetadata(),
        capabilities: Metadata.capabilities()
      }, args.pretty);
      return 0;
    }
    const input = readInput(args.input);
    const result = Engine.run(input.bytes, {
      command: args.command,
      requestedUrl: input.requestedUrl,
      omitSourceBytes: args.omitSourceBytes,
      maxBytes: args.maxBytes,
      maxTokens: args.maxTokens,
      maxAttributes: args.maxAttributes,
      maxNesting: args.maxNesting
    });
    print(result, args.pretty);
    return 0;
  } catch (error) {
    print(errorEnvelope(error), false, process.stderr);
    return ['NETWORK_HELD', 'URL_SCHEME_UNSUPPORTED', 'INVALID_ARGUMENT', 'UNKNOWN_COMMAND', 'UNKNOWN_OPTION', 'UNEXPECTED_ARGUMENT', 'MISSING_INPUT'].includes(error.code) ? 2 : 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { COMMANDS, usage, parseArgs, readInput, errorEnvelope, main };
