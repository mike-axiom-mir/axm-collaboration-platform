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
deterministic checks per rolling hour. It records repair
findings but has no file-editing authority.
