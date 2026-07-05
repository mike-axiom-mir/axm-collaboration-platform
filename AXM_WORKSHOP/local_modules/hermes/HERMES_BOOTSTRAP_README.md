# Hermes Bootstrap Wrapper

Status: TEST scaffold for reducing setup pain.

This is the AXM wrapper for setting up and starting the real external Hermes Agent locally.

It is not meant to replace Hermes.

## Locked source

Verified public source:

```text
https://github.com/NousResearch/hermes-agent
```

License checked:

```text
MIT License
```

Official docs installer:

```text
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

Windows PowerShell early beta installer:

```text
irm https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.ps1 | iex
```

After install:

```text
hermes
hermes doctor
hermes model
hermes tools
```

## Goal

Users should not manually fight setup across many pages.

The local module should become:

```text
one command
  -> check requirements
  -> install real Hermes from NousResearch/hermes-agent
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

The public example now points at the locked Hermes source.

Local overrides can be made by copying:

```text
hermes-source.example.json
```

to:

```text
hermes-source.local.json
```

The local config is ignored by Git.

## Next complete path

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
