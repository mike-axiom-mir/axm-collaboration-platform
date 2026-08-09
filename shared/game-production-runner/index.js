'use strict';

module.exports = Object.freeze({
  canonical: require('./canonical'),
  contracts: require('./contracts'),
  compiler: require('./compiler'),
  runner: require('./runner'),
  stepReceipts: require('./step-receipt-contract'),
  artifactCache: require('./artifact-cache'),
  confinement: require('./permission-substrate'),
  adapters: require('./axm-adapters'),
  fixtures: require('./fixture-registry'),
  proofyard: require('./proofyard-foundation'),
  portable: require('./portable-profile'),
  portableFixture: require('./portable-profile-fixture'),
  documentRegistry: require('./document-profile-registry'),
  portableDocuments: require('./portable-document-profile')
});
