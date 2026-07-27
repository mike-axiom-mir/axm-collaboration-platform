# AXM Anim Kit — v0.1 (DRAFT / TEST, not canon)

Procedural **motion lego-blocks**. Built to attack the exact problem you named:
a small team's animation feeling "sad." The fix isn't more hand-keyframing — it's
realizing that **most game-feel is procedural**: springs, squash & stretch,
follow-through and easing are *data* you layer on top of even crude base poses,
and suddenly everything reads as alive.

Same portable, deterministic, zero-dependency, offline approach as the toon-kit
and fx-blocks. One source; every platform consumes it.

## Proof (rendered this build — see `out/`)

- **`bounce-filmstrip.png`** — the single most-recognized animation-principles test:
  a bouncing ball that stretches when fast and squashes flat on contact, with a
  ground shadow that scales to sell height. **Every frame is computed from data —
  no hand-keys.** If the kit can produce a readable bounce procedurally, it can
  make placeholder game motion feel alive on day one.
- **`pop-filmstrip.png`** — a UI hit-pop overshooting to 1.49× and settling back
  (easeOutBack). This is the "collect / confirm / spawn" juice, one line to apply.

## The blocks in v0.1

| Block | What it does | Why it kills "sad animation" |
|---|---|---|
| **Easing** | Full named curve set (incl. overshoot/elastic/bounce/anticipate) + CSS cubic-beziers | Nothing should move linearly; this is the floor |
| **spring()** | Damped-harmonic sampler → overshoot-and-settle keyframes | The single biggest "juice" lever for UI + game |
| **squashStretch()** | Volume-preserving scale from speed/contact, capped | Sells weight and impact for free |
| **Juice.hitPop / landSquash / idleBob / windup** | Ready clips for feedback, landings, breathing, anticipation | `idleBob` alone kills the "dead T-pose" look |
| **Juice.screenShake()** | Deterministic seeded shake with trauma decay | Camera juice; replayable, testable |
| **followThrough()** | Trailing lag+spring on appended parts (hair, tail, gun, cloth) | Secondary motion is what separates cheap from alive |

## Portable outputs (pick what your target speaks)

| Output | Where it drops in |
|---|---|
| `clip` (`axm.anim-clip/v1`) | Any engine — named channels (scale/scaleX/scaleY/offsetX/offsetY) + keyframes |
| `css` via `toCSSKeyframes(clip)` | Web / apps / OS UI — a ready `@keyframes` block |
| `sample(kf, t)` | Drive any engine/shader per frame with one value |

```js
const { Juice, spring, squashStretch, toCSSKeyframes, sampleChannel } = require('./anim-kit.js');

// web/UI — get a @keyframes string
styleSheet.textContent += toCSSKeyframes(Juice.hitPop({ peak:1.4 }));

// game engine — sample a spring each frame
const s = spring({ from:0, to:targetX, stiffness:180, damping:12 });
onFrame(t => obj.x = sampleChannel(s, t));

// impact — squash on landing
const { sx, sy } = squashStretch(verticalSpeed, { contact:isGrounded, maxStretch:1.35 });
```

## How it plugs into what you're already building

- **Game brief backlog:** this is the seed for **ANIM-002 (min animation set)** and
  **ANIM-003 (evolution squash-stretch morphs)**. The squash cap reads the same
  `squashStretchMax` the toon-style contract already defines — one number, both kits.
