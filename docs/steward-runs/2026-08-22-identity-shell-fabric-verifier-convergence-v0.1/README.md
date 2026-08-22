# Identity Shell Fabric verifier convergence run v0.1

Status: `TEST` over an `EXPERIMENTAL` leaf

This append-only run records the second hardening pass requested after commit `621efa038f6e0c9c528ef25b11c1864bf1058b33`. It converges the compiler-owned manifest verifier, the separately implemented independent verifier, the import/export gates, and the published schemas around the same inert shell boundaries.

The exact product checkpoint is commit `e5a62f6103c8258e23ab5dc6dbd2c59eeabc4293`. No Hub, Foundation, registry, parent fabric, live host, provider, model, network, filesystem runtime, robotic actuator, promotion route, or `CANON` surface was added or changed.

The run initially reproduced eight re-signed manifests accepted by the primary verifier and five accepted by the independent verifier. After hardening, a 26-case held-out corpus is rejected by the primary verifier, independent verifier, export gate, and import gate. The committed Keel collaborator manifest digest remains unchanged.

See `CHECK_RESULTS.json` for commands and verdicts, `EVIDENCE_ROUTES.md` for claim boundaries, `CAPABILITY_GAP.json` for typed held surfaces, and `SESSION_SEGMENT.seal.json` for the append-only session integrity record.
