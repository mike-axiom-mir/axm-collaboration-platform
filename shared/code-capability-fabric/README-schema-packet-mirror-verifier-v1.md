# Code Capability Fabric schema-packet mirror verifier v1

Status: `TEST`

This is a deliberately small rung toward mirror reliability. A trusted host supplies one previously verified four-file Fabric schema packet and one inert copied packet as bytes. After the four-root gate, exact grounded-consent scope, and an exact interactive declaration, the pure verifier returns either `MATCH` or typed `DRIFT`.

The comparison is directional only so evidence remains readable; `SOURCE` does not mean morally authoritative and `MIRROR` does not mean subordinate. A match proves only that the four path-and-byte pairs are identical to the verified source packet. Drift reports added, removed, changed, and unchanged paths with digests and byte lengths. File contents are not placed in the receipt.

## Why this remains detached

The unfinished Workshop `mirror-code-clone` module remains `EXPERIMENTAL`. This verifier does not import, connect, execute, or mutate it. It executes no Git command, inspects no object database or ref, contacts no remote, proves no sender/receiver delivery, and makes no full-clone or recovery claim. It is a future input contract and local test gate, not a clone implementation.

Paths are restricted to canonical NFC relative paths with forward slashes. Traversal, absolute and drive paths, backslashes, alternate-stream colons, Windows-reserved device names, trailing dot/space aliases, invalid Windows filename characters, oversized segments, and case-insensitive collisions are refused. Filesystem canonicalization and Windows short-name aliases are still unobserved and remain explicit limitations.

## Authority and resource boundary

The module has no permissions or authority. It performs no filesystem read or write, network use, child process, packet execution, merge, install, publish, promotion, CANON change, machine-default activation, or persistent-learning admission. Mike remains the final merge gate; the four AXM roots are the technical gate evaluated first.

Packet file counts, individual file bytes, aggregate packet bytes, conservative total input bytes, and receipt output bytes are bounded. Duration, memory, and attempts across separate invocations are declared but not enforceable by this pure function and are not claimed as enforced. The interactive declaration is not cryptographic human identity, replay prevention, informed-understanding proof, trusted time, or live revocation.
