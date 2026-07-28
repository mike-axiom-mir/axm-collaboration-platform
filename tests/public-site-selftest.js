#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));
const checks = [];
const check = (name, condition) => checks.push({ name, ok: Boolean(condition) });

const html = read('site/index.html');
const css = read('site/styles.css');
const config = read('site/config.js');
const workflow = read('.github/workflows/pages.yml');
const packageFacts = JSON.parse(read('site/public-package.json'));

check('static entry exists', exists('site/index.html'));
check('static stylesheet exists', exists('site/styles.css'));
check('brand mark exists', exists('site/assets/axm-mark.svg'));
check('current public visuals exist', [
  'axm-workshop-world-v4.webp',
  'axm-journey-enter-v4.webp',
  'axm-journey-export-v4.webp',
  'axm-community-constellation-v4.webp',
  'axm-workshop-social-v4.jpg'
].every(name => exists('site/assets/' + name)));
check('public release pointer exists', exists('site/public-package.json'));
check('Jekyll is disabled', exists('site/.nojekyll'));
check('page has one primary heading', (html.match(/<h1\b/gi) || []).length === 1);
check('page declares the local-runtime boundary', /website is a doorway/i.test(html) && /Workshop lives with you/i.test(html));
check('download routes use the experimental release asset', html.includes(packageFacts.archive.url) && config.includes(packageFacts.archive.url));
check('download routes do not use a moving main archive', !/archive\/refs\/heads\/main\.zip/.test(html + config));
check('release pointer binds tag and checksum asset', packageFacts.release_tag === 'v0.4.1-experimental' && /\.sha256$/.test(packageFacts.archive.sha256_url));
check('release boundaries remain honest', packageFacts.status === 'EXPERIMENTAL' && packageFacts.evidence.warnings_remain_visible === true);
check('site does not imply an ungranted license', !/\bFree software\b|\bUse it freely\b/.test(html));
check('site does not hard-code a module count', !/\b\d+\s+(?:tool\s+)?modules\b/i.test(html));
check('internal navigation targets exist', [...html.matchAll(/href="#([^"]+)"/g)].every(([, id]) => new RegExp('id=["\\\']' + id + '["\\\']').test(html)));
check('responsive rules are present', /@media\s*\(/.test(css));
check('Pages deploys only from main', /branches:\s*\[main\]/.test(workflow));
check('Pages artifact is limited to the static site', /path:\s*site\b/.test(workflow));
check('official Pages actions are used', [
  'actions/configure-pages@v5',
  'actions/upload-pages-artifact@v3',
  'actions/deploy-pages@v4'
].every(action => workflow.includes(action)));

for (const result of checks) console.log((result.ok ? 'PASS' : 'FAIL') + ' ' + result.name);
const failures = checks.filter(result => !result.ok);
if (failures.length) {
  console.error('Public site self-test failed: ' + failures.length + ' check(s).');
  process.exit(1);
}
console.log('Public site self-test passed: ' + checks.length + '/' + checks.length + '.');
