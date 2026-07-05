# Hermes Local Module Plan

Status: design / module contract draft.

Hermes is not treated as a random AI model inside AXM.

For AXM, Hermes should become a local/server operations module: a router, queue, watcher, digest maker, and handoff helper that works behind the AXM Foundation Gate.

## Why Hermes exists

AXM needs a local layer that can keep boring continuity work organized without turning every tool into its own uncontrolled assistant.

Hermes can help with:

- watching approved local folders
- keeping a small task queue
- preparing handoff packets
- summarizing logs
- routing work to the right helper
- preparing review notes for Mike
- passing clean digests back into AXM

Hermes should not be the whole brain.

Hermes is the operations runner / night guard / message courier.

## Local-first role

Hermes is mainly for local or self-hosted use.

Possible local homes:

- Mike's laptop / mini PC
- Ivan's server or VM
- a local AXM hub machine
- later: a controlled private server body

Hermes should be able to run without public cloud hosting.

## AXM boundary rule

Hermes must not connect directly into every tool.

Correct shape:

```text
AXM Tool
  -> AXM Foundation Gate
    -> Bridge / Local Module Adapter
      -> Hermes
        -> approved local tasks / logs / queues
```

Wrong shape:

```text
Hermes
  -> directly edits every tool
  -> reads everything silently
  -> changes project rules
  -> acts without review
```

## What Hermes may do

Allowed draft responsibilities:

1. Watch approved folders.
2. Read only allowlisted files.
3. Build task packets.
4. Summarize logs into review notes.
5. Queue tasks for Claude Code, ChatGPT, local Axiom/Mir, or another helper.
6. Return results as proposals.
7. Preserve proof logs.
8. Ask for human approval before applying changes.

## What Hermes must not do

Hermes must not:

- read private sources without explicit approval
- silently connect to WhatsApp, Discord, email, or other accounts
- auto-edit AXM core/root files
- auto-merge changes
- bypass the Foundation Gate
- store API keys in public files
- claim a task is done without proof
- mutate its own role rules without review

## Source intake rule

Future source connectors may exist, but only through explicit allowlists.

Examples of possible later sources:

- selected local folders
- selected logs
- selected Discord export/channel bridge
- selected WhatsApp export/bridge
- selected GitHub issue/PR data

Each source needs:

```text
source name
allowed path or API
read/write permission level
private/public status
retention rule
human approval rule
```

Default is no access.

## Proposed module folder

Suggested local module shape:

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

Important: real runtime logs should stay local and ignored by Git.

Public repo should only contain placeholders and docs.

## Module manifest idea

Hermes should have a small manifest like:

```json
{
  "id": "hermes-local",
  "name": "Hermes Local Operations Module",
  "status": "design",
  "type": "local-module",
  "entry": "README.md",
  "access": {
    "network": "local-only by default",
    "writes": "proposal-only until approved",
    "sources": "allowlist only"
  }
}
```

## Bridge relationship

The current bridge already has:

- local host only
- bridge token
- rate cap
- provider routing
- Claude / ChatGPT provider paths
- health endpoint
- ask endpoint

Hermes should not replace this bridge.

Hermes should sit beside/behind it as a local operations module.

Possible later endpoints:

```text
GET  /hermes/health
POST /hermes/queue
GET  /hermes/tasks
POST /hermes/digest
POST /hermes/propose
```

These should require the same local token or a stricter module token.

## First tiny version

Do not start with all features.

First Hermes module should only do this:

1. Read a local `inbox/` folder.
2. Turn `.txt` notes into task packets.
3. Write proposal files to `outbox/`.
4. Keep a local log.
5. Never apply changes automatically.

Example:

```text
inbox/request-001.txt
  -> queue/task-001.json
  -> outbox/proposal-001.md
```

## Test goal

The first test is not intelligence.

The first test is safe continuity:

- Did Hermes read only the allowed folder?
- Did Hermes create a clear task packet?
- Did Hermes preserve source text?
- Did Hermes avoid direct edits?
- Did Hermes produce a human-reviewable proposal?

## Future role

If the tiny version works, Hermes can later become the local coordinator for:

- bridge tests
- local AI sessions
- Claude Code handoffs
- GitHub issue packet creation
- nightly summaries
- approved source digests
- local AXM memory packets

## AXM status

Hermes local module is a useful candidate.

It is not canon yet.

It becomes stronger only by proving local-safe behavior.

No silent access. No fake done. No uncontrolled autonomy.
