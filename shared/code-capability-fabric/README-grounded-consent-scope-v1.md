# Grounded Consent Scope v1

Status: `TEST`

This additive Fabric seam turns a standing human settings policy and one exact
attempt proposal into a deterministic scope evaluation. It is provider-neutral
and domain-extensible: code, content, games, software, and future hardware may
share the consent grammar while supplying different domain-profile schemas and
different safety verifiers.

The seam binds:

```text
standing consent policy
  + exact subject and domain-profile references
  + exact pre-decision evidence references (for code, the prior four-root review)
  + byte-length-bound input references
  + requested actions, authority, data use, lifecycle effects, resources,
    evidence, re-consent triggers, stop conditions, and time window
  -> deterministic subset evaluation
  -> authenticated human decision still required
```

An `axm.grounded-consent-instance/v1` is a proposal to consent, not proof that a
person consented. A valid scope evaluation stops at:

```text
AUTHENTICATED_HUMAN_DECISION_REQUIRED
```

The later decision surface must first verify the referenced pre-decision
evidence, then authenticate the exact instance digest. Immediately before any
attempt, separate trusted components must still check live revocation, a
trusted clock, the domain safety profile, and host authorization.
For hardware, consent can never replace physical interlocks, bounded telemetry,
operator-presence rules, or an emergency stop.

Every instance carries mandatory re-consent triggers for subject, input,
domain-profile, action, authority, resource, evidence, lifecycle, policy, and
time-window drift. It also carries mandatory stop conditions for revocation,
scope and digest drift, policy drift, resource exhaustion, evidence or domain
safety failure, and expiry.

The policy and instance are sealed by deterministic digests. Those digests
provide integrity and lineage only. They do not prove policy authorship,
pre-decision evidence content, natural-person identity, informed understanding,
input bytes, or current time.

This module:

- imports no filesystem, process, worker, or network capability;
- reads no subject or artifact bytes;
- writes nothing and grants no permissions;
- does not authenticate a human or observe revocation;
- does not verify domain safety or authorize an executor;
- does not execute, install, publish, deploy, learn persistently, actuate
  hardware, promote, or change `CANON`.

Run:

```powershell
node shared/code-capability-fabric/selftest-grounded-consent-scope-v1.js
```
