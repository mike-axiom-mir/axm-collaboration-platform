# Evidence routes

Status: `TEST`

| Claim | Native proof surface and pass condition | Counterevidence / boundary |
|---|---|---|
| A checkpoint binds one exact complete v2.5 history | Exact-rebuild every stored proposal and settlement from deduplicated caller packages, require equal bracketing snapshots, and compare all stored references | Equal reads are not an atomic filesystem snapshot and cannot exclude an intermediate change that reverts |
| Pending state is represented without advancing the head | Checkpoint one trailing proposal with no settlement and require its proposal reference plus unchanged settled head | Portable data does not settle, adopt, or authorize the pending pin |
| A later audit detects relative continuity outcomes | Exercise exact, pending-to-settled forward extension, strict rollback, replacement/fork, identity drift, absence, and invalidity with closed classifications | Findings are relative only to the exact caller-presented checkpoint |
| Origin and audit packages rebuild in fresh processes | Run checkpoint, audit, and verification from separate Node.js processes and compare exact receipts | Fresh local processes do not prove another host, independent controller, or external retention |
| The adapter makes no durable ledger change | Hash the complete v2.5 root before and after checkpoint and audit, inspect source for no direct filesystem API, and assert the composed v2.5 transient lock is declared | Byte-identical end state does not mean zero writes: v2.5 creates and removes its fixed operation lock |
| Replacement limits remain visible | Show original checkpoint detects a divergent valid root, then show a jointly replaced checkpoint and root form another exact relative history | Withholding or replacing both sides removes the original comparison boundary |
| Public artifacts are minimized | Scan checkpoint and audit receipts for raw keys, signatures, private keys, configured paths, raw upstream packages, model output, and private context | Exact v2.5 rebuild packages remain transient caller inputs |
| Broader grounded-growth authority remains open | Capability comparison, truth fields, contract refusals, joint-replacement and non-atomicity counterexamples | No authenticated origin, external retention, protected monotonic state, rollback prevention, global consistency, provider execution, evaluation, benefit, learning, merge, or `CANON` evidence |

Browser render/click evidence is not applicable to this nonvisual Node.js adapter.
