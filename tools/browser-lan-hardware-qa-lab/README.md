# Browser, LAN & Hardware QA Lab

Status: `TEST`

The Lab runs fixed loopback browser journeys, captures bounded browser-exposed
device facts, and can save an optional physical-phone observation candidate.
The phone candidate is created only after explicit voluntary confirmation and
contains six structured yes/no observations for one bounded slot/game id. The
downstream campaign review rejects ids outside its current warning queue.

Version `v0.3` can explicitly send the latest candidate's exact native digest
to the existing Review Inbox. A read-only handoff then derives the campaign's
five-field review input only when the latest exact-digest vote is attributed
as human. Machine, collective, and unknown reviewer kinds remain
non-exportable. Review notes stay in the generic inbox record and are never
copied into the phone campaign handoff.

A candidate is not machine proof that a physical phone existed. It does not
authenticate the observer, modify a game manifest, clear a verifier warning,
or establish human usefulness. Review acceptance only advances the campaign's
candidate-review state. Complete candidates still require the separate
per-game manifest evidence gate. Incomplete candidates remain valid
stop-or-retry records even if someone selects approve in the generic inbox.

No free-text phone notes are retained. Arbitrary URLs, silent hardware access,
network scans, forced participation, hardware-proof claims, and manifest
mutation are refused.

Run the focused checks with:

```powershell
node tools/browser-lan-hardware-qa-lab/selftest.js
node shared/operations/wave2-selftest.js
```
