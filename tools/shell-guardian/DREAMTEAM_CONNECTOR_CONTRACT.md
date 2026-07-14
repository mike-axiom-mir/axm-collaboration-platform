# AXM Dreamteam Connector Contract

Status: design baseline for future multi-model collaboration

The Dreamteam is a room above independent AI connectors. It must never turn
several identities into one untraceable process.

## One seat, one boundary

Every connected AI occupies a separate seat with:

- a stable identity id and connector id;
- an explicit model/provider binding;
- its own heartbeat and last-seen timestamp;
- its own task, context packet, token/time budget, and allowed tools;
- a private memory stream plus explicitly shared wisdom only;
- a visible state: offline, idle, thinking, acting, paused, tripped, or error;
- an independent pause control and circuit breaker;
- an append-only action and decision audit stream.

No seat may inherit another seat's identity, secrets, private memory,
permissions, or unfinished actions.

## Room coordinator

The coordinator may distribute proposals, request critiques, compare evidence,
and ask for a synthesis. It may not silently grant permissions or merge
identities.

A task moves through these states:

1. Human or authorized machine user creates the shared objective.
2. Coordinator creates a bounded task packet for each seat.
3. Seats return proposals and evidence under their own names.
4. Conflicts remain visible; consensus is not manufactured.
5. A designated builder may act only through its own gate and connector.
6. The verifier checks the result independently.
7. Wisdom is proposed after review and is never learned automatically.

## Safety without compulsory jailing

Creation may run with normal filesystem access when the user opts in. Risk is
balanced with layered recovery and interruption:

- pre-action gates for severe, evidence-based trigger classes;
- a separate breaker per connector plus a room-wide stop-agents control;
- connector heartbeat loss changes that seat to offline immediately;
- checkpoints and backups remain outside the acting model's authority;
- audit events survive a trip and cannot be erased by resetting the breaker;
- restarting a tripped seat requires an explicit user or authorized machine-user
  action.

A tripped connector must not take down healthy seats. The room can continue in
degraded mode or reassign unfinished work after showing the user what changed.

## Minimal connector adapter

Each adapter should expose the same small surface:

```text
inspect() -> identity, provider, model, capabilities, health
start(taskPacket) -> runId
pause(reason)
resume(runId)
stop(reason)
heartbeat() -> state, lastSeen, currentAction
events(since) -> append-only audit entries
```

Shell-capable adapters additionally declare their hook/gate status and breaker
state. A missing Guardian is visible as `unprotected`, never reported as healthy.

## First proof

Grok Build is the first shell-capable adapter proof. It remains a separate
identity and process, uses the AXM Shell Guardian `PreToolUse` hook, and can be
stopped without pausing Nova, Gemini Local, Axiom/Mir, or the human connector.

