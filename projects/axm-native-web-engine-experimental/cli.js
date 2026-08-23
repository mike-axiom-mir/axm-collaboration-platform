#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Engine = require('./src/engine');
const Metadata = require('./src/metadata');
const Canonical = require('./src/canonical-json');
const Digest = require('./src/digest');
const Svg = require('./src/svg-renderer');
const BrowserSnapshot = require('./src/browser-snapshot');

const COMMANDS = new Set(['tokenize', 'parse', 'inspect', 'full', 'layout', 'display', 'render-svg', 'browser-snapshot', 'profile']);
const STRUCTURE_COMMANDS = new Set(['layout', 'display', 'render-svg', 'browser-snapshot']);
const ARTIFACT_COMMANDS = new Set(['render-svg', 'browser-snapshot']);

function usage() {
  return [
    'AXM Web — EXPERIMENTAL offline semantic + structure-view proof',
    '',
    'Usage:',
    '  node cli.js tokenize <file|-> [--pretty] [--omit-source-bytes]',
    '  node cli.js parse <file|-> [--pretty] [--omit-source-bytes]',
    '  node cli.js inspect <file|-> [--pretty] [--omit-source-bytes]',
    '  node cli.js full <file|-> [--pretty] [--omit-source-bytes]',
    '  node cli.js layout <file|-> [--viewport 1120x760] [--pretty]',
    '  node cli.js display <file|-> [--viewport 1120x760] [--pretty]',
    '  node cli.js render-svg <file|-> --out <file.svg> [--viewport 1120x760] [--force]',
    '  node cli.js browser-snapshot <file|-> --out <file.html> [--viewport 1120x760] [--force]',
    '  node cli.js profile [--pretty]',
    '',
    'Bounds:',
    '  --max-bytes <n>       default 1048576',
    '  --max-tokens <n>      default 100000',
    '  --max-attributes <n>  default 128 per element',
    '  --max-nesting <n>     default 256',
    '  --max-layout-items <n> default 512',
    '  --max-layout-text <n>  default 65536 characters',
    '  --max-canvas-height <n> default 32768',
    '',
    'Visual artifact writes require an explicit --out path and refuse overwrite',
    'unless --force is present. Network URLs remain intentionally refused.'
  ].join('\n');
}

function parseInteger(value, flag) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw Object.assign(new Error(flag + ' requires a positive integer'), { code: 'INVALID_ARGUMENT' });
  return number;
}

function parseViewport(value) {
  const match = /^([0-9]+)x([0-9]+)$/i.exec(String(value || ''));
  if (!match) throw Object.assign(new Error('--viewport requires WIDTHxHEIGHT'), { code: 'INVALID_ARGUMENT' });
  return { width: parseInteger(match[1], '--viewport width'), height: parseInteger(match[2], '--viewport height') };
}

function optionValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value == null || value.startsWith('--')) throw Object.assign(new Error(flag + ' requires a value'), { code: 'INVALID_ARGUMENT' });
  return value;
}

function parseArgs(argv) {
  const command = argv[0];
  if (!command || command === '--help' || command === '-h') return { help: true };
  if (!COMMANDS.has(command)) throw Object.assign(new Error('unknown command: ' + command), { code: 'UNKNOWN_COMMAND' });
  const result = { command, input: null, pretty: false, omitSourceBytes: false, out: null, force: false, viewport: null };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--pretty') result.pretty = true;
    else if (arg === '--omit-source-bytes') result.omitSourceBytes = true;
    else if (arg === '--force') result.force = true;
    else if (arg === '--out') { result.out = optionValue(argv, i, arg); i += 1; }
    else if (arg === '--viewport') { result.viewport = parseViewport(optionValue(argv, i, arg)); i += 1; }
    else if (arg === '--max-bytes') { result.maxBytes = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-tokens') { result.maxTokens = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-attributes') { result.maxAttributes = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-nesting') { result.maxNesting = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-layout-items') { result.maxLayoutItems = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-layout-text') { result.maxLayoutTextChars = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-canvas-height') { result.maxCanvasHeight = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg.startsWith('--')) throw Object.assign(new Error('unknown option: ' + arg), { code: 'UNKNOWN_OPTION' });
    else if (result.input === null) result.input = arg;
    else throw Object.assign(new Error('unexpected argument: ' + arg), { code: 'UNEXPECTED_ARGUMENT' });
  }
  if (command !== 'profile' && result.input === null) throw Object.assign(new Error(command + ' requires a local file or -'), { code: 'MISSING_INPUT' });
  if (command === 'profile' && result.input !== null) throw Object.assign(new Error('profile does not accept an input'), { code: 'UNEXPECTED_ARGUMENT' });
  if (ARTIFACT_COMMANDS.has(command) && (!result.out || result.out === '-')) {
    throw Object.assign(new Error(command + ' requires an explicit file path after --out'), { code: 'MISSING_OUTPUT' });
  }
  if (!ARTIFACT_COMMANDS.has(command) && (result.out !== null || result.force)) {
    throw Object.assign(new Error('--out and --force are only valid for visual artifact commands'), { code: 'INVALID_ARGUMENT' });
  }
  if (!STRUCTURE_COMMANDS.has(command) && result.viewport !== null) {
    throw Object.assign(new Error('--viewport is only valid for structure-view commands'), { code: 'INVALID_ARGUMENT' });
  }
  return result;
}

