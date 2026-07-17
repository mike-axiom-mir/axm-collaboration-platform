# Future world integration

The world remains a separate authoritative system. Mirror Core does not implement terrain, objects, agents, rendering, physics, construction, or a world simulation.

## Minimum world adapter

The future adapter should expose selected entity snapshots for materials, structures, processes, projects, evidence, and capabilities; stable native IDs/revisions; explicit units and uncertainty; provenance; and an operation allowlist. It must distinguish representation from physical truth.

Suggested first read-only milestone:

1. Connect with a specific consent receipt in `read_only`.
2. Export one authorised world entity plus evidence and limitations.
3. Register a Mirror representation without changing the world.
4. Let Project Room/Knowledge Canvas read only approved references.
5. Test disconnect/revocation and restore.

Suggested first write milestone:

1. Promote to `proposal_only` and generate a world-targeted packet.
2. Show exact native operation, preconditions, risk, evidence, and physical unknowns.
3. Add a world-native verifier and rollback capability.
4. Promote one allowlisted reversible operation to `approved_apply`.
5. Block stale world revisions and all unsupported actions.

Game controls stay outside this path. A player's movement/action intention is handled by shared controls and the world/game server. Only a durable, separately reviewed outcome—such as a project representation, evidence record, asset mapping, or declared capability—belongs in Mirror Core.
