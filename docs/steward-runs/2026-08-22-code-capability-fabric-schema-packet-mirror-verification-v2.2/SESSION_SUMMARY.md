# Session summary

The v2.2 steward run added one detached `TEST` capability: compare one exact retained four-file Fabric schema packet with one inert host-supplied copy and return deterministic `MATCH` or typed `DRIFT` evidence.

The retained exact copy matched all four paths and 13,931 bytes. A separate controlled one-byte acceptance-matrix change produced precise `DRIFT`. The two compact receipts retain no packet contents, stdout, or stderr. The new focused selftest passed 130 adversarial checks; all 10 required Workshop suites and 23 inherited/new focused implementation suites passed. The broad warning baseline remains 41 with zero failures.

The capability comparator moves the narrow local packet-copy rung from `BLOCKED` to `READY`. Overall remains `DEGRADED`: the unfinished mirror clone was not connected or run, and Git objects, refs, remotes, transport receipts, complete clone behavior, recovery, stronger human authentication, replay prevention, trusted time, and live revocation remain absent.

During review, four overclaims or gaps were corrected before closeout: Windows alias coverage was tightened, emitted delta arrays and reconstructed packet summaries became strict, cross-invocation attempt enforcement was changed to false, and exact equality changed from digest-only comparison to direct buffer equality.
