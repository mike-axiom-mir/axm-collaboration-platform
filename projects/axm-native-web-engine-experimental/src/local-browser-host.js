'use strict';

const Digest = require('./digest');
const HostCore = require('./local-browser-host-core');
const ShellPolicy = require('./shell-policy');
const BrowserAiControl = require('./browser-ai-control');

const HOST_RECEIPT_SCHEMA = 'axm.web.local-browser-host-receipt/v2';

async function createLocalBrowserHost(session, options) {
  options = options || {};
  const host = await HostCore.createLocalBrowserHost(session, options);
  const shellPolicy = ShellPolicy.buildShellPolicy();
  const aiControl = options.aiControlPlane || new BrowserAiControl.LocalBrowserAiControl({
    aiRegistry: options.aiRegistry,
    researchRunner: options.researchRunner,
    researchConfig: options.researchConfig
  });
  const receiptMaterial = Object.assign({}, host.receipt, {
    schema: HOST_RECEIPT_SCHEMA,
    shellPolicySchema: shellPolicy.schema,
    shellPolicyDigest: shellPolicy.policyDigest
  });
  delete receiptMaterial.receiptDigest;
  const receipt = Object.assign({}, receiptMaterial, {
    receiptDigest: Digest.canonicalDigest(receiptMaterial)
  });
  return {
    server: host.server,
    receipt,
    shellPolicy,
    aiControl,
    controlState: function () { return aiControl.state(session.snapshot()); },
    visualState: function () { return aiControl.ensureVisualState(session.snapshot()); },
    close: host.close
  };
}

module.exports = Object.assign({}, HostCore, {
  HOST_RECEIPT_SCHEMA,
  createLocalBrowserHost
});
