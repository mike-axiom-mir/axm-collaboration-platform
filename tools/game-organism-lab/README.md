# Game Organism Lab

This experimental human/machine surface compiles exact governed game organs
into a candidate-only assembly plan. It exposes category conflicts, typed seam
failures, unbound inputs and body-budget overruns instead of guessing around
them.

The current Street Life Slice is a deterministic architecture proof, not a
playable game. The compiler never executes an organ, installs a package,
promotes a candidate, writes a canonical game, or claims fun from metrics.
Human visual and release judgments remain explicit in every receipt.

## First real product target

The first intended product route is AXM's fully self-made toon game. It is a
platform-neutral game, not a Steam-owned project. The Command Center routes to
this lab today; it should expose a separate direct play/build link only after
the toon game has a real registered launch route and passes its game verifier.
Until then the target stays visible here without publishing a misleading or
broken link.

## Cartoon 3D evidence route

The Run 100 Cartoon 3D intake is available to the Node-side game pipeline as
`shared/game-organism/cartoon-3d-evidence.js`. It composes the 100 locally
rerun TEST-HOLD organs into the evidence slot of a toon-game candidate and
binds their 11 families to existing Asset Hands, physics, animation, Sensorium,
and verification seams. The resulting assembly is `CANDIDATE_READY`; execution,
visual approval, gameplay approval, licensing approval, release, and CANON
remain separate human-gated claims.

```javascript
const Cartoon3D = require('../../shared/game-organism/cartoon-3d-evidence');
const candidate = Cartoon3D.createToonGameEvidenceExample();
```

## Audio/music evidence route

The 106-run audio/music intake is available as
`shared/game-organism/audio-music-evidence.js`. It composes 100 locally
stewarded source modules into the candidate evidence slot and preserves the
source archive and artifact receipts. It does not claim audible quality,
live-device behavior, rights clearance, publication, CANON, or release.

```javascript
const AudioMusic = require('../../shared/game-organism/audio-music-evidence');
const audioCandidate = AudioMusic.createAudioGameEvidenceExample();
```

## Simulation/living-systems evidence route

The Run 102 simulation/living-systems intake is available as
`shared/game-organism/sim-living-evidence.js`. It composes 100 hash-verified
static module blueprints and their proof debt into the candidate evidence slot.
The route supports living-game design review across agents, ecology, economy,
society, traffic, weather, missions, replay, and multiworld governance. It does
not represent those source blueprints as executable modules or claim behavioral,
scientific, safety, performance, authoritative-world, publication, CANON, or
release proof.

```javascript
const SimLiving = require('../../shared/game-organism/sim-living-evidence');
const livingCandidate = SimLiving.createSimLivingGameEvidenceExample();
```

The same intake now has a tested static bridge at
`intakes/sim-living-run102/game-wiring.js`. It maps every source module into
Game Capability Atlas planning leads, a directly importable DRAFT Game Forge
project, a frozen Experiment World checkpoint, receiver-normalized (but never
applied) living-world operation previews, and Verification Spine receipts. The
generated Game Forge project is
`intakes/sim-living-run102/evidence/game-forge-project.json`; use Game Forge's
explicit **Import project** action to inspect it. Importing the document does
not implement or execute the source systems.

```javascript
const SimLivingGameWiring = require('../../intakes/sim-living-run102/game-wiring');
const wiring = SimLivingGameWiring.buildArtifacts();
```

Use **Sever physics seam** or **Starve body budget** to see the whole candidate
hold without losing or mutating the registered organs.

```powershell
node tools/game-organism-lab/selftest.js
```
