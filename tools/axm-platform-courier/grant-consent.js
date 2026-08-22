#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Service = require('../../shared/operations/platform-courier-service');

if (!process.argv.includes('--confirm')) {
  console.error('Refused: rerun with --confirm after the local human explicitly grants a connected platform AXM read + deterministic-hand access.');
  process.exit(2);
}
const root = path.resolve(__dirname, '..', '..');
const stateRoot = path.join(root, 'state', 'axm-platform-courier');
const file = path.join(stateRoot, 'consent.json');
fs.mkdirSync(stateRoot, { recursive:true });
const value = {
  schema:Service.CONSENT_SCHEMA,
  granted:true,
  actor:'local-user-via-fallback-script',
  subject:'Selected AI platform via shared AXM courier files',
  grantedAt:new Date().toISOString(),
  expiresAt:null,
  scopes:[Service.READ_SCOPE, Service.HAND_SCOPE],
  boundaries:{ platformMutations:false, arbitraryShell:false, remoteUrls:false, secrets:false }
};
const temporary = file + '.' + process.pid + '.tmp';
fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', 'utf8');
fs.renameSync(temporary, file);
console.log('Granted bounded AXM Platform Courier access:', file);
console.log('Scopes:', value.scopes.join(', '));
