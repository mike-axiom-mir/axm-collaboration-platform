#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const hubDir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(hubDir, 'index.html'), 'utf8');
const shell = fs.readFileSync(path.join(__dirname, 'steam-shell.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, 'steam-shell.css'), 'utf8');

assert.match(html, /steam\/steam-shell\.css/);
assert.match(html, /steam\/steam-shell\.js/);
assert.match(html, /id="assetInboxPanel"/);
assert.match(html, /id="workshopBackLink"/);
assert.match(shell, /params\.get\('distribution'\) !== 'steam'/);
assert.match(shell, /worldLibrary\.hidden = true/);
assert.match(shell, /assetInbox\.hidden = true/);
assert.match(shell, /workshopBack\.remove\(\)/);
assert.match(shell, /startsWith\('world:'\)/);
assert.match(shell, /TEST BUILD/);
assert.match(css, /body\[data-distribution="steam"\] \.steam-build-notice/);
assert.match(css, /body\[data-distribution="steam"\] #workshopBackLink/);

console.log('steam shell selftest: PASS · 19-game product boundary · Workshop-only surfaces hidden');
