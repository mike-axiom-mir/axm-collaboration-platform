# Evidence routes

Status: `TEST`

| Claim | Native proof surface and pass condition | Counterevidence / boundary |
|---|---|---|
| Explicit local persistence is real | Create files beneath one configured temporary root, restart in a fresh process, reload, and compare exact snapshot and stored digests | One local root is not independent external retention or protected storage |
| Proposal does not move the settled pin head | Persist a valid v2.4 successor proposal, restart, and observe unchanged head plus one pending proposal | A proposal and confirmation string do not prove review or authority |
| Separate settlement advances only the local derived head | Exact-rebuild the pending proposal package, require a separate settlement call, exclusive-create settlement, restart, and observe successor head | Local settlement grants no provider execution, adoption, promotion, or global authority |
| Concurrent writers cannot both occupy one sequence | Launch two fresh processes against the same empty root and require exactly one proposal success | Independent roots can still accept divergent successors |
| Corrupt, missing, noncanonical, linked, or noncontiguous state fails closed | Tamper a copied root and assert typed inspection failure without automatic repair | Replacing or deleting the whole root together remains locally invisible |
| File write durability is bounded | Source inspection and injected tests prove exclusive create, canonical bytes, file `fsync`, close, and restart reload | No directory-entry, hardware, power-loss, remote replication, or long-horizon durability proof |
| Public artifacts are minimized | Receipt scans exclude raw keys, signatures, private keys, configured paths, model output, and private context | Caller-supplied v2.4 rebuild packages remain in memory and are not persisted by this ledger |
| Broader grounded-growth authority remains open | Capability comparison, truth fields, contract refusals, independent-root and deletion counterexamples | No authenticated pin, host, human review, protected monotonic state, rollback prevention, global consistency, provider execution, evaluation, benefit, learning, merge, or `CANON` evidence |

Browser render/click evidence is not applicable to this nonvisual local Node.js storage adapter.
