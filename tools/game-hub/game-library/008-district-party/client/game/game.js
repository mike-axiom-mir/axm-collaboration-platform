import { CityScene } from './scenes/CityScene.js';
import { startUniversalGamepads } from './universal-gamepad.js';

const query = new URLSearchParams(location.search);
const sessionId = query.get('session');
const requestedParty = query.get('party') || 'party_a';
const partyId = ['party_a','party_b','all'].includes(requestedParty) ? requestedParty : 'party_a';
const canvas = document.getElementById('city-canvas');

if (!sessionId || query.get('view') !== 'party') {
  document.getElementById('connection-banner').textContent = 'Invalid party-screen route. Open the persistent party screen from the launcher.';
} else {
  const scene = new CityScene(canvas, { sessionId, partyId, room: query.get('room') || 'AXM1' });
  const roomCode = query.get('room') || 'AXM1';
  scene.start()
    .then(() => startUniversalGamepads({ sessionId, roomCode, partyId, statusElement: document.getElementById('gamepad-status') }))
    .catch((error) => { document.getElementById('connection-banner').textContent = `City could not start: ${error.message}`; });
}
