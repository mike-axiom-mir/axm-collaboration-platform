# AXM Hermes Bootstrap / Runtime Launcher v0.4

Status: TEST / local-intake candidate.

The launcher keeps Hermes external while AXM owns source verification, local policy, credential filtering, run evidence, and repair.

## Reviewed source

`hermes-source.lock.json` pins:

```text
repository
commit SHA
Git tree SHA
observed package version
```

`verify` requires all four to match plus a clean worktree. Floating `main`, tags, dirty checkout, changed tree, or version drift are refused.

## Command path

```text
node hermes-bootstrap.js doctor
node hermes-bootstrap.js install
node hermes-bootstrap.js verify
node hermes-bootstrap.js deps
node hermes-bootstrap.js prepare
node hermes-bootstrap.js repair
node hermes-bootstrap.js consent on "reason"
node hermes-bootstrap.js start
node hermes-bootstrap.js consent off "reason"
```

`install`, dependency installation, config preparation/repair, action consent, and runtime start remain separate explicit operations.

## Prepare vs repair

`prepare` creates local ignored runtime state and inserts an AXM-managed hook block into the Hermes profile.

The managed block has begin/end markers. Provider/model settings outside the block are preserved. Before changing an existing profile AXM creates a local backup according to `policy.repair`.

`repair` performs prepare/reconciliation plus:

- policy validation
- provider-credential policy check
- source-verification report
- closure of interrupted run capsules that never received a Return Packet

A conflicting unmanaged top-level `hooks:` block or broken AXM marker structure fails closed. `repair --force` is the explicit backed-up take-over path.

## Default posture

Fresh policy starts:

```text
posture = research
consent = OFF
provider_egress = local_only
```

Research posture uses a narrow read/research allowlist. Operator posture still requires individual capability switches; it is not blanket permission.

File mutation, terminal/process, execute-code, computer-use, delegation, scheduling, messaging, memory/skill mutation, browser interaction, external-account/home/project/coordination actions, and generation all default OFF.

Unknown future tools fail closed until explicitly reviewed.

## Provider credential guard

Before a Hermes child starts, inherited secret-like environment variables are stripped.

Under `local_only`, loopback provider credentials are restored only when the paired base URL points to `localhost`, `127.0.0.1`, or `::1`. Inherited proxy variables are removed and loopback `NO_PROXY` is forced.

Under `explicit_remote`, only exact secret environment-variable names in `provider_egress.allowed_secret_env` are restored.

If `HERMES_HOME/.env` contains secret keys inconsistent with the selected posture, start/repair refuses.

This is **not network isolation**. It reduces accidental credential/provider egress; Docker/VM/network namespace controls are still required for a hard offline guarantee.

## Per-run lifecycle

Each explicit `start` creates a fresh run capsule with its own counter state and evidence directories.

Hermes hook metadata produces:

- tool receipts
- provider/model/base-scope receipts
- session outcome events

The launcher creates `run-manifest.json` before execution and `return-packet.json` after exit. Raw prompts, responses, tool args/results, paths, CLI values, and secret names/values are not stored by AXM evidence files.

Interrupted capsules are not deleted; `repair` closes them into recovery Return Packets.

## Hook boundary

Managed Hermes hooks:

```text
pre_tool_call       -> axm_gate.py          fail_closed=true
pre_llm_call        -> axm_context.py
post_tool_call      -> axm_receipt.py
pre_api_request     -> axm_provider_receipt.py
post_api_request    -> axm_provider_receipt.py
api_request_error   -> axm_provider_receipt.py
on_session_end      -> axm_session_event.py
on_session_finalize -> axm_session_event.py
```

Provider observer hooks record evidence but cannot veto provider requests. The pre-tool hook is the blocking authorization seam for tools.

## Boundary

Tool authorization is not OS isolation. Credential filtering is not network isolation. Process exit zero is not proof the work is correct. Return Packets are candidates, never automatic canon.

The older loopback `hermes-runner.js` consent store remains separate from runtime policy until deliberately unified.
