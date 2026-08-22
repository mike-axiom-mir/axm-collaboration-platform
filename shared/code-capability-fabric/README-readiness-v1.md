# Code Capability Fabric readiness gate

Status: `TEST`

`code-capability-readiness-v1.js` is an additive, provider-neutral proof gate
after the v2 planner. It makes one narrow transition technically possible:

```text
deterministically rebuilt ROUTE_PLANNED plan
  + exact Ed25519 observer public key bound to the request trust reference
  + valid signature over the exact host-observation digest
  + exact assurance records whose bytes, scope, verifier, freshness, and PASS
    verdicts match the signed observation
  = AUTHORIZATION_REQUIRED
```

`AUTHORIZATION_REQUIRED` is not permission to execute. It means the evidence
packet is internally consistent and cryptographically bound strongly enough to
place a decision before Mike or a future explicit host-authority gate. The
module always emits `authority: NONE` and cannot load a provider, read a
workspace, start a process, use a network, grant permissions, authorize an
executor, write output, install, promote, or change `CANON`.

## Why the readiness subject exists

The v2 observation contains assurance-record digests, while each assurance
record must bind the proposed execution scope. Putting the final `planDigest`
inside those records would create a circular hash dependency. The gate instead
builds `axm.code-capability-readiness-subject/v1` from the non-circular facts
that define the exact proposed work:

- request capability, schemas, input artifact byte references, policy, reuse
  rights, and trust policy, excluding only observation-record selection;
- exact provider id, version, and descriptor digest;
- observer, executor, observation window, and workspace-boundary references;
- host authority and resource-envelope digests; and
- planned authority, resource, and workspace-boundary bindings.

Every assurance record binds that subject digest. The signed observation binds
the exact assurance-record digests. The final readiness record then binds the
v2 plan digest, readiness-subject digest, verified observer reference, and
verified assurance-reference set without a cycle.

## What the proof does and does not establish

The gate proves deterministic plan agreement, public-key identity binding,
Ed25519 signature validity, assurance-record byte integrity, exact assurance
coverage, scope binding, freshness, verifier binding, and declared PASS
verdicts. Evidence artifacts inside each assurance remain byte-bound opaque
references; this module deliberately does not dereference them. A PASS record
therefore does not become a claim that this process directly observed live
resource enforcement.

The next real capability gap remains a repaired executor and independent
runtime proof inside a disposable sandbox. That work is not authorized here.
Generated-package source also remains on a research-only/direct-reuse hold
until Mike decides its rights are sufficient.

Run the synthetic, no-provider selftest with:

```powershell
node shared/code-capability-fabric/selftest-readiness-v1.js
```
