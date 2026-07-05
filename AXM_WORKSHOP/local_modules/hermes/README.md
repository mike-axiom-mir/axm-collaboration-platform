# Hermes Local Runner Module

Status: TEST scaffold / runnable local module.

Hermes is an external public open-source agent ecosystem, not an AXM-built tool by default.

This folder is for the AXM local runner and adapter seam around Hermes.

## What exists now

This module now has a runnable local Node runner:

```text
hermes-runner.js
```

Run from this folder:

```text
node hermes-runner.js
```

Then check:

```text
http://127.0.0.1:8791/health
```

Consent starts OFF by default.

## Consent rule

Hermes actions are blocked until consent is turned ON locally.

With consent OFF:

- health works
- module list works
- queue/proposal/vault writes are refused

With consent ON:

- `/queue` can write local task JSON
- `/proposal` can write local review proposal Markdown
- `/prompt-vault/add` can write a local prompt record

## Current endpoints

```text
GET  /health
GET  /consent
POST /consent
GET  /modules
POST /queue
POST /proposal
POST /prompt-vault/add
GET  /prompt-vault/list
```

## AXM module slots

Hermes is the local runner body where AXM can later attach:

- prompt vault
- templates
- reasoning shell specialist
- wisdom/log digest
- task queue
- bridge/local provider tests

## What AXM wants from Hermes

Hermes may be useful for local/server continuity work:

- local agent runtime experiments
- local dashboard/status reading
- task packet creation
- local queue management
- log/digest summaries
- handoff packets
- proposal files for Mike review
- possible LM Studio/local model routing

Hermes is not the whole AXM brain.

Hermes should work behind the AXM Foundation Gate and bridge rules.

## Do not copy blindly

Do not import external Hermes code into AXM until:

- source repo is confirmed
- license is checked
- integration route is chosen
- private/runtime files are excluded
- adapter test is defined

## Safety

Default access is none.

Every source must be allowlisted.

Every write should be local and proposal-first until approved.

No private logs, tokens, API keys, state databases, sessions, account data, or `.env` files belong in the public repo.
