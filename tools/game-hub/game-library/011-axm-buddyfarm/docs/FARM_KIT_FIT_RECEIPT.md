# Farm Kit fit receipt

Status: **READY THROUGH A BOUNDED ADAPTER**

Source reviewed: `C:\axm workshop\exports\farm-kit`

## What the intake actually provides

- deterministic wind-sway curves;
- deterministic idle bob/squash values;
- crop growth-stage selection and entry pop;
- a separate `axm.motion-clip/v1` proof emitter.

It does not provide finished sprites, farm rules, state ownership, collision,
inventory, rewards or persistence. BuddyFarm continues to own those systems.

## Route chosen

The three pure motion functions are exposed in the game through
`runtime/farm-motion.js` under the explicit adapter contract
`axm.buddyfarm-motion-adapter/v1`. The adapter does not claim that the source
motion clip is the same schema as an existing rig animation clip.

The renderer uses the values for low-amplitude crop sway, growth-stage scaling
and character idle motion. Rendering is capped at ten visual frames per second
and stops when the page is hidden, keeping the safe slice light on the laptop.

## Honest limits

- The current vector placeholders are still not final character or crop art.
- Physical visual quality remains a human approval decision.
- The source export remains TEST and is not silently promoted as a universal
  Workshop hand by this game integration.