function readInput(locator) {
  if (/^https?:\/\//i.test(locator)) {
    throw Object.assign(new Error('network fetching is held in this experimental profile'), { code: 'NETWORK_HELD', locator });
  }
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(locator)) {
    throw Object.assign(new Error('non-file URL schemes are unsupported in this experimental profile'), { code: 'URL_SCHEME_UNSUPPORTED', locator });
  }
  if (locator === '-') return { bytes: fs.readFileSync(0), requestedUrl: 'stdin:' };
  return { bytes: fs.readFileSync(locator), requestedUrl: locator.replace(/\\/g, '/') };
}

function writeArtifact(args, input, content, bundle) {
  const inputPath = input.requestedUrl === 'stdin:' ? null : path.resolve(input.requestedUrl);
  const outputPath = path.resolve(args.out);
  if (inputPath && inputPath === outputPath) {
    throw Object.assign(new Error('output path must not overwrite the input source'), { code: 'OUTPUT_OVERLAPS_INPUT', locator: args.out });
  }
  let stat = null;
  try {
    stat = fs.lstatSync(outputPath);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
  if (stat) {
    if (stat.isSymbolicLink()) throw Object.assign(new Error('refusing to write through a symbolic link'), { code: 'OUTPUT_SYMLINK_HELD', locator: args.out });
    if (stat.isDirectory()) throw Object.assign(new Error('output path is a directory'), { code: 'INVALID_ARGUMENT', locator: args.out });
    if (!args.force) throw Object.assign(new Error('output already exists; pass --force to replace it explicitly'), { code: 'OUTPUT_EXISTS', locator: args.out });
  }
  fs.writeFileSync(outputPath, content, { encoding: 'utf8', flag: args.force ? 'w' : 'wx', mode: 0o644 });
  return {
    schema: 'axm.web.artifact-receipt/v1',
    status: 'EXPERIMENTAL',
    command: args.command,
    artifactKind: args.command === 'render-svg' ? 'image/svg+xml' : 'text/html',
    outputPath: args.out.replace(/\\/g, '/'),
    byteLength: Buffer.byteLength(content, 'utf8'),
    sha256: Digest.sha256Hex(content),
    sourceDigest: bundle.processed.source.sha256,
    pageModelDigest: bundle.processed.pageModel.pageModelDigest,
    layoutDigest: bundle.layout.layoutDigest,
    displayListDigest: bundle.displayList.displayListDigest,
    ledgerDigest: bundle.modificationLedger.ledgerDigest,
    sourceMutated: false,
    activeContent: false,
    networkUsed: false
  };
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
    const options = {
      command: args.command,
      requestedUrl: input.requestedUrl,
      omitSourceBytes: args.omitSourceBytes,
      maxBytes: args.maxBytes,
      maxTokens: args.maxTokens,
      maxAttributes: args.maxAttributes,
      maxNesting: args.maxNesting,
      viewport: args.viewport || undefined,
      maxLayoutItems: args.maxLayoutItems,
      maxLayoutTextChars: args.maxLayoutTextChars,
      maxCanvasHeight: args.maxCanvasHeight,
      requestedBy: 'explicit-cli-request'
    };
    if (ARTIFACT_COMMANDS.has(args.command)) {
      const processed = Engine.processBytes(input.bytes, options);
      const bundle = Engine.deriveStructure(processed, options);
      const content = args.command === 'render-svg'
        ? Svg.renderSvg(bundle.displayList, { title: bundle.layout.chrome.title })
        : BrowserSnapshot.renderBrowserSnapshot(bundle);
      print(writeArtifact(args, input, content, bundle), args.pretty);
      return 0;
    }
    const result = Engine.run(input.bytes, options);
    print(result, args.pretty);
    return 0;
  } catch (error) {
    print(errorEnvelope(error), false, process.stderr);
    return [
      'NETWORK_HELD', 'URL_SCHEME_UNSUPPORTED', 'INVALID_ARGUMENT', 'UNKNOWN_COMMAND', 'UNKNOWN_OPTION',
      'UNEXPECTED_ARGUMENT', 'MISSING_INPUT', 'MISSING_OUTPUT', 'OUTPUT_EXISTS', 'OUTPUT_OVERLAPS_INPUT', 'OUTPUT_SYMLINK_HELD'
    ].includes(error.code) ? 2 : 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { COMMANDS, STRUCTURE_COMMANDS, ARTIFACT_COMMANDS, usage, parseArgs, readInput, writeArtifact, errorEnvelope, main };
