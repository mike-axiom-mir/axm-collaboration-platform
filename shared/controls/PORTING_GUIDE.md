# Porting guide

## The split that keeps games consistent

The control surface has three layers:

1. **Feel** — floating sticks, dead zone, response curve, pointer capture.
2. **Profile** — which physical channel means move, aim, look, interact, fire, or dash in one game.
3. **Authority** — the host validates identity and turns intentions into gameplay results.

Keep layer 1 shared. Give each game a small profile for layer 2. Never move layer 3 onto the phone or connected AI.

## Browser wiring

```js
import { AxmVirtualStick } from './src/browser/axm-virtual-stick.mjs';
import {
  AxmControllerRuntime,
  createHttpJsonTransport,
} from './src/browser/axm-controller-runtime.mjs';

const runtime = new AxmControllerRuntime({
  identity: { roomCode, sessionId, seatId, token },
  profile,
  transport: createHttpJsonTransport({ inputUrl: '/api/input' }),
});

new AxmVirtualStick({
  element: leftZone,
  base: leftBase,
  knob: leftKnob,
  onChange: state => runtime.setVector('left', state),
});

new AxmVirtualStick({
  element: rightZone,
  base: rightBase,
  knob: rightKnob,
  onChange: state => runtime.setVector('right', state),
  onRelease: state => {
    runtime.setVector('right', { ...state, active: false });
    if (!state.cancelled) runtime.releaseVector('right');
  },
});

runtime.start();
```

Button examples:

```js
actionButton.onpointerdown = () => runtime.setButton('action', true);
actionButton.onpointerup = () => runtime.setButton('action', false);
fireButton.onpointerdown = () => runtime.pulse('primary');
```

The profile maps `left`, `right`, and named buttons to semantic fields. Change labels and release behavior by profile; do not fork the pointer math for every game.

## Host wiring

```js
const { createSeatInputGate, consumePulse } = require('./src/host/seat-input-gate');
const { createIntentSanitizer } = require('./src/shared/intent');

const sanitizeIntent = createIntentSanitizer(profile.intent);
const gate = createSeatInputGate({
  getSession: sessionId => sessions.get(sessionId),
  sanitizeIntent,
  pulseFields: profile.intent.pulseFields,
});

const result = gate.route(requestBody);
if (!result.ok) return sendJson(result.statusCode, result);

// During the authoritative simulation tick:
if (consumePulse(actor, 'fire')) hostCreateProjectile(actor);
```

Expected session seam:

```js
{
  id: 'session-local-id',
  roomCode: 'AXM1',
  status: 'running',
  seatTokens: { seat_1: 'private-token' },
  actors: {
    'actor-seat-1': {
      id: 'actor-seat-1', seatId: 'seat_1', controller: 'human',
      inputSequence: -1, input: {}, inputHeld: {}, pendingPulses: {}
    }
  }
}
```

`actors` may also be a `Map` or array.

## Connected AI wiring

Give an `adapter` only:

- its room, session, seat, and private seat token;
- the controller profile;
- its observation endpoint;
- the same input endpoint used by phones.

Do not give it a host token or raw world object.

```js
import { ConnectedAiSeatClient } from './src/ai/connected-ai-client.mjs';

const client = new ConnectedAiSeatClient({
  identity: binding,
  observationUrl: '/api/adapter-observation',
  inputUrl: '/api/input',
  policy: async observation => ({
    moveX: observation.self.targetDirection?.x || 0,
    moveY: observation.self.targetDirection?.y || 0,
    action: false,
  }),
});

client.start();
```

The included client is an integration reference, not an AI model. The Workshop supplies the connected AI and its reasoning.

## Adapting a new game

For most games, edit only a profile:

- `vectors`: map physical sticks to normalized field pairs.
- `buttons`: map stable physical buttons to semantic booleans.
- `releaseActions`: optionally turn stick release into a pulse such as `fire`.
- `intent`: declare the host allowlist and pulse fields.
- `labels`: change visible context copy.

If a game truly needs another semantic field, add it to the profile allowlist and teach only that game’s host simulation what it means. Unknown client fields are discarded.

## Migration from District Party v0.1.7

| District Party file | Portable equivalent |
| --- | --- |
| `client/controller/axm-game-night-controls.js` | `src/browser/axm-virtual-stick.mjs` |
| controller send/pulse code | `src/browser/axm-controller-runtime.mjs` |
| `shared/validation.js` | `src/shared/intent.js` |
| `server/input-router.js` | `src/host/seat-input-gate.js` |
| `server/seat-observation.js` | `src/host/screen-observation.js` |
| adapter HTTP loop | `src/ai/connected-ai-client.mjs` |

