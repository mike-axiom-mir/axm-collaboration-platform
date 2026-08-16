# AXM Platform Heartbeat v0.2

Platform Heartbeat is the shared timing organ above Body Pulse.

- Heartbeat answers **when and how often** eligibility is checked.
- Body Pulse answers **how many bounded opportunities** may be granted.
- Gates answer **whether an eligible opportunity may proceed**.
- Organs own their declared candidate actions.
- Receipts record what actually occurred.

Mike explicitly authorized the first experimental profile to start and resume
at one beat per hour while the local AXM server is running. Scheduled and manual
beats emit `axm.platform-heartbeat.beat/v1` receipts with `TIME_SIGNAL_ONLY`
authority. A separate gated verification bridge may consume scheduled beats;
the beat itself requests no pulse and activates no action.

The separate Code Clone draft bridge is now packaged dormant after evidence
showed that five repetitive completeness drafts cost more machine time and
review attention than they returned. The fourteen existing candidates remain
preserved in the shared review inbox. If a steward explicitly re-enables the
Body Pulse module later, the bridge may create at most one candidate per
rolling hour. It reads Workshop source, copies only an allow-listed repair
surface into `exports/mirror-code-clone/candidates/`, verifies the candidate,
proves the source bytes stayed unchanged, and submits the exact candidate
digest to the shared review inbox. It never applies a patch. Manual timing
receipts do not create drafts.

Draft review items persist while Mike is away and leave the active queue on the
first scheduled beat at or after seven days. Their candidate files, hashes,
votes, and expiry evidence remain available rather than being silently deleted.
An unchanged source digest is drafted only once, so hourly beats cannot flood
the queue with duplicates. A changed source digest may produce a new draft.
If the server restarts during a draft window, startup clears the stale running
flag and records an `INTERRUPTED` run receipt. Already-seen source fingerprints
remain deduplicated, no source is rolled forward automatically, and the Body
Pulse screen exposes the most recent draft-window receipts beside the queue.

The cadence can optionally be anchored to an explicit local date and time from
the Body Pulse screen. The browser converts that choice to an ISO timestamp;
the deterministic core schedules the first matching beat and repeats from that
anchor. Saving a schedule never emits a beat immediately. Clearing the anchor
restores the original interval-from-change behavior.

On the first integrated start only, that explicit authorization places Body
Pulse in `CONSERVE` and registers the enabled `heartbeat-verifier` module. All
other registered modules remain disabled. If a steward later stops Body Pulse,
restart does not silently re-arm it.

Missed beats coalesce into one receipt rather than bursting after sleep. The
pure core accepts an injected clock, so cadence and coalescing are deterministic
under test. The Node service owns the one shared timer; organs must not create
private scheduling loops. After the first five-check window completed in 2.3
seconds, Mike explicitly raised the verification bridge to ten allow-listed
deterministic checks per rolling hour. Two different ten-check windows then
passed 10/10 in 2.25 and 3.77 seconds. Mike explicitly authorized the next
gradual step to fifteen allow-listed deterministic checks per rolling hour.

Each window is retained in `state/platform-heartbeat/verification.json` as a
bounded evidence receipt containing the beat ID, named check, status, exit
code, duration, diagnostic summary, and bounded Body Pulse pressure samples.
Body Pulse also retains one completion receipt per granted test. Duration is
wall-clock process-window evidence, not CPU time. Peak and sampled-average CPU
claims are available only when the run contains actual pressure samples. These
receipts prove only the named deterministic check at that time. The verifier
may record findings, but it has no file-editing or promotion authority.

The reviewed observatory adapter adds the eighteen integrated intake modules to
the rotating deck. Each candidate is a fixed Node command over one module
`selftest.js`; arbitrary shell synthesis is impossible. Before execution, the
adapter verifies the module's `TEST` status and a reviewed SHA-256 digest over
its JavaScript and JSON execution surface. The
`sha256-canonical-text-lf-v1` contract normalizes only CRLF checkout bytes to
LF before hashing, matching Git's canonical text form on Windows and Unix;
all other bytes remain digest-significant. Unknown modules, changed digests,
missing selftests, symlinks or junctions, and non-`TEST` status fail closed.
Joining the deck adds verification evidence only: repair, permission, network,
promotion, publishing, and CANON authority remain absent.

The Code Clone bridge is a different authority lane from the verifier. It may
write candidate files and review submissions only. Workshop source, pure
Mirror, shared Mirror Core, the museum original, apply, install, promotion,
publishing, GitHub, networking, and CANON remain outside its authority.

A separate Mirror lesson bridge is prepared but **off by default**. It creates
no private timer and listens only to scheduled hourly Heartbeat receipts. Later
operation requires three independent gates: the lesson lane must be explicitly
enabled, Body Pulse must explicitly enable and lease `mirror-learning-forge`,
and Mirror Native's private Workshop action feed must already be explicitly
opted in by a human steward. The bridge never changes any of those gates itself.

When all gates are open, the lane may admit at most one previously unseen Code
Clone outcome per rolling hour. The outcome must already have two independent
Review Inbox approvals for the exact candidate digest. Only attributed receipt
facts enter Mirror's private lesson corpus; candidate paths, code, prompts and
raw outputs are excluded. Corpus admission does not train weights or challengers
and grants no source-write, original-Mirror, Code-Clone, apply, CANON, promotion,
publishing or network authority.

The rolling-hour guard permits up to one second of scheduler jitter so an
on-time anchored beat is not skipped merely because its timer is observed a few
milliseconds early. Beats substantially earlier than one hour remain held.

Heartbeat organs enter the shared Body Pulse lane in a fixed order:
verification, Code Clone drafts, the dormant-by-default Mirror lesson bridge,
then the dormant-by-default updater. This
prevents two bounded organs from racing for the single-machine lease while
preserving a contained receipt when one organ fails.
