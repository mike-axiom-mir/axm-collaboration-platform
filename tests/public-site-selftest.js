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
const app = read('site/app.js');
const workflow = read('.github/workflows/pages.yml');
const packageFacts = JSON.parse(read('site/public-package.json'));
const manifest = JSON.parse(read('site/manifest.webmanifest'));
const sitemap = read('site/sitemap.xml');

const latest = packageFacts.latest_source || {};
const latestArchive = latest.archive || {};
const packaged = packageFacts.packaged_windows || {};
const packagedArchive = packaged.archive || {};

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
check('release pointer uses the split v3 schema', packageFacts.schema === 'axm.public-release-pointer/v3');
check('latest source is the exact current tag',
  latest.release_tag === 'v0.7.0-experimental' &&
  latest.source_ref === 'refs/tags/v0.7.0-experimental' &&
  latest.target_commit === '15870d0c2ea866f6c9d1c88d98e63157397b06f2');
check('latest source archive is exact and GitHub-generated',
  /\/archive\/refs\/tags\/v0\.7\.0-experimental\.zip$/.test(latestArchive.url || '') &&
  latestArchive.provider === 'github-generated' &&
  latestArchive.separate_axm_checksum === false);
check('current packaged Windows build stays explicit',
  packaged.status === 'CURRENT_PACKAGED_BUILD' &&
  packaged.release_tag === 'v0.7.0-experimental' &&
  packaged.recommended_for_latest_source === true &&
  /\.sha256$/.test(packagedArchive.sha256_url || ''));
check('HTML exposes both truthful routes',
  html.includes(latestArchive.url) &&
  html.includes(packagedArchive.url) &&
  /latest reviewed source/i.test(html) &&
  /current packaged Windows build/i.test(html));
check('runtime config exposes both truthful routes',
  config.includes(latest.release_url) &&
  config.includes(latestArchive.url) &&
  config.includes(packaged.release_url) &&
  config.includes(packagedArchive.url) &&
  config.includes(packagedArchive.sha256_url));
check('front-page routing hydrates from config',
  app.includes('[data-latest-source-link]') &&
  app.includes('[data-latest-release-link]') &&
  app.includes('[data-packaged-windows-link]'));
check('download routes do not use a moving main archive',
  !/archive\/refs\/heads\/main\.zip/.test(html + config + JSON.stringify(packageFacts)));
check('release boundaries remain honest',
  packageFacts.status === 'EXPERIMENTAL' &&
  packageFacts.evidence.release_receiver === 'verified' &&
  packageFacts.evidence.warnings_remain_visible === true &&
  packageFacts.evidence.packaged_windows_restore_test === 'passed' &&
  packageFacts.evidence.packaged_windows_clean_launch === 'passed' &&
  packageFacts.evidence.open_repairbuddy_warning_count === 44);
check('site and manifest do not imply an ungranted license',
  !/\bFree software\b|\bUse it freely\b/.test(html) &&
  !/\bfree,\s*local-first\b/i.test(manifest.description || ''));
check('site does not hard-code a module count', !/\b\d+\s+(?:tool\s+)?modules\b/i.test(html));
check('internal navigation targets exist', [...html.matchAll(/href="#([^"]+)"/g)].every(([, id]) => new RegExp('id=["\\\']' + id + '["\\\']').test(html)));
check('social metadata names the reviewed image',
  html.includes('og:site_name') &&
  html.includes('twitter:image') &&
  html.includes('axm-workshop-social-v4.jpg'));
check('responsive rules are present', /@media\s*\(/.test(css));
check('sitemap dates the repaired public routes',
  (sitemap.match(/<lastmod>2026-08-22<\/lastmod>/g) || []).length === 2);
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
