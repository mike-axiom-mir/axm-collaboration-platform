# KNOWN LIMITATIONS — v0.9.1

- Final visual inspection in Windows Chrome or Edge remains a human action marked **LOCAL VALIDATION REQUIRED**. The browser-check record is local evidence, not automated visual proof.
- Blender, Godot, ComfyUI, Unity, Unreal, and MaterialX adapters remain scaffolds. Target-engine behavior and visual parity are **LOCAL VALIDATION REQUIRED**.
- Browser storage is origin-specific. `http://127.0.0.1:8765`, another explicit port, `localhost`, and direct-file mode can expose different workspaces.
- Direct-file mode does not receive the local server’s response headers and remains a separate browser origin controlled by browser file policies.
- Browser storage is working state, not a durable backup. Rescue points live in the same browser profile and storage origin as the workspace; export safety capsules to an independent location.
- Safety-capsule replacement restores defined managed data areas, not arbitrary browser data or external files.
- Browser downloads and already-written external files cannot be rolled back by a browser-storage transaction.
- FNV-1a-32 integrity is non-cryptographic and collision-prone. It can show accidental or obvious change but is not a digital signature, identity proof, authenticity claim, or adversarial trust system.
- Current workspace, family, project, batch, safety-capsule, and rescue packets with missing or invalid integrity are rejected; older unsealed copies may need recovery through the version that created them.
- CSV/JSON batch intake is intentionally bounded to 100 rows, 100 columns, and 4,000 characters per cell. Ragged CSV is rejected rather than repaired implicitly.
- Imported growth still follows quarantine, draft, explicit approval, and dependency rules. Built-in registry molds are not hot-installed from arbitrary external packages.
- Port 8765 is stable by design. If an unrelated process occupies it, the launcher refuses to move automatically; choosing another port explicitly creates a separate browser-storage origin.
- Current Chrome and Edge are the supported local browser targets. Very old browsers, including those without current `<dialog>` and accessibility behavior, are outside the target.
