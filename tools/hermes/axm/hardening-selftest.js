'use strict';

const fs = require('fs');
const path = require('path');
const RuntimePolicy = require('./runtime-policy');

const ROOT = path.resolve(__dirname, '..');
let passes = 0;
function check(value, label) { if (!value) throw new Error('FAIL: ' + label); passes += 1; }

const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'axm-policy.example.json'), 'utf8'));
const bootstrap = fs.readFileSync(path.join(ROOT, 'hermes-bootstrap.js'), 'utf8');

check(RuntimePolicy.validatePolicy(policy).ok, 'default v0.4 policy validates');
check(policy.learning.memory_enabled === false && policy.learning.user_profile_enabled === false, 'built-in Hermes memory/profile are off by default');
check(policy.learning.background_review_enabled === false, 'automatic Hermes background review is off by default');
check(policy.learning.memory_write_approval === true && policy.learning.skill_write_approval === true, 'Hermes learning writes are approval-gated by default');
check(policy.limits.max_run_minutes === 15, 'hard wall-clock watchdog defaults to 15 minutes');

check(/HERMES_DISABLE_LAZY_INSTALLS:\s*'1'/.test(bootstrap), 'runtime disables Hermes lazy dependency installation');
check(/HERMES_WRITE_SAFE_ROOT/.test(bootstrap), 'runtime layers Hermes native write-safe-root under AXM gate');
check(/HERMES_REDACT_SECRETS:\s*'true'/.test(bootstrap), 'runtime forces Hermes secret redaction on');
check(/'run', '--no-sync', '--project'/.test(bootstrap), 'Hermes start cannot silently uv-sync packages');
check(!/\['clone', '--no-checkout'/.test(bootstrap), 'installer no longer clones floating branch history');
check(/\['init'\]/.test(bootstrap) && /\['fetch', '--depth', '1', '--no-tags', 'origin', lock\.commit\]/.test(bootstrap), 'installer initializes locally then fetches exact pinned commit only');
check(/OWNED_TOP_LEVEL_KEYS = \['hooks', 'memory', 'skills', 'auxiliary'\]/.test(bootstrap), 'AXM explicitly owns Hermes hooks and learning controls');
check(/memory_enabled:/.test(bootstrap) && /background_review:/.test(bootstrap), 'managed profile emits memory/background-review controls');
check(/max_run_minutes \* 60 \* 1000/.test(bootstrap) && /killSignal: 'SIGTERM'/.test(bootstrap), 'launcher applies wall-clock watchdog');
check(/process_tree_termination_guaranteed/.test(fs.readFileSync(path.join(__dirname, 'run-ledger.js'), 'utf8')), 'Return Packet refuses fake process-tree kill guarantee');

console.log('PASS AXM Hermes hardening selftest: ' + passes + ' assertions');
