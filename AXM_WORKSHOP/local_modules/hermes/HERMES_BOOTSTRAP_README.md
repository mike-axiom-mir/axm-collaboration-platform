# Hermes Bootstrap Wrapper

Status: TEST scaffold for reducing setup pain.

This is the AXM wrapper for setting up and starting the real external Hermes agent/runtime locally.

It is not meant to replace Hermes.

## Goal

Users should not manually fight setup across many pages.

The local module should eventually become:

```text
one command
  -> check requirements
  -> install/clone verified Hermes source
  -> start Hermes
  -> expose AXM consent-controlled module layer
```

## Current command

From this folder:

```text
node hermes-bootstrap.js doctor
```

This checks:

- git
- python
- node
- local source config
- local Hermes folder

## Source config

The real Hermes source must be verified before this wrapper clones it.

Copy:

```text
hermes-source.example.json
```

to:

```text
hermes-source.local.json
```

Then set the verified Hermes repo URL and start command.

The local config is ignored by Git.

## Why not hardcode yet?

There are many public repos named Hermes.

AXM should not guess and install the wrong one.

Once the real source is locked, this wrapper becomes the one-click path.

## Future complete path

```text
node hermes-bootstrap.js doctor
node hermes-bootstrap.js install
node hermes-bootstrap.js start
```

Then AXM consent/module layer connects to the local Hermes runtime.

## AXM add-ons around Hermes

After Hermes is running, AXM can layer:

- prompt vault
- templates
- reasoning shell specialist
- wisdom/log digest
- task queue
- bridge/provider adapter

## Rule

Hermes is the runnable agent.

AXM supplies the wrapper, consent gate, module seams, and project-specific add-ons.
