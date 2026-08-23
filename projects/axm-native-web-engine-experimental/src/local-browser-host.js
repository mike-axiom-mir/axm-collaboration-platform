'use strict';

const Digest = require('./digest');
const HostCore = require('./local-browser-host-core');
const ShellPolicy = require('./shell-policy');
const BrowserAiControl = require('./browser-ai-control');
const BrowserAiControlHost = require('./browser-ai-control-host');
const HtmlLiveBuilderHost = require('./html-live-builder-host');
const ReferenceLabModule = require('./reference-lab');
const ReferenceLabHost = require('./reference-lab-host');

const HOST_RECEIPT_SCHEMA = 'axm.web.local-browser-host-receipt/v2';

function currentSourceText(session) {
  const snapshot = session.snapshot();
  const pageId = snapshot.state.current.pageId;
  const record = Array.isArray(session.records)
    ? session.records.find(function (candidate) { return candidate.pageId === pageId; })
    : null;
  return record && Buffer.isBuffer(record.bytes) ? record.bytes.toString('utf8') : '<!doctype html>\n<html><head><title>AXM Builder Draft</title></head><body><main><h1>AXM Builder Draft</h1><p>Start editing.</p></main></body></html>\n';
}

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
  const shouldStartBuilderHost = options.builderEnabled === true;
  const shouldStartReferenceLab = options.referenceLab === true || Boolean(options.referenceConfig || options.referenceLabInstance);
  let aiControlHost = null;
  let builderHost = null;
  let referenceLab = null;
  let referenceHost = null;
  try {
    if (shouldStartAiControlHost) {
      aiControlHost = await BrowserAiControlHost.createBrowserAiControlHost(
        session,
        aiControl,
        options.aiControlHostOptions || {}
      );
    }
    if (shouldStartBuilderHost) {
      builderHost = await HtmlLiveBuilderHost.createHtmlLiveBuilderHost(
        options.builderInitialSource == null ? currentSourceText(session) : String(options.builderInitialSource),
        options.builderHostOptions || {}
      );
    }
    if (shouldStartReferenceLab) {
      const config = options.referenceConfig || {};
      referenceLab = options.referenceLabInstance || new ReferenceLabModule.ReferenceLab({
        aiRegistry: aiControl.registry,
        aiRegistryProvider: function () { return aiControl.registry; },
        visualStateProvider: function () { return aiControl.ensureVisualState(session.snapshot()); },
        searchConfig: config.searchConfig || (options.researchConfig && options.researchConfig.searchConfig) || {},
        imageSearchConfig: config.imageSearchConfig || config.searchConfig || (options.researchConfig && options.researchConfig.searchConfig) || {},
        aiNetworkAuthority: config.aiNetworkAuthority,
        searchNetworkAuthority: config.searchNetworkAuthority,
        aiOptions: config.aiOptions || {},
        searchOptions: config.searchOptions || {},
        imageSearchOptions: config.imageSearchOptions || {}
      });
      referenceHost = await ReferenceLabHost.createReferenceLabHost(referenceLab, {
        port: config.port,
        maxJsonBytes: config.maxJsonBytes,
        maxUploadBytes: config.maxUploadBytes
      });
    }
  } catch (error) {
    if (referenceHost) await referenceHost.close().catch(function () {});
    if (builderHost) await builderHost.close().catch(function () {});
    if (aiControlHost) await aiControlHost.close().catch(function () {});
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
    builderReceipt: builderHost ? builderHost.receipt : null,
    builderUrl: builderHost ? builderHost.receipt.builderUrl : null,
    referenceLab,
    referenceLabHost: referenceHost,
    referenceLabUrl: referenceHost ? referenceHost.url : null,
    referenceLabReceipt: referenceHost ? referenceHost.receipt : null,
    controlState: function () { return aiControl.state(session.snapshot()); },
    visualState: function () { return aiControl.ensureVisualState(session.snapshot()); },
    close: async function () {
      if (referenceHost) await referenceHost.close();
      if (builderHost) await builderHost.close();
      if (aiControlHost) await aiControlHost.close();
      await host.close();
    }
  };
}

module.exports = Object.assign({}, HostCore, {
  HOST_RECEIPT_SCHEMA,
  currentSourceText,
  createLocalBrowserHost
});
