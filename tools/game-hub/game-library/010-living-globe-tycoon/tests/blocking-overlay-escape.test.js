#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'runtime', 'game', 'index.html'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'runtime', 'game', 'core', 'steward-panel.js'), 'utf8');
const brief = fs.readFileSync(path.join(root, 'runtime', 'game', 'core', 'steward-infographics.js'), 'utf8');

assert.match(html, /id="start"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="startTitle"/);
assert.match(html, /id="enterWorld"[^>]*type="button"[^>]*autofocus/);
assert.match(html, /function enter\(\)\{ if\(entered\)return; entered=true; startEl\.style\.display='none'; startEl\.setAttribute\('aria-hidden','true'\)/);

const keyHandler = html.slice(html.indexOf("addEventListener('keydown',e=>{"), html.indexOf("addEventListener('keyup',e=>{"));
assert.match(keyHandler, /if\(e\.key==='Escape'&&!entered\)\{ e\.preventDefault\(\); enter\(\); return; \}/);
assert.ok(keyHandler.indexOf("e.key==='Escape'") < keyHandler.indexOf("closest('input,select,textarea,button,.axm-steward-panel')"), 'entry Escape must run before the focused-button guard');
assert.match(html, /addEventListener\('axm-palace-open',[\s\S]*?player\.keys=\{\}[\s\S]*?exitPointerLock/);

assert.match(panel, /panel\.setAttribute\('role', 'dialog'\)/);
assert.match(panel, /panel\.setAttribute\('aria-modal', 'true'\)/);
assert.match(panel, /panel\.setAttribute\('aria-hidden', 'true'\)/);
assert.match(panel, /function open\(syncNative\)[\s\S]*?aria-hidden', 'false'[\s\S]*?closeButton\.focus\(\)/);
assert.match(panel, /function close\(focusToggle\)[\s\S]*?aria-hidden', 'true'[\s\S]*?if \(focusToggle\) toggle\.focus\(\)/);
assert.match(panel, /event\.key === 'Escape'[\s\S]*?event\.preventDefault\(\); close\(true\)/);
const palaceEscapeHandler = panel.match(/root\.addEventListener\('keydown', function \(event\) \{ if \(event\.key === 'Escape'[\s\S]*?\} \}\);/)[0];
assert.doesNotMatch(palaceEscapeHandler, /bridge\.(?:advanceQuarter|issueEdict|resolveDilemma|applyApprovedProposal)/);

assert.match(brief, /panel\.setAttribute\('aria-hidden', 'true'\)/);
assert.match(brief, /event\.key === 'Escape'[\s\S]*?event\.preventDefault\(\); close\(true\)/);
assert.match(brief, /root\.addEventListener\('axm-palace-open', function \(\) \{ close\(false\); \}\)/);

console.log('Living Globe Tycoon blocking overlay Escape test: PASS');
