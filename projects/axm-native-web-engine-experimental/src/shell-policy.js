'use strict';

const Digest = require('./digest');
const LocalBrowserHost = require('./local-browser-host');

const SHELL_POLICY_SCHEMA = 'axm.web.local-browser-shell-policy/v1';

function buildShellPolicy() {
  const headers = LocalBrowserHost.securityHeaders();
  const material = {
    schema: SHELL_POLICY_SCHEMA,
    status: 'EXPERIMENTAL',
    bindAddress: '127.0.0.1',
    capabilityTokenBytes: 24,
    mutationOriginPolicy: 'EXACT_SHELL_ORIGIN_REQUIRED',
    allowedMethods: ['GET', 'POST'],
    controllerCspHash: 'sha256-' + LocalBrowserHost.controllerHash(),
    contentSecurityPolicy: LocalBrowserHost.contentSecurityPolicy(),
    responseSecurityHeaders: {
      cacheControl: headers['Cache-Control'],
      crossOriginOpenerPolicy: headers['Cross-Origin-Opener-Policy'],
      crossOriginResourcePolicy: headers['Cross-Origin-Resource-Policy'],
      permissionsPolicy: headers['Permissions-Policy'],
      referrerPolicy: headers['Referrer-Policy'],
      xContentTypeOptions: headers['X-Content-Type-Options'],
      xFrameOptions: headers['X-Frame-Options']
    },
    externalNetworkUsed: false,
    pageScriptExecuted: false,
    authority: {
      mutationAllowed: false,
      networkAuthorityGranted: false,
      installAllowed: false,
      promotionAllowed: false,
      canonAllowed: false
    }
  };
  return Object.assign({}, material, { policyDigest: Digest.canonicalDigest(material) });
}

module.exports = {
  SHELL_POLICY_SCHEMA,
  buildShellPolicy
};
