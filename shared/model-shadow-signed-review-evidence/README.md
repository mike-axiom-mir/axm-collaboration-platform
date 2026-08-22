# Model Shadow signed review evidence

Status: `TEST`

This permissionless leaf closes one narrow integrity seam after the Model Shadow
Challenger Gate. It verifies detached Ed25519 signatures that bind the exact
reviewed handoff, proposal, Challenger Lab plan, Review Inbox evidence, retained
approval timestamp, and caller-supplied challenge.

```text
exact-rebuild reviewed challenger handoff
  + exact caller-supplied key policy
  + detached Ed25519 approval attestations
  -> signature and signing-key-possession evidence
  -> no execution authority
```

The key policy is deliberately labelled
`CALLER_SUPPLIED_UNAUTHENTICATED`. A valid signature proves possession of a key
allowed by that exact policy. It does **not** prove that the policy is a trusted
host root, that a key belongs to the named person, that a signer is human, that
the challenge was used only once, or that the caller-supplied verification time
is externally trusted.

The receipt retains key fingerprints and actor digests, not raw actor strings,
public keys, signatures, discussion, vote notes, private context, or model
output. The leaf ingests no private key, writes no state, invokes no provider,
and cannot execute, evaluate, adopt, train, install, promote, merge, mutate the
Foundation, or canonize anything.

Run:

```powershell
node shared/model-shadow-signed-review-evidence/selftest.js
```
