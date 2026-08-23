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
const BrowserSession = require('./src/browser-session');
const LocalBrowserHost = require('./src/local-browser-host');

const COMMANDS = new Set(['tokenize', 'parse', 'inspect', 'full', 'outline', 'layout', 'display', 'render-svg', 'browser-snapshot', 'session', 'serve-local', 'profile']);
const STRUCTURE_COMMANDS = new Set(['outline', 'layout', 'display', 'render-svg', 'browser-snapshot']);
const VIEWPORT_COMMANDS = new Set(['layout', 'display', 'render-svg', 'browser-snapshot']);
const ARTIFACT_COMMANDS = new Set(['render-svg', 'browser-snapshot']);
const SESSION_COMMANDS = new Set(['session', 'serve-local']);

function usage() {
  return [
    'AXM Web — EXPERIMENTAL offline semantic + structure-view proof',
    '',
    'Usage:',
    '  node cli.js tokenize <file|-> [--pretty] [--omit-source-bytes]',
    '  node cli.js parse <file|-> [--pretty] [--omit-source-bytes]',
    '  node cli.js inspect <file|-> [--pretty] [--omit-source-bytes]',
    '  node cli.js full <file|-> [--pretty] [--omit-source-bytes]',
    '  node cli.js outline <file|-> [--pretty] [--omit-source-bytes]',
    '  node cli.js layout <file|-> [--viewport 1120x760] [--pretty]',
    '  node cli.js display <file|-> [--viewport 1120x760] [--pretty]',
    '  node cli.js render-svg <file|-> --out <file.svg> [--viewport 1120x760] [--force]',
    '  node cli.js browser-snapshot <file|-> --out <file.html> [--viewport 1120x760] [--force]',
    '  node cli.js session <entry-file> [--allow-local <file>] [--action <action>] [--pretty]',
    '  node cli.js serve-local <entry-file> [--allow-local <file>] [--port 0]',
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
    '  --max-pages <n>       default 16 explicitly allowed local pages',
    '  --max-history <n>     default 128 local history entries',
    '  --max-session-bytes <n> default 4194304 combined source bytes',
    '',
    'Session actions: activate:entry-0001, open:local/path.html, back, forward,',
    'reload, focus:entry-0001, or scroll:entry-0001. Repeat --action in order.',
    'serve-local binds only to 127.0.0.1 and prints an ephemeral shell URL.',
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

function parsePort(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 65535) {
    throw Object.assign(new Error('--port requires an integer from 0 to 65535'), { code: 'INVALID_ARGUMENT' });
  }
  return number;
}

function parseSessionAction(value) {
  const text = String(value || '');
  if (['back', 'forward', 'reload'].includes(text)) return { type: text };
  const match = /^(activate|open|focus|scroll):(.+)$/.exec(text);
  if (!match) {
    throw Object.assign(new Error('--action requires activate:ENTRY, open:LOCATOR, back, forward, reload, focus:ENTRY, or scroll:ENTRY'), { code: 'INVALID_ARGUMENT' });
  }
  if (match[1] === 'open') return { type: 'open-locator', locator: match[2] };
  if (match[1] === 'activate') return { type: 'activate', entryRef: match[2] };
  return { type: match[1] + '-entry', entryRef: match[2] };
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
  const result = {
    command,
    input: null,
    pretty: false,
    omitSourceBytes: false,
    out: null,
    force: false,
    viewport: null,
    allowedInputs: [],
    actions: [],
    port: null
  };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--pretty') result.pretty = true;
    else if (arg === '--omit-source-bytes') result.omitSourceBytes = true;
    else if (arg === '--force') result.force = true;
    else if (arg === '--out') { result.out = optionValue(argv, i, arg); i += 1; }
    else if (arg === '--viewport') { result.viewport = parseViewport(optionValue(argv, i, arg)); i += 1; }
    else if (arg === '--allow-local') { result.allowedInputs.push(optionValue(argv, i, arg)); i += 1; }
    else if (arg === '--action') { result.actions.push(parseSessionAction(optionValue(argv, i, arg))); i += 1; }
    else if (arg === '--port') { result.port = parsePort(optionValue(argv, i, arg)); i += 1; }
    else if (arg === '--max-bytes') { result.maxBytes = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-tokens') { result.maxTokens = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-attributes') { result.maxAttributes = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-nesting') { result.maxNesting = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-layout-items') { result.maxLayoutItems = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-layout-text') { result.maxLayoutTextChars = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-canvas-height') { result.maxCanvasHeight = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-pages') { result.maxPages = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-history') { result.maxHistory = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
    else if (arg === '--max-session-bytes') { result.maxTotalBytes = parseInteger(optionValue(argv, i, arg), arg); i += 1; }
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
  if (!VIEWPORT_COMMANDS.has(command) && result.viewport !== null) {
    throw Object.assign(new Error('--viewport is only valid for structure-view commands'), { code: 'INVALID_ARGUMENT' });
  }
  if (!SESSION_COMMANDS.has(command) && (result.allowedInputs.length || result.actions.length || result.maxPages || result.maxHistory || result.maxTotalBytes)) {
    throw Object.assign(new Error('local session options are only valid for session and serve-local'), { code: 'INVALID_ARGUMENT' });
  }
  if (command !== 'serve-local' && result.port !== null) {
    throw Object.assign(new Error('--port is only valid for serve-local'), { code: 'INVALID_ARGUMENT' });
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
    structureIndexDigest: bundle.structureIndex.structureIndexDigest,
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

function sessionOptions(args) {
  return {
    maxBytes: args.maxBytes,
    maxTokens: args.maxTokens,
    maxAttributes: args.maxAttributes,
    maxNesting: args.maxNesting,
    maxLayoutItems: args.maxLayoutItems,
    maxLayoutTextChars: args.maxLayoutTextChars,
    maxCanvasHeight: args.maxCanvasHeight,
    maxPages: args.maxPages,
    maxHistory: args.maxHistory,
    maxTotalBytes: args.maxTotalBytes
  };
}

function waitForHostShutdown(host) {
  return new Promise(function (resolve, reject) {
    let closing = false;
    async function shutdown() {
      if (closing) return;
      closing = true;
      process.removeListener('SIGINT', shutdown);
      process.removeListener('SIGTERM', shutdown);
      try {
        await host.close();
        resolve();
      } catch (error) {
        reject(error);
      }
    }
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}

async function main(argv) {
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
    if (SESSION_COMMANDS.has(args.command)) {
      const session = new BrowserSession.LocalBrowserSession(args.input, args.allowedInputs, sessionOptions(args));
      args.actions.forEach(function (action) { session.apply(action); });
      if (args.command === 'session') {
        print(session.snapshot(), args.pretty);
        return 0;
      }
      const host = await LocalBrowserHost.createLocalBrowserHost(session, { port: args.port == null ? 0 : args.port });
      print(host.receipt, args.pretty);
      await waitForHostShutdown(host);
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
      'UNEXPECTED_ARGUMENT', 'MISSING_INPUT', 'MISSING_OUTPUT', 'OUTPUT_EXISTS', 'OUTPUT_OVERLAPS_INPUT', 'OUTPUT_SYMLINK_HELD',
      'SESSION_LOCAL_FILE_REQUIRED', 'SESSION_DUPLICATE_PAGE', 'SESSION_PAGE_NOT_FOUND', 'SESSION_PAGE_SYMLINK_HELD',
      'SESSION_PAGE_NOT_FILE', 'SESSION_EMPTY', 'SESSION_PAGE_LIMIT', 'SESSION_BYTES_LIMIT', 'SESSION_INVALID_ACTION',
      'SESSION_LINK_NOT_FOUND', 'SESSION_ENTRY_NOT_FOUND'
    ].includes(error.code) ? 2 : 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) {
    process.exitCode = code;
  }, function (error) {
    print(errorEnvelope(error), false, process.stderr);
    process.exitCode = 1;
  });
}

module.exports = {
  COMMANDS,
  STRUCTURE_COMMANDS,
  VIEWPORT_COMMANDS,
  ARTIFACT_COMMANDS,
  SESSION_COMMANDS,
  usage,
  parsePort,
  parseSessionAction,
  parseArgs,
  readInput,
  writeArtifact,
  errorEnvelope,
  sessionOptions,
  waitForHostShutdown,
  main
};
