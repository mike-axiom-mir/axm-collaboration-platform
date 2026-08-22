'use strict';

const Composer = require('./declarative-blueprint-composer-v1');

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key || !key.startsWith('--') || value == null || value.startsWith('--')) throw new Error('arguments must be --key value pairs');
    const name = key.slice(2);
    if (Object.prototype.hasOwnProperty.call(values, name)) throw new Error('duplicate argument: ' + key);
    values[name] = value;
  }
  const allowed = ['allowed-parent', 'root-name', 'acknowledge'];
  const extra = Object.keys(values).filter((key) => !allowed.includes(key));
  if (extra.length) throw new Error('unsupported arguments: ' + extra.join(', '));
  if (!allowed.every((key) => Object.prototype.hasOwnProperty.call(values, key))) {
    throw new Error('required: --allowed-parent PATH --root-name NAME --acknowledge "' + Composer.ACKNOWLEDGEMENT + '"');
  }
  return values;
}

function run(argv) {
  const values = parseArguments(argv);
  if (values.acknowledge !== Composer.ACKNOWLEDGEMENT) throw new Error('exact bounded acknowledgement is required');
  const input = Composer.buildExampleInput();
  input.authorization.acknowledgement = values.acknowledge;
  const result = Composer.emit(input, {
    allowedParent: values['allowed-parent'],
    rootName: values['root-name'],
    faultAt: null
  });
  process.stdout.write(JSON.stringify(result.receipt, null, 2) + '\n');
  return result;
}

if (require.main === module) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write('Blueprint composer refused: ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { parseArguments, run };
