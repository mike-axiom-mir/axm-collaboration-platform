# AXM Hermes Runtime Adapter v0.4

Status: EXPERIMENTAL / draft PR / candidate for local intake.

Hermes Agent remains external MIT-licensed runtime code from Nous Research. AXM uses Hermes as an execution substrate; it does not make Hermes a root, canon authority, or silent owner of AXM memory/skills.

## Build philosophy

This lane is designed for fast experimentation with deterministic repair rather than fragile perfection-before-run:

```text
build -> launch bounded run -> collect evidence -> repair -> improve
```

Failures are expected to be diagnosable. Each Hermes launch gets a fresh run capsule and ends in an AXM Return Packet; interrupted capsules can be closed later by `repair` instead of remaining ambiguous state.

## Source integrity

`hermes-source.lock.json` pins all three reviewed source identities:

- official upstream repository
- exact 40-character commit
- exact Git tree
- observed upstream package version

`verify` checks origin, detached HEAD, tree, version, and clean worktree. A branch, floating tag, dirty checkout, changed tree, or mismatched package version is not accepted as the reviewed runtime.

## Two runtime postures

### Research — default

Research posture is a narrow deterministic tool allowlist. It can inspect/read/research after action consent is enabled, but it cannot mutate files or use world-action tools merely because Hermes knows how.

Default research tools:

```text
web_search
web_extract
read_file
search_files
vision_analyze
skills_list
skill_view
session_search
clarify
```

### Operator

Operator posture means capabilities *may* be granted. It is not blanket authority.

Separate switches default OFF for:

- file mutation
- terminal/process execution
- arbitrary code execution
- computer use
- delegation
- scheduling
- messaging
- Hermes memory mutation
- Hermes skill mutation
- browser interaction
- external-account actions
- Home Assistant actions
- project changes
- coordination/Kanban mutation
- generation/provider-spend actions

Unknown future tools fail closed unless explicitly added to local `allowed_tools`. The immutable Hermes source pin also prevents a new upstream tool surface from arriving silently through `main`.

## Provider credential egress guard

Default provider posture is:

```text
provider_egress.mode = local_only
```

Before Hermes starts, AXM creates the child environment from scratch and strips inherited secret-like environment variables. Loopback provider pairs such as LM Studio or an OpenAI-compatible endpoint are restored only when their base URL resolves to `localhost`, `127.0.0.1`, or `::1`.

The local-only path also removes inherited HTTP/HTTPS/ALL proxy variables and forces loopback hosts into `NO_PROXY`.

Remote provider mode is explicit:

```text
provider_egress.mode = explicit_remote
provider_egress.allowed_secret_env = [ ... exact variable names ... ]
```

Even then AXM restores only the explicitly named secret variables rather than inheriting every key/token in the shell.

### Truth boundary

This is a **credential/environment egress guard**, not network namespace isolation. It does not prove the process physically cannot reach the internet. Provider observer receipts flag a remote provider base URL seen under `local_only`, but observer hooks cannot retroactively block an already-dispatched provider request.

For a hard offline guarantee, use actual OS/container/VM network isolation.

## Per-run evidence capsule

Every `start` creates:

```text
runtime/runs/<run-id>/
  run-manifest.json
  state/
  receipts/
  provider-receipts/
  session-events/
  return-packet.json
```

### Run Manifest

Records only safe launch metadata:

- pinned source commit/tree/version
- policy hash
- Hermes profile hash
- research/operator posture
- consent state
- provider-egress posture
- invocation argument *shape*, never raw CLI argument values
- credential-guard counts, never secret names or values

### Tool receipts

Each tool completion becomes one independently SHA-256-hashed metadata receipt. Raw tool arguments, paths, results, prompts, and identifiers are excluded.

### Provider receipts

Hermes provider lifecycle hooks record metadata such as provider, model, loopback-vs-remote base URL scope, retry/count/duration information, and policy-mismatch status. Raw request/response content is excluded.

### Session events

Session-end/finalize hooks retain only completion/failure/interruption/outcome metadata and hashed identifiers.

