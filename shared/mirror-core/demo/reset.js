'use strict';

const path = require('path');
const { MirrorCore } = require('../core/mirror-core');

const rootDir = path.resolve(__dirname, '..');
const core = new MirrorCore({ rootDir });
const result = core.reset();
process.stdout.write(JSON.stringify({ ok: true, status: result.status, counts: result.counts }, null, 2) + '\n');
