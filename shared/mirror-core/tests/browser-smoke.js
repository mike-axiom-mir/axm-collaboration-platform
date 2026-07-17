#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { MirrorCore, MIKE_ID, AI_ID } = require('../core/mirror-core');
const { createMirrorServer } = require('../server/server');
const { ROOT, proposalInput, createApproved } = require('./helpers');

async function main() {
  let chromium;
  try {
    chromium = require('playwright').chromium;
  } catch (error) {
    process.stdout.write(JSON.stringify({ status: 'UNRUN', reason: 'Playwright is not available: ' + error.message }, null, 2) + '\n');
    return;
  }
  const executable = chromium.executablePath();
  if (!fs.existsSync(executable)) {
    process.stdout.write(JSON.stringify({
      status: 'UNRUN',
      reason: 'Playwright is installed but no Chromium executable is present in this local environment.',
      expected_executable: executable,
      checks_completed: false
    }, null, 2) + '\n');
    return;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-mirror-browser-'));
  const core = new MirrorCore({ rootDir: ROOT, runtimeDir: path.join(dir, 'runtime') });
  core.reset();
  core.importAuthorizedSnapshot('adapter:mock:world', MIKE_ID);

  const reviewPacket = core.createProposal(proposalInput({ intent: 'Browser review parity packet' }));
  core.validateProposal(reviewPacket.packet_id, AI_ID);
  core.propose(reviewPacket.packet_id, AI_ID);
  core.review(reviewPacket.packet_id, MIKE_ID, 'Leave in review for browser controls.');

  const rollbackPacket = createApproved(core, { intent: 'Browser applied and rolled back packet' });
  const applied = core.apply(rollbackPacket.packet_id, MIKE_ID);
  core.verify(applied.receipt.application_id, MIKE_ID);
  core.rollback(applied.receipt.application_id, MIKE_ID);

  const app = createMirrorServer({ core, port: 0 });
  const info = await app.start();
  let browser;
  const consoleErrors = [];
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('console', function (message) {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', function (error) { consoleErrors.push(error.message); });
    const response = await page.goto(info.url, { waitUntil: 'networkidle' });
    if (!response || !response.ok()) throw new Error('dashboard navigation failed');
    await page.locator('#statusCards .status-card').first().waitFor({ state: 'visible' });

    const reviewCard = page.locator('.proposal-card').filter({ hasText: 'Browser review parity packet' });
    await reviewCard.click();
    await page.locator('#proposalStatus').filter({ hasText: 'UNDER_REVIEW' }).waitFor();
    const checks = {
      dashboard_loaded: await page.locator('h1').filter({ hasText: 'Mirror Core' }).isVisible(),
      diff_visible: (await page.locator('#reviewDiff').textContent()).includes('changed'),
      approve_visible: await page.getByRole('button', { name: 'Approve proposal' }).isVisible(),
      reject_visible: await page.getByRole('button', { name: 'Reject proposal' }).isVisible(),
      source_visible: (await page.locator('#reviewSource').textContent()) === 'mock-world',
      truth_facets_visible: (await page.locator('#entities').textContent()).includes('schema_valid') && (await page.locator('#entities').textContent()).includes('proposal_only')
    };

    const rolledCard = page.locator('.proposal-card').filter({ hasText: 'Browser applied and rolled back packet' });
    await rolledCard.click();
    await page.locator('#proposalStatus').filter({ hasText: 'ROLLED_BACK' }).waitFor();
    checks.applied_result_visible = (await page.locator('#events').textContent()).includes('apply_completed');
    checks.rollback_visible = (await page.locator('#events').textContent()).includes('rollback_completed') && (await page.locator('#proposalStatus').textContent()) === 'ROLLED_BACK';
    checks.no_critical_console_errors = consoleErrors.length === 0;

    const result = {
      status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
      browser: 'Playwright Chromium',
      checks,
      console_errors: consoleErrors
    };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.status !== 'PASS') process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await app.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch(function (error) {
  process.stderr.write('BROWSER SMOKE FAIL: ' + error.stack + '\n');
  process.exitCode = 1;
});
