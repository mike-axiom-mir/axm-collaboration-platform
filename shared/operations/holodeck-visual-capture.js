'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { CourierCore } = require('../../tools/game-hub/ai-seat-courier/lib/courier-core');

const CAPTURE_SCHEMA = 'axm.platform-courier.holodeck-visual-capture/v1';
const MAX_CAPTURE_FILES = 20;
const MAX_STATE_BYTES = 64 * 1024;
const READY_TIMEOUT_MS = 12000;

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function cleanId(value, fallback) {
  return String(value || fallback || 'capture').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'capture';
}
function boundedViewport(value) {
  return {
    width:Math.max(640, Math.min(1920, Number(value && value.width) || 1280)),
    height:Math.max(480, Math.min(1200, Number(value && value.height) || 720)),
  };
}
function prune(folder, keep, protectedFile) {
  const protectedAbsolute = protectedFile ? path.resolve(protectedFile) : null;
  const files = fs.readdirSync(folder, { withFileTypes:true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.png'))
    .map(entry => {
      const absolute = path.join(folder, entry.name);
      return { absolute, modified:fs.statSync(absolute).mtimeMs };
    })
    .sort((left, right) => right.modified - left.modified);
  files.filter(item => path.resolve(item.absolute) !== protectedAbsolute).slice(Math.max(0, keep - (protectedAbsolute ? 1 : 0))).forEach(item => fs.rmSync(item.absolute, { force:true }));
}
function expressionValue(result) {
  return result && result.result ? result.result.value : undefined;
}

function create(options) {
  options = options || {};
  const workshopRoot = path.resolve(options.workshopRoot);
  const stateRoot = path.resolve(options.stateRoot);
  const captureRoot = path.join(stateRoot, 'holodeck-captures');
  const browserStateRoot = path.join(stateRoot, 'holodeck-visual-browser');
  fs.mkdirSync(captureRoot, { recursive:true });
  fs.mkdirSync(browserStateRoot, { recursive:true });
  let active = false;

  async function capture(input) {
    if (active) throw new Error('one Holodeck visual capture is already active');
    active = true;
    const core = new CourierCore({ workshopRoot, stateRoot:browserStateRoot });
    core.captureRoot = captureRoot;
    let browser = null;
    try {
      const port = Number(typeof options.getPort === 'function' ? options.getPort() : options.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('current AXM server port is unavailable for Holodeck capture');
      const stateText = JSON.stringify(input.state);
      if (Buffer.byteLength(stateText, 'utf8') > MAX_STATE_BYTES) throw new Error('Holodeck capture state exceeds 64 KiB');
      const viewport = boundedViewport(input.viewport);
      const target = new URL('http://127.0.0.1:' + port + '/tools/holodeck-screen-deck/index.html');
      target.searchParams.set('mode', 'courier-capture');
      target.searchParams.set('session', cleanId(input.sessionId, 'platform-echo-atrium'));
      target.searchParams.set('state', Buffer.from(stateText, 'utf8').toString('base64url'));
      browser = await core.startBrowser(target.href, viewport);
      core.browser = browser;

      const deadline = Date.now() + READY_TIMEOUT_MS;
      let ready = false;
      while (Date.now() < deadline) {
        const result = await browser.cdp.call('Runtime.evaluate', {
          expression:"document.documentElement.dataset.courierCapture === 'ready'",
          returnByValue:true,
        });
        if (expressionValue(result) === true) { ready = true; break; }
        await delay(100);
      }
      if (!ready) {
        const detail = await browser.cdp.call('Runtime.evaluate', {
          expression:"document.getElementById('loading-detail') && document.getElementById('loading-detail').textContent",
          returnByValue:true,
        });
        throw new Error('Holodeck Screen Deck did not become capture-ready: ' + String(expressionValue(detail) || 'unknown page state'));
      }

      const proofResult = await browser.cdp.call('Runtime.evaluate', {
        expression:'window.AXMHolodeckDeck.captureProof()',
        returnByValue:true,
      });
      const proof = expressionValue(proofResult);
      if (!proof || proof.stateDigest !== input.state.stateDigest) throw new Error('Holodeck capture proof does not bind to the requested state digest');
      if (!proof.renderer || proof.renderer.renderer !== 'three-r160-webgl' || Number(proof.renderer.drawCalls) < 1) throw new Error('Holodeck WebGL renderer did not report a drawn frame');

      const captureId = cleanId(input.requestId, 'holodeck') + '-' + cleanId(input.sessionId, 'session');
      const absolute = await core.capture(captureId);
      const bytes = fs.readFileSync(absolute);
      prune(captureRoot, MAX_CAPTURE_FILES, absolute);
      return {
        schema:CAPTURE_SCHEMA,
        artifact:{
          mime:'image/png',
          file:absolute,
          courier_file:path.relative(stateRoot, absolute).replace(/\\/g, '/'),
          bytes:bytes.length,
          sha256:sha256(bytes),
          viewport,
        },
        proof,
        truth:{
          actualBrowserPixels:true,
          browser:'local-headless-edge',
          renderer:'three-r160-webgl',
          structuredStateStillAvailable:true,
          arbitraryUrl:false,
          remoteNetwork:false,
        },
      };
    } finally {
      await core.stopSession();
      active = false;
    }
  }

  return { capture, paths:{ captureRoot, browserStateRoot } };
}

module.exports = { create, CAPTURE_SCHEMA, MAX_CAPTURE_FILES, MAX_STATE_BYTES };
