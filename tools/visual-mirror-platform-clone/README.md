# Visual Mirror · Platform Clone

Status: `TEST / HOLD FOR REVIEW`

This is a new apprentice Visual Mirror clone bound to the exact v0.7
Capability Weave produced from a real read-only scan of the local AXM Platform.
It shows platform capability-family evidence without executing Platform code or
gaining write, copy, merge, deletion, retirement, network, training, promotion,
or CANON authority.

The upstream archive remains byte-exact under the matching intake `source/`
folder. The separately sealed `platform-adapted/` copy contains one Windows
portability repair: the atomic-copy flush uses a write-capable file handle so
`os.fsync` works with Windows `FlushFileBuffers`.

## Evidence

- Clone DNA: `clone_dna.json`
- Sanitized Platform proof: `platform-proof.json`
- Local runtime workspace: `intakes/visual-mirror-platform-clone-v0.7.0-2026-07-28/platform-workspace`
- Bound weave: `weave-978b8b131c5073c373f1`

The Platform was moving while the snapshot was created. The bound hashes prove
which static evidence this clone saw; they do not make the snapshot timeless.
Run a fresh finite cycle before using it for a later task.

## Verify

```powershell
node tools/visual-mirror-platform-clone/selftest.js
python -m axm_visual_mirror capability-weave-verify --workspace intakes/visual-mirror-platform-clone-v0.7.0-2026-07-28/platform-workspace
```

Passing checks keep the clone at `TEST`. Promotion and CANON remain explicit
human decisions outside this module.
