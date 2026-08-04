#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const Audit = require('../scripts/accessibility-static-audit.js');

function page(body) {
  return '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"></head><body>' + body + '</body></html>';
}
function formFindings(body) {
  return Audit.auditMarkup(page(body), 'fixture.html').filter(item => item.code === 'FORM_NAME_MISSING');
}

assert.deepEqual(formFindings('<label>Claim<textarea class="claim-text"></textarea></label>'), []);
assert.deepEqual(formFindings('<label for="named">Claim</label><textarea id="named"></textarea>'), []);
assert.deepEqual(formFindings('<input aria-label="Search">'), []);
assert.equal(formFindings('<input placeholder="Placeholder is not a name">').length, 1);
assert.equal(formFindings('<label>Invalid pair<input><select></select></label>').length, 2);

const desk = path.join(__dirname, '..', 'tools', 'evidence-desk', 'index.html');
assert.equal(Audit.auditHtml(desk).filter(item => item.code === 'FORM_NAME_MISSING').length, 0);

console.log('PASS accessibility static audit: implicit, explicit and ARIA names distinguished conservatively');
