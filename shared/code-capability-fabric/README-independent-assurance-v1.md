# Independent assurance review

Status: `TEST`

This Workshop-native layer applies AXM's four roots before any human merge or
executor decision:

1. **Truth:** distinct cryptographic keys prove distinct keys, not independent
   organizations, competence, or honest measurement.
2. **Agency / non-domination:** the host observer cannot count toward an
   independent assurance quorum about its own availability evidence.
3. **Continuity:** the v1 and v2 planners and readiness gate remain unchanged;
   this is an additive review contract over their exact records.
4. **Wisdom over speed:** a complete cryptographic quorum stops at
   `HUMAN_POLICY_ACCEPTANCE_REQUIRED` because v2 requests do not bind the
   assurance trust-policy digest.

`code-independent-assurance-review-v1.js` verifies an existing v1 readiness
assessment, one self-digesting trust policy, exact Ed25519 public-key records,
and signed attestations for every assurance record. Each policy rule declares
the exact verifier-key references and minimum signature count for one assurance
schema. Attestations bind the readiness digest, policy digest, assurance-record
reference, signing key, and bounded signing time.

Later Workshop organs may explicitly import this pure contract from `shared/`.
Its presence does not auto-run it, create ambient authority, or raise its status
above `TEST`.

The host observer is rejected from every trusted verifier set. Its public-key
bytes also cannot re-enter under a different identifier, and one public key
cannot masquerade as several quorum members. Unknown, missing, duplicated,
stale, future, untrusted, incorrectly scoped, or cryptographically invalid
attestations produce typed holds. Input ordering does not change a valid review
digest.

## Deliberate human policy gate

The v2 request contract predates independent verifier policy and therefore
does not pin this policy's digest. The review output always preserves:

```text
TRUST_POLICY_NOT_BOUND_BY_V2_REQUEST
ORGANIZATIONAL_INDEPENDENCE_NOT_PROVEN
authority: NONE
```

When all cryptographic quorums pass, the status is
`HUMAN_POLICY_ACCEPTANCE_REQUIRED`, and the next gate asks Mike to accept or
reject that exact policy before any executor decision. This is reusable
technical infrastructure, not automatic authority.

The module cannot read files, use a network, load or execute providers, grant
permissions, authorize an executor, write output, install, promote, merge, or
change `CANON`. Supplied experimental runtimes remain data and are not used.

Run the synthetic no-provider selftest with:

```powershell
node shared/code-capability-fabric/selftest-independent-assurance-v1.js
```
