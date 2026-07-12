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
