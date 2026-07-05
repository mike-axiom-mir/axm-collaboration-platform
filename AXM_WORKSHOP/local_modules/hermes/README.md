# Hermes Local Adapter Module

Status: design / local adapter candidate.

Hermes is an external public open-source agent ecosystem, not an AXM-built tool by default.

This folder is for the AXM adapter plan around Hermes.

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

## First target

The first AXM Hermes adapter should be tiny:

```text
approved Hermes status/digest source
  -> queue/*.json
  -> outbox/*.md proposal
```

It should not edit project files directly.

## Do not copy blindly

Do not import Hermes code into AXM until:

- source repo is confirmed
- license is checked
- integration route is chosen
- private/runtime files are excluded
- adapter test is defined

## Safety

Default access is none.

Every source must be allowlisted.

Every write should be proposal-only until approved.

No private logs, tokens, API keys, state databases, sessions, account data, or `.env` files belong in the public repo.
