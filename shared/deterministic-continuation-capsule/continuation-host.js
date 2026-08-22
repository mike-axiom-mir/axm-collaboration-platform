'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Core = require('./continuation-core');

function publicError(error) {
  return String(error && (error.message || error) || 'unknown continuation-capsule failure')
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*/gi, '[private-key-redacted]')
    .replace(/\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, '[credential-redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{24,}\b/g, '[credential-redacted]')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[credential-redacted]')
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g, '[credential-redacted]')
    .replace(/https:\/\/[^\s/@:]+:[^\s/@]+@/gi, 'https://[credential-redacted]@')
    .replace(/[A-Za-z]:\\(?:Users|AXM_ACTIVE|AXM_MIRROR_LOCAL)\\[^\s]+/gi, '[local-path]')
    .replace(/\/(?:home|Users)\/[^/\s]+\/[^\s]*/g, '[local-path]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0,1000);
}

function isInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}

function observeSources(options) {
  const declaration = Core.normalizeDeclaration(options.declaration);
  const sourceRoot = fs.realpathSync(path.resolve(options.sourceRoot));
  if (!fs.statSync(sourceRoot).isDirectory()) throw new TypeError('sourceRoot must be a directory');
  let totalBytes = 0;
  return declaration.sources.map(source => {
    const target = path.resolve(sourceRoot, source.inputPath);
    if (!isInside(sourceRoot, target)) throw new TypeError('source path escaped sourceRoot: ' + source.id);
    const parent = fs.realpathSync(path.dirname(target));
    const realTarget = path.join(parent, path.basename(target));
    if (!isInside(sourceRoot, realTarget)) throw new TypeError('source real path escaped sourceRoot: ' + source.id);
    const stat = fs.lstatSync(realTarget);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new TypeError('source must be a regular non-symbolic file: ' + source.id);
    if (stat.size < 1 || stat.size > 20 * 1024 * 1024) throw new TypeError('source size is outside the 1 byte to 20 MiB boundary: ' + source.id);
    totalBytes += stat.size;
    if (totalBytes > 50 * 1024 * 1024) throw new TypeError('combined source size exceeds 50 MiB');
    const bytes = fs.readFileSync(realTarget);
    let schema = null;
    if (source.mediaType === 'application/json') {
      const parsed = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
      schema = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? String(parsed.schema || '') : '';
    }
    return { id:source.id, mediaType:source.mediaType, schema:schema || null, sha256:Core.sha256(bytes), sizeBytes:bytes.length };
  }).sort((a,b) => a.id.localeCompare(b.id));
}

function compile(options) {
  const observations = observeSources(options);
  return Core.buildCapsule({ declaration:options.declaration, observations });
}

function reverify(options) {
  const observations = observeSources(options);
  return Core.reverifyCapsule({ capsule:options.capsule, declaration:options.declaration, observations });
}

module.exports = { publicError, isInside, observeSources, compile, reverify };
