#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AccessibilityAudit = require('../../scripts/accessibility-static-audit');

const publishedManifest = require('./manifest.json');
assert.equal(publishedManifest.schema, 'axm.tool-manifest/v1');
assert.equal(publishedManifest.kind, 'product');

const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

assert.deepStrictEqual(
  AccessibilityAudit.auditHtml(htmlPath).filter(item => item.code === 'FORM_NAME_MISSING'),
  []
);
[
  ['goalJson', 'goalJsonLabel'],
  ['observation', 'observationLabel'],
  ['economics', 'economicsLabel'],
  ['profileSeal', 'profileSealLabel']
].forEach(([controlId, labelId]) => {
  assert(html.includes('id="' + controlId + '" aria-labelledby="' + labelId + '"'), controlId);
  assert(html.includes('id="' + labelId + '"'), labelId);
});
console.log('PASS cognitive resource meter UI · JSON editors use their visible headings as accessible names');

require('../../shared/cognitive-resource/selftest.js');
