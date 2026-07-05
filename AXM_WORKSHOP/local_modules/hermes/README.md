# Hermes Local Operations Module

Status: design / local module candidate.

Hermes is the proposed local operations module for AXM.

It is meant to help with boring continuity work:

- approved folder watching
- task packet creation
- local queue management
- log summaries
- handoff packets
- proposal files for Mike review

Hermes is not the whole AXM brain.

Hermes should work behind the AXM Foundation Gate and bridge rules.

## First target

The first working Hermes should be tiny:

```text
inbox/*.txt
  -> queue/*.json
  -> outbox/*.md proposal
```

It should not edit project files directly.

## Safety

Default access is none.

Every source must be allowlisted.

Every write should be proposal-only until approved.

No private logs, tokens, API keys, or account data belong in the public repo.
