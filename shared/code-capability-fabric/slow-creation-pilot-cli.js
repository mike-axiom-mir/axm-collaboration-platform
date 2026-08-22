'use strict';

const Pilot = require('./slow-creation-pilot-v1');

function parseArguments(argv) {
  const allowed = new Set(['--allowed-parent', '--root-name', '--acknowledge']);
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(flag)) throw new Error('unsupported or misplaced argument');
    if (Object.prototype.hasOwnProperty.call(parsed, flag)) throw new Error('duplicate argument');
    if (typeof value !== 'string' || !value.length || value.startsWith('--')) {
      throw new Error('every pilot argument requires one value');
    }
    parsed[flag] = value;
  }
  for (const flag of allowed) {
    if (!Object.prototype.hasOwnProperty.call(parsed, flag)) throw new Error('missing required argument');
  }
  return parsed;
}

function run(argv) {
  const args = parseArguments(argv);
  if (args['--acknowledge'] !== Pilot.ACKNOWLEDGEMENT) {
    throw new Error('exact one-candidate acknowledgement is required');
  }
  const input = Pilot.buildExampleInput();
  const receipt = Pilot.emit(input, {
    allowedParent: args['--allowed-parent'],
    rootName: args['--root-name'],
    faultAt: null
  });
  process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
}

if (require.main === module) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write('Slow-creation pilot refused: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { parseArguments, run };
