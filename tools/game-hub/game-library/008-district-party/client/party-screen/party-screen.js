(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const requestedParty = params.get('party') || 'party_a';
  const allowed = new Set(['party_a', 'party_b', 'all']);
  const party = allowed.has(requestedParty) ? requestedParty : 'party_a';
  const waiting = document.getElementById('waiting');
  const frame = document.getElementById('game-frame');
  const label = party === 'all' ? 'All Parties' : party === 'party_b' ? 'Party B' : 'Party A';
  document.getElementById('party-title').textContent = `${label} Screen`;
  let loadedSession = null;

  function safeInternalScreenUrl(value, sessionId, roomCode) {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
    const url = new URL(value, location.origin);
    if (url.origin !== location.origin || !['/game', '/game/'].includes(url.pathname)) return null;
    if (url.searchParams.get('session') !== sessionId) return null;
    if (url.searchParams.get('room') !== roomCode) return null;
    if (url.searchParams.get('view') !== 'party' || url.searchParams.get('party') !== party) return null;
    return url.pathname + url.search;
  }

  async function poll() {
    try {
      const response = await fetch(`/api/display/${party}`, { cache: 'no-store' });
      const data = await response.json();
      if (data.status === 'running' && data.sessionId) {
        const route = safeInternalScreenUrl(data.screenUrl, data.sessionId, data.roomCode);
        if (!route) throw new Error('Host rejected an unsafe display route');
        if (loadedSession !== data.sessionId || frame.getAttribute('src') !== route) {
          frame.src = route; loadedSession = data.sessionId;
        }
        waiting.classList.add('hidden'); frame.classList.remove('hidden');
      } else {
        loadedSession = null; frame.removeAttribute('src'); frame.classList.add('hidden'); waiting.classList.remove('hidden');
        document.getElementById('poll-status').textContent = 'Local receiver ready';
      }
    } catch (e) {
      document.getElementById('poll-status').textContent = 'Waiting for local host…';
      document.getElementById('poll-status').classList.remove('live');
    }
  }
  poll(); setInterval(poll, 1000);
})();
