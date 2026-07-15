'use strict';

const ALLOWED_PARTIES = new Set(['party_a', 'party_b', 'all']);

function validatePartyId(partyId) {
  return typeof partyId === 'string' && ALLOWED_PARTIES.has(partyId) ? partyId : null;
}

function buildPartyScreenRoute({ roomCode = 'AXM1', sessionId, partyId }) {
  const party = validatePartyId(partyId);
  if (!party) throw Object.assign(new Error('Unknown party display route.'), { code: 'INVALID_PARTY' });
  if (typeof sessionId !== 'string' || !/^session-[a-f0-9-]{8,80}$/i.test(sessionId)) {
    throw Object.assign(new Error('Invalid session id for display route.'), { code: 'INVALID_SESSION' });
  }
  if (typeof roomCode !== 'string' || !/^AXM[0-9A-Z]{1,8}$/.test(roomCode)) {
    throw Object.assign(new Error('Invalid room code for display route.'), { code: 'INVALID_ROOM' });
  }
  return `/game/?${new URLSearchParams({ room: roomCode, session: sessionId, view: 'party', party }).toString()}`;
}

function validateInternalPartyScreenRoute(route, expected) {
  if (typeof route !== 'string' || !route.startsWith('/') || route.startsWith('//')) {
    return { ok: false, reason: 'route-not-relative' };
  }
  let parsed;
  try {
    parsed = new URL(route, 'http://axm.local');
  } catch {
    return { ok: false, reason: 'route-invalid' };
  }
  if (parsed.origin !== 'http://axm.local' || !['/game', '/game/'].includes(parsed.pathname)) {
    return { ok: false, reason: 'route-not-local-game' };
  }
  if (parsed.searchParams.get('view') !== 'party') return { ok: false, reason: 'wrong-view' };
  if (parsed.searchParams.get('party') !== expected.partyId) return { ok: false, reason: 'wrong-party' };
  if (parsed.searchParams.get('session') !== expected.sessionId) return { ok: false, reason: 'stale-session' };
  if (parsed.searchParams.get('room') !== expected.roomCode) return { ok: false, reason: 'wrong-room' };
  return { ok: true, route: `${parsed.pathname}${parsed.search}` };
}

function getDisplayState(session, partyId) {
  const party = validatePartyId(partyId);
  if (!party) throw Object.assign(new Error('Unknown party display.'), { code: 'INVALID_PARTY' });
  if (!session || session.status !== 'running') {
    return { status: 'waiting', partyId: party, sessionId: null, screenUrl: null, roomCode: 'AXM1' };
  }
  const screenUrl = buildPartyScreenRoute({
    roomCode: session.roomCode,
    sessionId: session.id,
    partyId: party,
  });
  const verified = validateInternalPartyScreenRoute(screenUrl, {
    roomCode: session.roomCode,
    sessionId: session.id,
    partyId: party,
  });
  if (!verified.ok) throw Object.assign(new Error('Generated display route failed validation.'), { code: 'UNSAFE_DISPLAY_ROUTE' });
  return { status: 'running', partyId: party, sessionId: session.id, screenUrl: verified.route, roomCode: session.roomCode };
}

module.exports = {
  ALLOWED_PARTIES,
  buildPartyScreenRoute,
  getDisplayState,
  validateInternalPartyScreenRoute,
  validatePartyId,
};
