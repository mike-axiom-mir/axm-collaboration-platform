'use strict';

function validMirrorId(value) {
  return /^mir:[a-z0-9._-]+:[a-z0-9._-]+:[a-z0-9._-]+$/.test(String(value || ''));
}

function validActorId(value) {
  return /^actor:[a-z0-9._-]+:[a-z0-9._-]+$/.test(String(value || ''));
}

function validRelationId(value) {
  return /^rel:[a-z0-9._-]+:[a-z0-9._-]+$/.test(String(value || ''));
}

function validMappingId(value) {
  return /^map:[a-z0-9._-]+:[a-z0-9._-]+$/.test(String(value || ''));
}

function endpointKey(systemId, nativeId) {
  return String(systemId || '') + '\u0000' + String(nativeId || '');
}

module.exports = { validMirrorId, validActorId, validRelationId, validMappingId, endpointKey };
