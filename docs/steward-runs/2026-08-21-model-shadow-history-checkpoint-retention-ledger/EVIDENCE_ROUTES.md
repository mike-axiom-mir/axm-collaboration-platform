# Evidence routes

Status: `TEST`

| Claim | Native proof surface and pass condition | Counterevidence / boundary |
|---|---|---|
| One exact v2.6 checkpoint is durably proposed in a distinct local root | Compare resolved roots, exact-rebuild the checkpoint origin, exclusive-create and file-fsync the proposal, restart, and reload the exact embedded checkpoint | Same host and caller control both roots; this is not independent external retention |
| Retention settlement is a separate local act | Require the exact original proposal package plus a different exact confirmation, then derive the settled head only from matching settlement records | Confirmation text authenticates no host, actor, human, organization, or policy authority |
| Retained checkpoint succession is forward-only | For every post-genesis proposal, audit the settled checkpoint against the candidate source and require `FORWARD_HISTORY_EXTENSION`; reject exact replay, rollback, fork, identity drift, absence, and invalidity | The first retained checkpoint has no earlier local anchor, and other withheld roots remain possible |
| Pending observations remain usable without becoming settled authority | Persist the full checkpoint in the proposal, select the latest persisted proposal for audit, and bind `PENDING` versus `SETTLED` status in the audit receipt | A pending observation is not adoption, approval, or a settled retention head |
| Source rollback or absence remains observable while the retention root survives | Retain a settled-source checkpoint, restore an earlier source copy or present an absent source, then audit from a fresh service without caller re-presenting the checkpoint | Replacing or deleting both source and retention roots removes the original comparison boundary |
| Complete retained state reloads fail closed | Parse exact canonical JSON, require closed records, contiguous names, self-digests, chain references, embedded v2.6 validation, at most one pending proposal, and a fixed exclusive operation lock | File fsync proves neither directory-entry nor hardware/power-loss durability |
| Source durability claims remain bounded | Hash the complete source root before and after retention operations and declare composed v2.5 transient-lock writes | Byte-identical durable source state does not mean zero transient source writes |
| Public artifacts are minimized | Scan manifest, proposal, settlement, snapshot, and audit artifacts for configured paths, raw upstream packages, keys, signatures, private keys, model output, and private context | The full v2.6 checkpoint is deliberately retained; exact origin packages remain transient caller inputs |
| Broader grounded-growth authority remains open | Capability comparison, truth fields, contract refusals, pending-state distinction, and joint two-root replacement counterexample | No authenticated origin, external retention, protected monotonic state, rollback prevention, global consistency, provider execution, evaluation, benefit, learning, merge, or `CANON` evidence |

Browser render/click evidence is not applicable to this nonvisual Node.js adapter.
