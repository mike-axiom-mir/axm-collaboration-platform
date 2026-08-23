'use strict';

const Digest = require('./digest');
const HostCore = require('./local-browser-host-core');
const ShellPolicy = require('./shell-policy');
const BrowserAiControl = require('./browser-ai-control');
const BrowserAiControlHost = require('./browser-ai-control-host');

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
  const shouldStartAiControlHost = options.aiControlHost === true || (
    options.aiControlHost !== false && Boolean(options.aiRegistry || options.aiControlPlane || options.researchRunner || options.researchConfig)
  );
  let aiControlHost = null;
  try {
    if (shouldStartAiControlHost) {
      aiControlHost = await BrowserAiControlHost.createBrowserAiControlHost(
        session,
        aiControl,
        options.aiControlHostOptions || {}
      );
    }
  } catch (error) {
    await host.close();
    throw error;
  }
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
    aiControlReceipt: aiControlHost ? aiControlHost.receipt : null,
    aiControlUrl: aiControlHost ? aiControlHost.receipt.controlUrl : null,
    controlState: function () { return aiControl.state(session.snapshot()); },
    visualState: function () { return aiControl.ensureVisualState(session.snapshot()); },
    close: async function () {
      if (aiControlHost) await aiControlHost.close();
      await host.close();
    }
  };
}

module.exports = Object.assign({}, HostCore, {
  HOST_RECEIPT_SCHEMA,
  createLocalBrowserHost
});
