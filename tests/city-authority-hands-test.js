'use strict';

const Authority = require('../shared/authority-grid/selftest');
const Hands = require('../shared/hands-rail/selftest');

Authority.run();
Hands.run().catch(error => { console.error(error); process.exitCode = 1; });
