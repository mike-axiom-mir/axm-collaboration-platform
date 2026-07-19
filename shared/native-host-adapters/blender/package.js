'use strict';

const fs = require('fs');
const path = require('path');
const PackageCodec = require('../package-codec');

function template(root) {
  root = path.resolve(root || __dirname);
  const value = JSON.parse(fs.readFileSync(path.join(root, 'package-template.json'), 'utf8'));
  value.entrypoint.sha256 = PackageCodec.sha256File(path.join(root, value.entrypoint.path));
  delete value.integrity;
  delete value.signature;
  return value;
}

function seal(root, keyId, privateKey) {
  return PackageCodec.seal(template(root), keyId, privateKey);
}

module.exports = { template, seal };
