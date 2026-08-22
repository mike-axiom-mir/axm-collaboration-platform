# Code Capability Fabric signed Git object-inventory steward run v2.3

Status: `TEST`

This append-only run adds one narrow reliability rung after the v2.2 exact schema-packet comparator. It accepts two inert, host-supplied Git object inventory observations, verifies their exact consent-bound Ed25519 signatures and time windows, and deterministically reports `MATCH` or typed `DRIFT` over object identifiers, declared types, and declared sizes.

The result is grounded but deliberately incomplete. The comparator opens no repository, executes no Git command, reads or rehashes no object bytes, uses no network, spawns no process, writes no files, and imports or executes no mirror runtime. A signed host statement still does not prove that a repository was enumerated completely. `MATCH` therefore means equality only inside the two exact signed observations—not full clone completeness or mirror reliability.

The four AXM roots remain the first technical gate. Mike remains the final human merge gate. No merge, push, install, publish, promotion, machine default, persistent learning, or `CANON` change occurred.

Implementation lineage:

- Base: `a580f6496fa57c84f994447d03e9569119796b49`
- First implementation commit: `b897fec07452b6b6ded5e9b5a85fbd559d27a802`
- Corrected tested implementation tip: `ef5d865e10a95e52f2854eb2df721635bfe083d1`
- Branch: `codex/code-capability-fabric-git-object-inventory-v2.3`

One development correction is intentionally preserved: the first implementation commit appended discovery text to the intake-pinned `shared/code-capability-fabric/README.md`. The old intake selftest exposed the byte drift, and the corrected tip restores the file exactly. New documentation now lives only in the new v2.3 README.
