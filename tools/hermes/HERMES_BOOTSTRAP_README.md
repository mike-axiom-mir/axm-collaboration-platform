# AXM Hermes Bootstrap / Runtime Launcher

Status: TEST / review required.

This launcher keeps Hermes external while giving AXM a reproducible source pin and a local policy boundary.

## Reviewed source

`hermes-source.lock.json` records the reviewed upstream repository and one full immutable commit SHA. `install` does not trust `main`, a floating tag, or an arbitrary local source override.

On install the launcher:

1. clones the reviewed upstream repository if needed
2. checks that `origin` still matches the reviewed source
3. refuses a dirty checkout instead of overwriting local work
4. fetches the exact locked commit
5. checks it out detached
6. verifies `HEAD` equals the lock

A later Hermes upgrade requires a deliberate review and a new lock commit.

## Commands

From `tools/hermes/`:

```text
node hermes-bootstrap.js doctor
node hermes-bootstrap.js install
node hermes-bootstrap.js verify
node hermes-bootstrap.js deps
node hermes-bootstrap.js prepare
node hermes-bootstrap.js consent on "reason"
node hermes-bootstrap.js consent off "reason"
node hermes-bootstrap.js start
```

### `doctor`

Reports Git, Python, Node, uv, source lock, checkout verification, AXM profile state, local action consent, and workspace path.

### `install`

Performs the immutable source checkout and verification only. It does not silently install Python dependencies.

### `deps`

Requires the source pin to verify, then explicitly runs the upstream `uv sync --locked` dependency path.

### `prepare`

Creates local ignored state under `runtime/`, including an AXM-owned `HERMES_HOME`, workspace, policy, state counters, and receipt folder. It installs the AXM shell hooks in the generated local Hermes `config.yaml`.

If that generated config already exists but differs, `prepare` refuses to silently replace it. `prepare --force` is the explicit replacement path.

### `consent`

Changes action consent in `runtime/policy.json`. Consent starts OFF.

### `start`

Refuses to launch unless the upstream checkout still matches the reviewed immutable pin and the AXM runtime profile exists. It starts Hermes with:

- AXM `HERMES_HOME`
- project-local Hermes plugins disabled
- Hermes YOLO mode disabled
- AXM policy/workspace/state/receipt paths supplied through the environment
- working directory set to the AXM Hermes workspace

Arguments following `start` are passed through to the Hermes CLI.

## Hook boundary

The generated Hermes profile uses:

- `pre_tool_call` -> `axm/axm_gate.py` with `fail_closed: true`
- `pre_llm_call` -> `axm/axm_context.py`
- `post_tool_call` -> `axm/axm_receipt.py`

The pre-tool hook is the runtime authorization seam. It is deliberately fail closed, so a missing/crashed/invalid gate does not silently grant a tool call.

## What this still does not prove

The hook is not an OS sandbox. It does not make a local shell safe merely because a command came through Hermes. Terminal, arbitrary code execution, computer-use, delegation, scheduling, and messaging therefore default OFF in AXM policy.

The tool gate also does not gate the model-provider request itself. If a user configures a cloud provider, model conversation data can leave the machine according to that provider path. Provider egress/local-model policy is a separate boundary and must not be implied by tool consent.

The old loopback `hermes-runner.js` consent toggle remains separate from `runtime/policy.json` until intentionally unified.

## Rule

Pinned source is not canon. Runtime availability is not action authority. Tool authorization is not OS isolation. A Hermes memory, skill, or conclusion remains candidate material until AXM review promotes it.
