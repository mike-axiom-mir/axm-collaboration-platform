# Hermes Local Module Plan

Status: design / adapter contract draft.

Hermes is an existing public open-source AI agent ecosystem, not just an AXM role name.

This AXM module should be an adapter layer around Hermes, not a blind copy/fork.

## Public source references

Known public Hermes-related repos/patterns found during scout:

- `ivanontech/hermes-agent-dashboard` — open-source local-first dashboard for Hermes Agent. It reads local Hermes telemetry from `~/.hermes/state.db`, is localhost-only by default, read-only by default, redacts obvious secrets, and excludes private runtime data from the public repo.
- `mudrii/hermes-agent-docs` — public documentation for Hermes Agent, describing it as a Nous Research autonomous agent with memory, skills, SQLite session history, plugin architecture, messaging gateways, local/provider support, LM Studio support, and OpenAI-compatible API/proxy options.

These references are scout inputs, not canon approval.

## AXM interpretation

For AXM, Hermes should be treated as an external local agent/runtime that can be connected safely through an adapter.

Hermes should not be merged into AXM core.

AXM should connect to Hermes through clear seams:

```text
AXM Tool
  -> AXM Foundation Gate
    -> AXM Bridge / Hermes Adapter
      -> Hermes local API / dashboard / state.db / plugin surface
```

## Why Hermes matters for local

Hermes appears valuable because it already has many things AXM eventually needs locally:

- persistent memory/session history
- SQLite-backed state
- plugin architecture
- local dashboard pattern
- OpenAI-compatible local API/proxy option
- LM Studio/local provider support
- messaging gateway support
- skill/tool ecosystem
- telemetry/dashboard possibility

That means AXM should not rebuild all of that blindly.

Instead, AXM should test a small adapter.

## AXM boundary rule

Hermes must not connect directly into every AXM tool.

Correct shape:

```text
AXM Tool
  -> AXM Foundation Gate
    -> Bridge / Local Module Adapter
      -> Hermes
        -> approved local tasks / logs / queues / state
```

Wrong shape:

```text
Hermes
  -> directly edits every tool
  -> reads everything silently
  -> changes project rules
  -> acts without review
```

## What AXM may use Hermes for

Allowed draft responsibilities:

1. Local agent runtime tests.
2. Reading approved Hermes dashboard/API outputs.
3. Reading approved local Hermes `state.db` summaries, not raw private content by default.
4. Building task packets from approved AXM inputs.
5. Returning results as proposals.
6. Preparing handoff packets for Mike, Claude, ChatGPT, local Axiom/Mir, or coding agents.
7. Summarizing logs into review notes.
8. Preserving proof logs locally.

## What Hermes must not do inside AXM

Hermes must not:

- read private sources without explicit approval
- silently connect to WhatsApp, Discord, email, or other accounts
- auto-edit AXM core/root files
- auto-merge changes
- bypass the Foundation Gate
- store API keys in public files
- claim a task is done without proof
- mutate AXM role rules without review
- import large external code into AXM without license/source review

## Adapter strategy

Do not copy Hermes into this repo first.

Safer first step:

```text
AXM_WORKSHOP/local_modules/hermes/
  docs and adapter contract only
```

Then test one of these later:

1. OpenAI-compatible local endpoint adapter.
2. Dashboard/state reader adapter.
3. Inbox/outbox proposal adapter.
4. GitHub issue packet adapter.

## Proposed module folder

```text
AXM_WORKSHOP/local_modules/hermes/
  HERMES_LOCAL_MODULE_PLAN.md
  manifest.json
  README.md
  inbox/
    .gitkeep
  outbox/
    .gitkeep
  queue/
    .gitkeep
  logs/
    .gitkeep
```

Important: real runtime logs, state databases, `.env`, credentials, tokens, sessions, and private config should stay local and ignored by Git.

Public repo should only contain placeholders and docs.

## Bridge relationship

The current AXM bridge already has:

- local host only
- bridge token
- rate cap
- provider routing
- Claude / ChatGPT provider paths
- health endpoint
- ask endpoint

Hermes should not replace this bridge yet.

First integration should be one of:

```text
AXM bridge provider: hermes-api
AXM local module: hermes-dashboard-reader
AXM local queue: hermes-inbox-outbox
```

Possible later endpoints on AXM side:

```text
GET  /hermes/health
POST /hermes/queue
GET  /hermes/tasks
POST /hermes/digest
POST /hermes/propose
```

These should require the same local token or a stricter module token.

## First tiny AXM adapter version

Do not start with all Hermes features.

First AXM-safe adapter should only do this:

1. Confirm Hermes is installed/running or note that it is missing.
2. Confirm local dashboard/API/state path is configured.
3. Read only an approved minimal status/digest source.
4. Write a proposal file to `outbox/`.
5. Never apply changes automatically.

Example:

```text
Hermes status / approved digest
  -> queue/task-001.json
  -> outbox/proposal-001.md
```

## Test goal

The first test is not intelligence.

The first test is safe local connection:

- Did AXM connect only to the approved Hermes source?
- Did it avoid raw private content unless explicitly enabled?
- Did it create a clear task packet?
- Did it preserve source references?
- Did it avoid direct edits?
- Did it produce a human-reviewable proposal?

## Future role

If the adapter works, Hermes can later help AXM with:

- local AI sessions
- bridge tests
- LM Studio/local model routing
- GitHub issue packet creation
- nightly summaries
- approved source digests
- local AXM memory packets
- server-side operations for the local hub

## AXM status

Hermes is a strong external local candidate.

It is not AXM canon yet.

It becomes stronger only by proving safe local behavior through an adapter.

No silent access. No fake done. No uncontrolled autonomy.
