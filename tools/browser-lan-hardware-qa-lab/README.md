# Browser, LAN & Hardware QA Lab

Status: `TEST`

The Lab runs fixed loopback browser journeys, captures bounded browser-exposed
device facts, and can save an optional physical-phone observation candidate.
The phone candidate is created only after explicit voluntary confirmation and
contains six structured yes/no observations for one bounded slot/game id. The
downstream campaign review rejects ids outside its current warning queue.

A candidate is not machine proof that a physical phone existed. It does not
authenticate the observer, modify a game manifest, clear a verifier warning,
or establish human usefulness. Complete candidates still require independent
review and the separate per-game manifest evidence gate. Incomplete candidates
remain valid stop-or-retry records.

No free-text phone notes are retained. Arbitrary URLs, silent hardware access,
network scans, forced participation, hardware-proof claims, and manifest
mutation are refused.

Run the focused checks with:

```powershell
node tools/browser-lan-hardware-qa-lab/selftest.js
node shared/operations/wave2-selftest.js
```
