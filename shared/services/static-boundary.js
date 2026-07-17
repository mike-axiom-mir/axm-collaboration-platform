'use strict';

const PRIVATE_TOP_LEVEL = Object.freeze([
  '.claude', '.git', 'backups', 'bridge', 'logs', 'node_modules',
  'projects', 'prompts', 'saves', 'state'
]);
const PRIVATE = new Set(PRIVATE_TOP_LEVEL);

function firstSegment(relativePath) {
  return String(relativePath || '').replace(/^[/\\]+/, '').split(/[/\\]/)[0].toLowerCase();
}

function isPrivateStaticPath(relativePath) {
  return PRIVATE.has(firstSegment(relativePath));
}

module.exports = { PRIVATE_TOP_LEVEL, firstSegment, isPrivateStaticPath };