- **asset-hands:** the workshop already has `animation-clip.schema.json`. The
  `axm.anim-clip/v1` here should be reconciled with / extended from that so clips
  round-trip through the existing asset pipeline (a job for the manager's fit-analysis).
- **Mirror / any AI:** clips are plain data — a Mirror or the ChatGPT engine can
  author, read, and mutate them without a renderer.

## Honest status

- **Hand, not sense** — it makes motion, so it belongs in `tools/`, not the sensorium.
- **v0.1 TEST** — deterministic and proven with filmstrips, but not promoted; needs a
  manifest/contract/selftest to become a real AXM tool.
- The filmstrips are *static proofs of the curves*, not the live animation — the
  point is that the math produces readable motion; a real runtime plays it.

## Procedural locomotion (`locomotion.js`) — the "it looks like a game" block

A parametric biped that **walks, runs, and idles** from sine channels + foot phase.
No hand-keyframing: joint angles are functions of one phase value, and a foot-plant
pass grounds the lower foot each frame so it reads as real weight, not a float.

Proof: `out/walk-filmstrip.png` — a legible 8-frame walk cycle (contact → passing →
reach → contact), arms counter-swinging, body bobbing high at passing and low at
contact. `out/run-filmstrip.svg` is the same math with bigger stride and lean.

Portable, same as the rest:

```js
const { pose, channels } = require('./locomotion.js');

// drive a rig directly — pose() returns joint positions each frame
const p = pose('walk', (time % cycleMs) / cycleMs);   // {hip,chest,head,legL,legR,armL,armR}
drawSkeleton(p);

// or export engine-agnostic joint-angle channels (axm.anim-clip/v1)
const clip = channels('run');   // thighL/R, kneeL/R, armL/R, bobY over one loop
```

Tune via `GAITS` (thigh/knee/arm swing, bob, lean, stride) and `RIG` (limb lengths).
It's a first-pass gait — readable and grounded, not yet mocap-smooth; foot-plant IK,
heel-toe roll, and hip sway are the obvious next polish. But for "a placeholder
character that moves with personality on day one," it's already there.

## Death → respawn-evolution morph (`morph.js`) — the signature block

The motion the game is *named after*: die, collapse, and re-emerge as a **directed
variant** — weirder, not weaker. Every mutation has a **visible cause** (death type →
proportion change) and is deterministic, so it's the animation face of the game's
"directed variation, never a hidden rewrite" rule.

Timeline phases: `alive → anticipate → COLLAPSE (death squash) → seed (lineage carries)
→ EMERGE (stretch overshoot, rig morphs in) → settle → evolved`.

Proofs: `out/respawn-stiltLegs.png` is the clearest — the body collapses, sparks a seed,
and rises **taller with longer legs and a new colour**, a visibly different creature.
`out/respawn-longReach.png` is the same timeline with a subtler arm-length mutation.

```js
const { offer, timeline } = require('./morph.js');

// which directed mutations does THIS death present? (bounded, cause-tagged)
const choices = offer('ranged');   // [{id, name, cause, rig, color}, ...]  ← the respawn menu

// play the morph for the chosen mutation
const clip = timeline('stiltLegs');   // {frames:[{scale,rig,alpha,seed,morphT}], cause, evolvedRig}
onFrame(t => { const f = sampleAt(clip, t); drawBody(f.rig, f.scale, f.alpha); });
```

Mutations are data (`MUTATIONS`): `longReach`, `bouncyHide`, `stiltLegs`, `bigBrain` —
each a proportion delta on the biped rig plus a colour and a stated cause. Add more by
adding entries; `offer()` maps death causes to a bounded, seeded choice set. This is
**ANIM-003** and the respawn-evolution loop from the game brief, made visible.

Honest status: reuses the first-pass biped rig, so it inherits its polish gaps; the
morph *concept* (collapse → seed → directed re-emergence) is fully proven, colour-coded,
and cause-tagged. Hand, not sense; TEST, not canon.

## Menu of further motion blocks (biggest wins for the game, ranked)

1. **Procedural locomotion** — parametric walk/run/idle from sine channels + foot
   phase. Gives a *placeholder character that walks* with zero hand-animation — the
   fastest possible fix for "sad animation."
2. **Hit-react library** — flinch/knockback/stagger clips driven by hit direction.
3. **Aim/look procedural layer** — additive head/torso/weapon aim on top of any base.
4. **Ragdoll-lite / spring-bones** — cheap flop and jiggle without a physics rig.
5. **Camera juice pack** — follow-lag, punch, kick, recoil, land-dip.
6. **Anim state-blender** — crossfade + additive layering contract (so procedural
   layers stack cleanly on base clips).
7. **Death/respawn morph** — the evolution transformation the game needs (ties to
   the respawn-evolution loop in the brief).

## Files

- `anim-kit.js` — easing, spring, squash-stretch, juice clips, follow-through, exporters
- `out/bounce-filmstrip.svg/.png`, `out/pop-filmstrip.svg/.png` — proofs
- `out/clips.json` — portable clips · `out/clips.css` — CSS @keyframes · `out/spring.sample.json`
