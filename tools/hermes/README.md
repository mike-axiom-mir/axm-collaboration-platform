# AXM Hermes Runtime Adapter

Status: EXPERIMENTAL / review required before promotion.

Hermes Agent is an external MIT-licensed runtime from Nous Research. AXM does not silently absorb Hermes into its roots and does not treat Hermes memory, generated skills, or conclusions as canon.

This module now has two cooperating layers:

1. `hermes-bootstrap.js` installs and verifies one immutable reviewed upstream Hermes commit, prepares an AXM-owned local Hermes profile, and launches that pinned runtime from an AXM workspace.
2. `hermes-runner.js` remains the loopback proposal/control layer for AXM-local queue, review-proposal, and prompt-pack flows.

The runtime adapter is deliberately built at Hermes' supported hook boundary rather than as a large private fork of Hermes core. That keeps the AXM policy visible and lets upstream Hermes remain replaceable.

## Source integrity

The reviewed upstream source is recorded in:

```text
hermes-source.lock.json
```

The bootstrap accepts only a full immutable commit SHA. `install` checks the configured origin, refuses a dirty existing checkout, fetches the exact commit, checks it out detached, and verifies `HEAD` before reporting success.

Updating Hermes means reviewing a new upstream state and intentionally replacing the lock. A branch name or floating tag is not accepted as the AXM trust anchor.

## AXM runtime flow

```text
human explicit launch
  -> pinned Hermes source verification
  -> AXM local HERMES_HOME
  -> AXM context injection
  -> Hermes model/agent loop
  -> every tool call
       -> fail-closed AXM pre-tool gate
       -> allow OR block
  -> completed tool call
       -> metadata-only AXM receipt
  -> output remains candidate / review material
```

### Fail-closed gate

`axm/axm_gate.py` is installed as a Hermes `pre_tool_call` shell hook with `fail_closed: true`.

Default local policy comes from `axm-policy.example.json` and starts with:

- action consent OFF
- terminal OFF
- code execution OFF
- computer-use OFF
- delegation OFF
- scheduling OFF
- messaging OFF
- bounded tool/file counters
- AXM repo readable for inspection
- writes limited to declared AXM runtime/proposal folders
- Hermes memories and skills non-canonical

The gate stores only small local counters required for the declared run limits. It refuses to continue if the policy or counter state is invalid.

### Context boundary

`axm/axm_context.py` injects non-secret operating rules before model calls: capability is not permission; blocked actions must not be routed around; source/inference/proposal/verified result must stay distinct; and no action may be claimed successful without evidence.

### Receipts

`axm/axm_receipt.py` records metadata-only receipts after tool calls when local consent and receipts are enabled.

Receipts intentionally exclude:

- raw tool arguments
- raw tool results
- user content
- file contents
- file paths
- raw session/turn/tool-call identifiers

Identifiers are one-way hashed for local correlation. Every receipt is marked `canon: false` and `review_required: true`.

## Local setup

From `tools/hermes/`:

```text
node hermes-bootstrap.js doctor
node hermes-bootstrap.js install
node hermes-bootstrap.js verify
node hermes-bootstrap.js deps
node hermes-bootstrap.js prepare
```

`deps` is separate from source installation on purpose: dependency installation is an explicit action and uses the pinned upstream `uv.lock` path.

The generated local runtime state lives under:

```text
runtime/
  hermes-home/
  workspace/
  state/
  receipts/
  policy.json
```

`runtime/` and the downloaded external Hermes checkout are ignored by Git.

## Consent

Runtime availability and action permission are separate.

```text
node hermes-bootstrap.js consent on "reason"
node hermes-bootstrap.js consent off "reason"
```

Hermes may be started with consent OFF; the AXM gate then blocks tool actions. This preserves the original AXM rule that a runtime can be available without automatically receiving action authority.

Start the reviewed runtime with:

```text
node hermes-bootstrap.js start
```

Arguments after `start` are passed to the Hermes CLI.

## Important boundary: hook gate is not an OS sandbox

The AXM pre-tool hook is a real Hermes authorization boundary for tool dispatch, but it is not kernel/container isolation.

For that reason high-authority tools are OFF by default. Do not enable local terminal, arbitrary code execution, or computer-use merely because path checks exist. If those capabilities are needed, first place Hermes in a genuine isolated backend such as Docker/VM and then deliberately loosen the local AXM policy.

AXM must not claim Foundation/Hub sandbox enforcement until that isolation is wired and tested.

## Existing loopback control layer

`hermes-runner.js` still serves the local proposal/control API on `127.0.0.1:8791` by default.

Current endpoints:

```text
GET  /health
GET  /consent
POST /consent
GET  /modules
POST /queue
POST /proposal
POST /prompt-packs/add
GET  /prompt-packs/list
```

This older control-layer consent state is currently separate from `runtime/policy.json`. Until those state stores are deliberately unified, neither should be described as controlling the other.

## What is implemented now

- immutable reviewed upstream source pin
- origin/SHA/clean-worktree verification
- explicit dependency-install step
- isolated AXM Hermes home and workspace
- fail-closed Hermes pre-tool AXM gate
- AXM pre-LLM context injection
- local action/tool/file limits
- high-authority capability switches, OFF by default
- metadata-only receipts
- local runtime privacy ignore rules
- external Hermes start through the AXM-generated profile

## Still not claimed

- OS/container/VM sandbox enforcement
- automatic Merge Gate integration
- automatic Return Packet promotion
- identity/package-profile binding
- unified consent state with `hermes-runner.js`
- safe enabling of local host terminal/computer-use
- Hermes memory/skill promotion into AXM truth or canon
- autonomous source-lock updates

## Public boundary

Never commit runtime state, tokens, API keys, provider credentials, session databases, receipts, local policy choices, `.env` files, downloaded Hermes source, or private account data.

AXM rule: Hermes can execute only through explicit, reviewable authority; what Hermes learns is evidence/candidate material until AXM review says otherwise.