### Return Packet

At process exit AXM aggregates the run-local receipts into `axm.hermes-return-packet/v1` with deterministic receipt-set hashes and an evidence summary.

Every packet is:

```text
canon: false
review_required: true
promotion: candidate-only
```

A successful process exit is not rewritten into a claim that the task was correct.

## Repair path

```text
node hermes-bootstrap.js repair
```

Repair currently:

1. validates local policy
2. reconciles the AXM-managed Hermes hook block
3. preserves user provider/model configuration outside that managed block
4. backs up the existing Hermes config before managed changes
5. verifies local provider-credential policy
6. finds interrupted run capsules that lack Return Packets
7. closes those capsules into recovery Return Packets rather than deleting evidence

If the managed config markers or an unmanaged top-level `hooks:` block conflict, ordinary repair refuses the rewrite. `repair --force` is the explicit take-over path and backs up the previous config first.

## Local command path

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

`install`, dependency installation, action consent, and runtime start remain separate explicit operations.

## Consent behavior

Runtime availability is not action authority.

Hermes can start with consent OFF; the fail-closed `pre_tool_call` hook then refuses tool dispatch. Consent can be revoked while Hermes is running because the gate reads local policy on each tool call.

Consent transitions also receive a metadata-only local audit entry containing previous/new state and a hash of the reason, not the raw reason text.

## Hermes hook integration

The AXM-managed Hermes profile currently wires:

```text
pre_tool_call      -> axm_gate.py          (fail closed)
pre_llm_call       -> axm_context.py
post_tool_call     -> axm_receipt.py
pre_api_request    -> axm_provider_receipt.py
post_api_request   -> axm_provider_receipt.py
api_request_error  -> axm_provider_receipt.py
on_session_end     -> axm_session_event.py
on_session_finalize -> axm_session_event.py
```

`axm_context.py` tells the model that capability is not permission, blocked actions must not be routed around, evidence must remain distinct from inference/proposal, and Hermes learning is candidate material rather than AXM canon.

## Important isolation boundary

The pre-tool gate is a real Hermes authorization seam. It is **not an OS sandbox**.

Do not describe local terminal, arbitrary code execution, or computer-use as contained merely because the hook exists. If those capabilities are enabled, place Hermes behind a real Docker/VM/other isolated backend when host containment matters.

Likewise, the Hub/Foundation sandbox remains an intended architecture boundary, not a claimed kernel-level enforcement mechanism here.

## Existing loopback proposal layer

`hermes-runner.js` remains available on `127.0.0.1:8791` for the early AXM proposal/queue/prompt-pack path. Its legacy `.hermes-consent.json` state is intentionally still separate from `runtime/policy.json`.

No silent semantic merge was performed between those two consent systems.

## What v0.4 implements

- exact upstream repository + commit + tree + version verification
- explicit locked dependency install
- managed/preservable/repairable Hermes hook profile
- config snapshots before repair changes
- research/operator authority postures
- unknown-tool fail-closed behavior
- explicit file mutation capability + path containment checks
- local-only provider credential/environment guard
- explicit remote credential allowlist mode
- fresh counter state per launch
- hashed metadata-only tool receipts
- provider/model/base-scope evidence receipts
- session outcome receipts
- per-launch run manifest
- candidate-only Return Packet
- interrupted-run recovery
- legacy proposal layer preserved

## Still not claimed

- OS/container/VM isolation
- hard network namespace isolation
- provider observer hook as a provider-request blocker
- automatic Merge Gate approval
- automatic Return Packet promotion
- Hermes memory or generated skills as AXM truth/canon
- identity/package-profile binding
- safe blanket operator authority
- autonomous upstream/source-lock upgrades

## Public boundary

Do not commit runtime state, provider credentials, `.env`, receipts, session databases, local policy decisions, downloaded Hermes source, backups, audit state, or account data. `.gitignore` keeps those local surfaces out of the public source lane.

**AXM rule:** use Hermes' power, preserve evidence, make authority explicit, and make failure repairable.
