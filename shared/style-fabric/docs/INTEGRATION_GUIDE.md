# Game Integration Guide

This is the minimum path for a future game.

## 1. Declare semantic slots

Choose the closest generated mold contract under `examples/mold-kits/` and
replace its slots with the visual meanings your game exposes. Use
`full-presentation.game-skin-contract.json` only when the renderer actually
implements all 33 surfaces. Do not expose implementation secrets or gameplay
values.

Each slot declares:

- a stable semantic ID;
- its kind (`surface`, `character-region`, `ui`, `fx`, `audio`);
- whether it is optional;
- supported material properties;
- a game-owned fallback.

## 2. Implement a game-owned adapter

An adapter has four operations:

```js
{
  id: "your-game.style-adapter",
  describe(): gameSkinContract,
  async preview(resolvedSkin): PreviewResult,
  async apply(resolvedSkin): { rollbackToken, evidence },
  async rollback(rollbackToken): RollbackResult
}
```

The game remains authoritative. Style Fabric sends resolved presentation values only.

## 3. Register, prepare, approve, apply

```js
import { SkinRuntime } from "../src/index.mjs";

const runtime = new SkinRuntime();
runtime.registerAdapter(yourAdapter);

const proposal = await runtime.prepare({
  adapterId: yourAdapter.id,
  packs: [chosenSkinPack]
});

const result = await runtime.apply({
  proposal,
  approval: {
    approved: true,
    actor: "human:mike",
    reason: "Chosen in the skin picker"
  }
});
```

Machine callers use the same route but do not gain higher authority.

## 4. Preserve fallback and rollback

An adapter is not conformant until:

- missing slots keep the game’s normal appearance;
- unsupported effects degrade visibly and safely;
- preview cannot mutate authoritative state;
- apply records the previous presentation state;
- rollback restores that state;
- failures return structured evidence.

Use the conformance assessor before adoption review:

```js
import { assessGameAdapterConformance } from "../src/index.mjs";

const report = assessGameAdapterConformance({
  gameContract,
  adapterEvidence: {
    previewIsolated: true,
    fallbackObserved: true,
    rollbackObserved: true,
    receiptObserved: true
  }
});
```

The four booleans are declarations about observations made in the real target
renderer. Style Fabric does not manufacture that evidence. A structurally valid
contract stays `CONTRACT_READY_RUNTIME_PENDING` until all four are recorded.

## 5. Inspect the Test Chamber

Open the local Studio and use the 33-surface chamber to confirm which authored
surfaces are connected and which still retain game fallback. Per-surface
editing is a design aid; it does not prove the engine adapter.

## 6. AXM intake route

Recommended later flow:

`Creative Studio Asset Mode → Asset Vault → Style Fabric → preview/export TEST pack → game adapter → user approval → apply receipt`

No Foundation overwrite, Game Hub promotion, or CANON status is implied by this standalone package.
