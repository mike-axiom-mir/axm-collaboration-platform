# Governance and Sharing

## Source integrity

Every module carries provenance. Every sealed module or recipe package carries a required SHA-256 digest over canonical package content. Integrity proves whether the file changed after packaging; it does not prove authorship or legal ownership by itself.

## Consent and license gate

The engine deliberately defaults to `UNSET — choose before public sharing`. A generated package marks sharing consent as unchecked. A steward should verify:

1. Who created each source component?
2. Does the creator have the right to share it?
3. Does the intended license permit reuse and derivatives?
4. Does the package contain personal, confidential, branded, or restricted material?
5. Are credits and change history accurate?

## Built-in protection

Imported packages cannot silently replace built-in definitions. Identical bundled built-ins are skipped; altered built-ins cause the import to stop.

## Transactional import

Review validates the complete candidate package graph, including required integrity, duplicate IDs, cycles, closure limits, renderer declarations, and built-in collisions. Import occurs against a staged registry. The live registry changes only after the full candidate state validates, so a later failure cannot leave an earlier package module installed.

## Version and rollback

Shared modules should be immutable per version. Changes create a new version. Current local snapshots protect the recipe and custom module definitions together, while file exports provide portable rollback outside browser storage. Legacy recipe-only snapshots are restored without pretending to contain custom definitions.

## Community package policy direction

A future community library should accept declarative packages only, display provenance before install, show dependency closure and target support, flag unknown licenses, run visual/performance tests, and keep explicit removal and rollback controls. Remote auto-install is outside v1.

## Integrity behavior in local browser contexts

Package verification remains SHA-256 even when a local browser does not expose Web Crypto. The bundled portable SHA-256 path is deliberately cryptographic, preventing a silent downgrade to a weak checksum.
