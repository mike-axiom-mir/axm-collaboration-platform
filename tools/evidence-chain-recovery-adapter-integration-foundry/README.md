# AXM Evidence Chain Recovery Adapter Integration Foundry

Status: `TEST`

This Foundry closes `capability.plan.evidence-chain-recovery-adapter-integration/v1`. It does not close `capability.apply.evidence-chain-reviewed-recovery/v1`.

It accepts one UTF-8 JavaScript adapter source candidate as inert data, an unexpired evidence-chain application plan, a passing fixture-conformance receipt, and the current Recovery Center manifest and contract. It emits `axm.evidence-chain-recovery-adapter-integration-acceptance-packet/v1`.

The packet binds:

- the exact adapter source SHA-256 and byte count, without a path, name, or source body;
- the application plan ID and digest;
- the fixture-conformance run, probe, and profile digests;
- current Recovery Center manifest and contract digests;
- exactly one required permission, `recovery.apply`;
- twelve ordered production acceptance gates and their native proof surfaces.

## Current blockers

A packet intentionally reports:

- candidate JSONL to Recovery Center request transport is not implemented;
- the production build has not been loaded or compared with the reviewed artifact digest;
- allowed and denied identities have not been independently exercised;
- live stale, tamper, and drift refusals have not been observed;
- live apply, post-apply inspection, rollback, restart persistence, and browser journey remain untested.

The first three gates are static evidence and can pass inside this Foundry. Candidate staging remains `BLOCKED`; all consequential gates remain `NOT_RUN`.

## Source boundary

Adapter source is converted only to a string, bounded to 2 MiB, checked for NUL bytes, and hashed. The core does not call `eval`, `Function`, dynamic `import`, `require`, a parser, a package manager, a filesystem writer, or a network client.

The browser reads an explicitly selected source file with `File.text()`. It fetches only the served local Recovery Center manifest and contract. Download is explicit.

## Machine use

```js
const Foundry = require('./evidence-chain-recovery-adapter-integration-core');

const packet = await Foundry.build(adapterSourceText, applicationPlan, conformanceReceipt, recoveryManifest, recoveryContract, {
  acknowledgeArtifactIsData: true,
  acknowledgeNoAuthority: true,
  acknowledgeIndependentIdentityTests: true,
  acknowledgeLiveRollbackRequired: true,
  generatedAt: new Date().toISOString()
});
```

## Limits preserved

- Static declarations are not runtime enforcement proof.
- Fixture conformance is not production behavior or authorization proof.
- No code safety or syntax certification is made.
- No permission is requested, granted, or revoked.
- No identity, secret, target path, evidence payload, command, or source body enters the packet.
- No adapter is installed, loaded, executed, promoted, or made CANON.
