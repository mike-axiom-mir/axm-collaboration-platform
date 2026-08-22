# Policy-bound assurance review

Status: `TEST`

This additive Workshop contract closes one narrow seam left by independent
assurance v1: the base v2 request has no field for the assurance trust-policy
digest. A strict policy-binding envelope now binds the exact normalized v2
request, exact trust-policy reference, exact assurance-schema set, and the four
AXM roots in their governing order.

The four roots are applied as technical acceptance gates:

1. **Truth:** structural binding proves exact byte-level relationships only. It
   does not prove who authored the envelope, that Mike accepted it, that the
   verifiers are independent organizations, or that execution is safe.
2. **Agency / non-domination:** the envelope cannot grant permissions or
   executor authority, and it cannot convert cryptographic review into consent.
3. **Continuity:** v2, readiness v1, and independent assurance v1 remain
   unchanged. This layer verifies their exact existing records.
4. **Wisdom over speed:** a complete binding stops at
   `AUTHENTICATED_HUMAN_DECISION_REQUIRED` with authority `NONE`.

The binding carries:

- a SHA-256 reference to the exact normalized v2 request;
- the exact self-digesting assurance trust-policy reference;
- the assurance schemas covered by that policy;
- the four-root order;
- a bounded time window;
- scope `INDEPENDENT_ASSURANCE_REVIEW_ONLY`; and
- authority `NONE`.

`code-policy-bound-assurance-review-v1.js` first rebuilds the complete
independent-assurance review. It then verifies the request digest, policy
digest, assurance scope, roots, and time bounds. Any mismatch becomes a typed
hold. The binding must exist no later than every assurance signature it governs,
preventing retrospective policy attachment. A successful record preserves these
limitations:

```text
BASE_V2_REQUEST_SCHEMA_UNCHANGED
REQUESTER_AUTHORSHIP_NOT_PROVEN
HUMAN_POLICY_ACCEPTANCE_NOT_PROVEN
ORGANIZATIONAL_INDEPENDENCE_NOT_PROVEN
```

Later Workshop organs may explicitly import this pure contract from `shared/`.
Presence does not auto-run it, authenticate a person, grant authority, or raise
it above `TEST`.

Run:

```powershell
node shared/code-capability-fabric/selftest-policy-bound-assurance-v1.js
```
