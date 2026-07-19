# Mirror Creative Studio Classes

Status: WORKING TEST · local-only · proposal-first · no Studio access authority.

## Purpose

This track lets Mirror choose bounded creative lessons that teach the real AXM Studio tool vocabulary instead of a separate AI-only drawing language.

The source contract was inspected read-only from GitHub PR #14 at head `d427a35f3dafa500d40ff66b86cb464563e4e42b`, especially `tools/studio/engine.html`.

The current Studio exposes:

- a 600 × 600 canvas;
- human and AI-owned layers;
- the visible `axm.drawpacket/v1` handoff;
- the same draw engine for live AI and pasted packets;
- a maximum of 14 commands per turn;
- paint, shape, tone, detail, layer and repair operations;
- screenshot-aware AI turns and the draw → look → fix pattern.

The Forge mirrors those contracts for lessons and static grading. It does **not** embed or execute the Studio.

## The class ladder

1. **Look Before Drawing** — inspect visible state or honestly request the missing screenshot.
2. **Brush & Line Control** — deliberate strokes, line weight and bounded erase repair.
3. **Shapes & Composition** — masses, focal hierarchy, alignment and negative space.
4. **Color, Fill & Gradient** — limited palette, contrast and visual role.
5. **Layers as Meaning** — background, subject, glow and detail remain separately editable.
6. **Glow & Material Finish** — controlled gloss, metallic finish and restrained brightness.
7. **Creative Repair** — erase, shift and reorder as first-class creative actions.
8. **Tone & Retouch** — local blur, dodge, burn and smudge with named intent.
9. **Text & Symbols** — readable text and source-grounded visual claims.
10. **Eyes Loop: Draw → Look → Fix** — command receipt, screenshot comparison and repair.
11. **Free Practice** — a self-chosen goal with a stop condition and evidence-based done decision.
12. **Shared Canvas Collaboration** — assigned layers, attribution and reversible conflict handling.

## Choice is not authority

Mirror may choose a class by creating an `AWAITING_REVIEW` training-track task.

That choice does not grant:

- permission to train;
- permission to connect to Studio;
- ownership of a layer;
- permission to alter pixels;
- permission to promote a challenger;
- or permission to change any human or other machine seat's work.

A steward must review the class task. Approved tasks remain challenger-only.

## Practice envelope

A lesson proposal uses:

```json
{
  "schema": "axm.mirror.studio-practice/v1",
  "class_id": "studio-eyes-loop",
  "observation": "What is visibly present, or what screenshot evidence is missing.",
  "goal": "One bounded visual goal.",
  "plan": ["A short inspectable plan"],
  "draw_packet": {
    "schema": "axm.drawpacket/v1",
    "owner": "ai1",
    "draw": []
  },
  "self_check": {
    "requires_post_screenshot": true,
    "layer_ownership_respected": true
  },
  "repair_intent": "The smallest reversible repair after inspection.",
  "verdict": "HOLD",
  "authority": "NONE"
}
```

`owner` is limited to an assigned Studio AI layer identifier (`ai1` or `ai2`) in this PR14-compatible training contract. The Forge rejects attempts to target the human layer.

## Static grade versus visual proof

The Forge can statically verify:

- JSON shape;
- known class;
- draw-packet schema;
- allowed owner;
- known operations;
- required command fields;
- numeric coordinate bounds;
- class command cap;
- class-specific required operations;
- visible self-check and repair intent;
- no unsupported PASS/done claim without a visual receipt.

It cannot prove:

- that pixels changed;
- that the composition improved;
- that a color choice works;
- that the intended subject is recognizable;
- or that the piece is finished.

Those require the real Studio eyes loop:

```text
pre-screenshot
→ approved draw packet
→ actual Studio apply on assigned AI layer
→ pixel-change receipt
→ post-screenshot
→ compare goal with result
→ PASS / HOLD / REPAIR
```

## Root rule

A valid draw packet is not good art.

A fluent explanation is not visual proof.

A class is not authority.

Mirror earns creative development by producing visible work, looking at what actually happened, repairing it, and preserving the receipts.
