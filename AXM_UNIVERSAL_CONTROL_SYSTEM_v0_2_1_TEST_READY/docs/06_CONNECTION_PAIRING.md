# 6. Connection and pairing design

## Local-first path

The reference server:

- listens on the PC's local network;
- prints host and phone URLs;
- creates or accepts a six-digit pairing code;
- accepts up to four phone controllers;
- assigns controllers to explicit player slots;
- forwards full semantic action frames;
- sends neutral input on close, stale timeout, and replacement;
- requires no cloud service.

## Identity and resume

Each phone keeps a random local `deviceId`. On first successful pairing the server issues a private random resume token. A later connection may reclaim the previous player seat only when the device ID and resume token match the retained lease. A request for another player slot does not override a valid previous lease.

This prevents a simple page reload from becoming another player while avoiding permanent accounts or cloud identity.

## Stale-controller watchdog

A connected phone must continue sending valid frames. When it becomes silent past the configured timeout, the host:

1. emits a full neutral semantic frame;
2. reports a visible `stale-timeout` disconnect reason;
3. closes the dead connection;
4. retains the short-lived seat lease for a genuine resume.

## Input-frame safety

The host rejects:

- malformed JSON;
- wrong protocol/type;
- oversized frames;
- unmasked client WebSocket frames;
- duplicate action IDs;
- unknown semantic action IDs;
- non-finite values;
- invalid sequence, device, player, or context fields.

Rejected frames do not reach game behavior.

## Security boundary

The code and token reduce accidental or casual cross-control. Plain local HTTP/WebSocket does not encrypt traffic from a hostile device already on the LAN. Production deployment should add local HTTPS/WSS or another authenticated local tunnel before claiming confidentiality.

## QR design

A future QR may encode only the local controller URL and pairing code. No cloud token or personal information is required. QR rendering remains unimplemented in v0.2; six-digit pairing works.
