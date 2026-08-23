#!/usr/bin/env node
'use strict';

// The Game Night seam already verifies the Hub manifest/contract boundary,
// installed game packages, lobby controls, recovery, and runtime-idle policy.
// Keep one deterministic top-level promotion entrypoint without duplicating it.
require('./game-night-selftest');
