# Verification source evolution review

Status: `TEST`

This permissionless leaf reviews source-byte drift already identified by a
verification snapshot continuity receipt. A changed current digest receives
the strongest coverage state only when a later verification receipt:

1. explicitly records that exact path and current digest;
2. has a valid declared self-digest;
3. is later than the historical receipt; and
4. has its own tracked sources classified current by a digest-valid continuity
   receipt.

Weaker and absent evidence remain separate states. A later receipt proves that
the current bytes were attested at that later checkpoint. It does not prove the
original author's intent, semantic correctness, absence of regression, human
benefit, or `CANON` worthiness.

An attestation-only row may be bridged when the candidate receipt has its own
digest-valid evolution review and every candidate drift row is strongly routed
to later current receipts. That proves a bounded transitive evolution route. It
does not make the original candidate receipt byte-current.

Legacy receipts without self-digests can be externally anchored from the
current moment forward without rewriting them or claiming integrity before the
anchor. The optional Game Night generated-view bridge recognizes only the exact
`verify.js` writer, report path/schema, volatile `checkedAt` field, and a bounded
semantic-count comparison. Semantic sameness is not historical byte sameness.

The module performs no I/O and grants no execution, write, permission,
installation, promotion, merge, Foundation, or `CANON` authority.
