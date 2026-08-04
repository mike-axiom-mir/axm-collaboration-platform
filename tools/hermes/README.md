# Hermes Local Runner Module

Status: TEST scaffold / local wrapper.

Hermes is an external public open-source agent ecosystem, not an AXM-built or bundled runtime.

This folder currently contains two separate paths:

1. `hermes-bootstrap.js` checks prerequisites and can clone or start an explicitly configured external command.
2. `hermes-runner.js` serves a loopback-only local proposal control layer.

The control layer does not connect to the external Hermes runtime yet.

## Bootstrap path

Run from this folder:

```text
node hermes-bootstrap.js doctor
node hermes-bootstrap.js install
node hermes-bootstrap.js start
```

`install` and `start` require `hermes-source.local.json`. The public example is a configuration starting point, not live verification of the source, license, installation, command safety, or runtime readiness. Those commands are explicit CLI actions and are not gated by the control-layer consent toggle.

## Optional control-layer test

Run:

```text
node hermes-runner.js
```

Then check:

```text
http://127.0.0.1:8791/health
```

Consent starts OFF by default.

With consent OFF:

- health, consent state, and module-list reads work
- queue, proposal, prompt-pack add, and prompt-pack list routes are refused

With consent ON:

- `/queue` can write local task JSON under `queue/`
- `/proposal` can write local review-proposal Markdown under `outbox/`
- `/prompt-packs/add` can write a local prompt record under `../agent-tool-forge/prompt-packs/`
- `/prompt-packs/list` can list those prompt records

## Current control-layer endpoints

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

## Explicit limits

- The landing card is display-only.
- The control layer does not install, start, invoke, or verify Hermes.
- Identity binding, package profiles, Foundation sandboxing, Shell Review transport, and connector routing are plans, not implemented integrations.
- The consent toggle limits the control-layer write routes only; it is not a bootstrap or external-runtime permission gate.
- A configured external start command may have effects the wrapper cannot bound.
- Runtime, connector, source, license, and integration readiness remain `UNKNOWN` until checked on the local installation.

## Public boundary

No private logs, tokens, API keys, state databases, sessions, account data, `.env` files, local source config, or downloaded runtime belongs in the public repository.
