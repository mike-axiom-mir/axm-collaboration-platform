'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, '..', 'runtime', 'lumenwake-client.html');
const client = fs.readFileSync(clientPath, 'utf8');

function functionBody(name) {
  const marker = 'function ' + name + '(';
  const start = client.indexOf(marker);
  assert.notEqual(start, -1, name + ' must exist');
  const brace = client.indexOf('{', start);
  let depth = 0;
  for (let index = brace; index < client.length; index += 1) {
    if (client[index] === '{') depth += 1;
    if (client[index] === '}') {
      depth -= 1;
      if (depth === 0) return client.slice(start, index + 1);
    }
  }
  assert.fail(name + ' must have a complete function body');
}

assert.match(client, /id="sessionMenu"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*hidden/);
assert.match(client, /id="sessionMenuReturn"[^>]*type="button"/);
assert.match(client, /\.session-menu\[hidden\]\{display:none\}/);
assert.match(client, /body\.phone [^{]*\.session-menu/);

const update = functionBody('updateSessionMenu');
const neutralize = functionBody('neutralizeLocalInput');
const open = functionBody('openSessionMenu');
const close = functionBody('closeSessionMenu');
const sendInput = functionBody('sendInput');
const keyboard = client.slice(
  client.indexOf("addEventListener('keydown'"),
  client.indexOf('function stick()')
);

assert.match(update, /server-authoritative world remains live/);
assert.match(update, /authoritative ready gate remains in place/);
assert.match(update, /authoritative countdown continues/);
assert.match(update, /authoritative result remains in place/);
assert.match(open, /neutralizeLocalInput\(\)/);
assert.match(open, /sessionMenuReturn'\)\.focus\(\)/);
assert.match(close, /sessionMenu'\)\.hidden=true/);
assert.match(neutralize, /post\('input\?player='/);
assert.doesNotMatch(neutralize + open + close + update, /post\('(start|restart|map)'/);
assert.match(sendInput, /if\(!state\|\|menuOpen\)return/);
assert.ok(keyboard.indexOf("e.code==='Escape'") < keyboard.indexOf('keys[e.code]=true'), 'Escape must be intercepted before gameplay/start keys');
assert.match(keyboard, /if\(menuOpen\)closeSessionMenu\(\);else openSessionMenu\(\)/);
assert.match(client, /\$\('sessionMenuReturn'\)\.onclick=closeSessionMenu/);

console.log('Lumenwake blocking overlay Escape test: PASS');
