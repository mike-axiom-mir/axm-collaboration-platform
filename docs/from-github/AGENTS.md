# AGENTS.md — AXM Repository Rules for AI Helpers

This repository may be read by human helpers, coding agents, and AI assistants.

## Core AXM rule

Do useful work without pretending it is finished.

AXM roots:

1. Truth
2. Agency / non-domination
3. Continuity
4. Wisdom over speed

## Human merge gate

Mike Tobi is the human founder, tester, direction-setter, and merge gate.

Do not treat AI output as canon. AI output is material until reviewed, tested, and accepted.

## Before changing files

Use branches and pull requests. Do not silently rewrite `main`.

Explain:

- what changed
- why it changed
- how it was tested
- what remains untested

## Secrets and local files

Never commit real secrets or local runtime material.

Do not commit:

- API keys
- real bridge tokens
- `AXM_WORKSHOP/bridge/bridge-token.txt`
- bridge logs
- workshop runtime logs
- private machine-specific config

Use example files instead, such as:

- `AXM_WORKSHOP/bridge/bridge-token.example.txt`

## Testing

When changing workshop code, run or preserve the verifier path:

```bash
cd AXM_WORKSHOP
node verify.js
```

If you cannot run it, say that clearly.

## Tool/module rule

A tool should be easy to inspect:

- one folder
- one manifest
- one entry point
- clear status label
- no hidden network behavior
- no dependency added without a reason

## Status labels

Use honest labels:

- `draft`
- `accept for test`
- `working`
- `known fail`
- `needs review`
- `canon` only when explicitly approved by Mike

## Current known issue

The existing verifier previously flagged `AXM_WORKSHOP/tools/studio/index.html` for referencing DOM ids before they exist:

- `mBuilt`
- `mUp`

Do not hide this. Fix it in a focused branch.

## Done means

A task is done only when the change is visible, explained, and its test status is clear.

No fake done. No silent rewrite. No secret commits.

## Detail-density and composable capability principle

Quality is often the accumulated result of many small correct details, not one large generic upgrade.

- When improving a system, look for missing small, bounded capabilities, checks, parameters, passes, and repair operations that control specific details or failure modes.
- Prefer many reusable, inspectable, composable capabilities over one opaque "make it better" step when the smaller capabilities create real control or evidence.
- A machine should remain useful without AI: humans, explicit state, recipes, or deterministic logic can invoke the same capabilities directly.
- With AI, the model is primarily an interpretation and orchestration layer: it translates a higher-level goal into selections and combinations of the same underlying capabilities. The AI does not own those capabilities.
- A better reasoning model may improve goal interpretation and composition, while the underlying machine remains portable and usable without that model.
- Judge improvement by accumulated perceptual or functional detail, coherence, failure reduction, and fit to the goal—not by model size, resolution, benchmark score, or one broad upgrade alone.
- For visual, game, asset, animation, and video work, pay attention to small interacting details such as material variation, contact, timing, weight, secondary motion, lighting response, sound layering, asymmetry, wear, scale cues, camera behavior, and continuity.
- Do not fragment working systems merely for ideology. Add granularity where it creates useful control, reuse, diagnosis, repair, or quality.

**Working rule:** thousands of small good details and capabilities in the right places can improve a result more than one simple big upgrade.

## Canonical state and adaptive realization principle

When useful, separate **what exists** from **how it is expressed on a particular machine**.

- Canonical state/identity is authoritative. Rendering, UI, meshes, previews, audio paths, device skins, caches, and other realizations are replaceable expressions unless the repository explicitly defines otherwise.
- Preserve expression intent separately where needed so meaning, material character, motion weight, readability, atmosphere, hierarchy, sound intent, and semantic detail can survive changes in realization cost.
- Prefer one truthful body with multiple bounded realization contracts over manually divergent mobile/lite/desktop/ultra/platform editions when the same canonical state can support them.
- Choose realization from canonical state + expression intent + measured machine capabilities + user policy; adaptation may happen at launch or dynamically.
- A weak device should usually receive a cheaper expression, **not weaker truth**.
- Define non-degradable invariants explicitly: rules, fairness, hit detection, data integrity, core functionality, privacy, causal/timing meaning, content identity, and authoritative state as applicable.
- Never let a lossy realization overwrite richer canonical state merely because that realization rendered successfully. Projection/cache state is not authority.
- Upgrading expression must not invent canonical facts; downgrading expression must not erase them.
- Build bounded alternative realization paths where they add real value, but do not force this split where representation itself is canonical truth.

**Working rule:** degrade expression, never truth; upgrade expression, never invent truth. One body may wake up differently on different machines while remaining the same thing.
