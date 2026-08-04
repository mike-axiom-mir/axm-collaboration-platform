# Hermes Bootstrap Wrapper

Status: TEST scaffold for reducing setup pain.

This is an AXM wrapper for checking prerequisites and explicitly cloning or starting a locally configured external Hermes Agent source. It does not replace or bundle Hermes.

## Public source example

The checked-in example currently points to:

```text
https://github.com/NousResearch/hermes-agent
```

and records `MIT` as configuration metadata. The bootstrap does not independently fetch or verify source identity, license text, commit digest, installer safety, or runtime readiness. A local config may override the example.

## Current command surface

From this folder:

```text
node hermes-bootstrap.js doctor
node hermes-bootstrap.js install
node hermes-bootstrap.js start
```

`doctor` checks:

- Git
- Python
- Node
- local source config
- local Hermes folder

`install` requires an explicit `hermes-source.local.json`, then runs a configured Git clone into `external/hermes-agent` if that folder is absent.

`start` requires the local config and cloned folder, then runs the configured command from that folder. The external command's effects are outside the wrapper's bounded write surface.

## Source config

Copy:

```text
hermes-source.example.json
```

to the Git-ignored local file:

```text
hermes-source.local.json
```

Review the URL, branch, source, license, and command before using `install` or `start`.

## Separate control layer

`hermes-runner.js` is an optional loopback proposal service. Its consent toggle gates its own queue, proposal, and prompt-pack routes only. It does not gate bootstrap install/start and is not connected to the external Hermes runtime.

## Future integration seams

Identity binding, package profiles, Foundation sandboxing, connector routing, prompt-vault integration, and Shell Review transport remain planned rather than implemented.

## Rule

Explicit bootstrap is not runtime proof. Control-layer consent is not external-command authority. Runnable does not mean connected, reviewed, promoted, or CANON.
