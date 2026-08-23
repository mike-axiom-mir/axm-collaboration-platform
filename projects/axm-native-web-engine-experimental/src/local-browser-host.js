'use strict';

const Digest = require('./digest');
const HostCore = require('./local-browser-host-core');
const ShellPolicy = require('./shell-policy');

async function createLocalBrowserHost(session, options) {
  const host = await HostCore.createLocalBrowserHost(session, options);
  const shellPolicy = ShellPolicy.buildShellPolicy();
  const receiptMaterial = Object.assign({}, host.receipt, {
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
    close: host.close
  };
}

module.exports = Object.assign({}, HostCore, {
  createLocalBrowserHost
});
