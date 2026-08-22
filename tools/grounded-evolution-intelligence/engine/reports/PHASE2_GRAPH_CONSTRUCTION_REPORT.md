# Phase 2 Graph Construction Report

## Status

**PASS — roadmap proof gate satisfied for the representative Phase 1 kernel.**

- Source graph hash: `sha256:53c654259c1670cd150985c4b5055e05b12e30e5ff26964badf36dd73be81830`
- Continuous event state hash: `sha256:bc872db74ad0b8d4e8945b53cba3b17e4fdc1555ab3d46b09e4da217282bc69a`
- Nodes: **89**
- Edges: **371**
- Dependency cycles detected: **0**
- Orphan nodes detected: **0**
- Stale verified dependency edges: **0**
- Unverified dependency/reuse edges retained visibly: **17**

## Graphs built

1. Module graph
2. Capability graph
3. Dependency graph
4. Evidence graph
5. Improvement Need graph
6. Research Need graph
7. Interface/Atlas interoperability graph

Exports are available as JSON, JSONL, DOT, Mermaid, and GraphML.

## Roadmap proof-gate answers

### Which modules depend on capability X?

For `live-technical-ground-truth`, direct declared consumers are AXM AI Team and
AXM Grounded Evolution Intelligence. The query also calculates transitive module
dependents through the sampled dependency graph.

### Which modules provide overlapping capability Y?

For the deterministic lexical term `technical ground truth`, both AXM AI Team
and AXM Technical Glasses expose matching sampled declarations. This identifies
an overlap seam; it does not claim the implementations are interchangeable.

### Which unproven component blocks the most work?

Current graph-reach leader: `axm:capability:evidence-receipt-integrity` affecting
**3** directly or transitively dependent modules.
All selected capability proof states remain UNKNOWN.

### Which improvement affects the largest verified scope?

`axm:need:build-capability-proof-ladder` reaches **16** graph nodes
with current retained evidence. This says the need has broad evidenced scope; it
does not prove the proposed intervention will help.

### Which modules have no current evidence?

**0** in this representative graph under the configured 30-day evidence window.
Current evidence means a retained non-obsolete record from the pinned intake,
not independent runtime reproduction.

## Validation findings retained

The graph does not hide source conflicts. It reports the Workshop count/release
conflict plus Asset Fabric and Game Hub version conflicts. It also separates
unverified dependency edges from genuinely stale previously verified edges.

## Authority boundary

The graph is read-only derived intelligence. It cannot execute a direction,
change source, grant permissions, promote CANON, merge GitHub work, or convert a
hypothesis link into proof.
