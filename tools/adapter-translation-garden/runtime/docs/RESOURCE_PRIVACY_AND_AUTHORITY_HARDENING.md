# Resource, privacy, provenance, and authority hardening

Runs 41–45 add four protections without expanding runtime power:

1. **Authority audit:** static AST inspection rejects imports and calls that would add sockets, subprocesses, native FFI, dynamic execution, or filesystem writes to detached modules.
2. **Resource budgets:** modules receive explicit advisory intake ceilings for bytes, depth, node count, output size, and expansion ratio. These are not measurements and do not promise hard isolation.
3. **Privacy/provenance:** classification can only stay equal or rise during merge. Downgrade and release require explicit approval and matching consent scope.
4. **Self-testing packs:** every prototype pack contains its own manifest, checksums, assurance profile, and a smoke test that validates boundaries and imports its module without calling its operation.
