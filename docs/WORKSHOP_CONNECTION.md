# Workshop connection

Mirror remains a separate process and research body at
`C:\AXM_MIRROR_LOCAL`. The live AXM Workshop knows it through three bounded
seams:

1. Mirror sends a finite presence heartbeat to `/api/presence/heartbeat`.
2. The Workshop exposes `/services/mirror-native/*` as a same-origin proxy and
   injects Mirror's bearer token on the server side.
3. AXMConnect registers `mirror-kernel` last, so it is selectable but cannot
   silently replace a working language provider.

The browser never receives `state/runtime-token.txt`. Mirror is not started by
the Workshop and remains honestly offline when its process is stopped.

This is separate from the older `shared/mirror-core` isolated experiment on
port 8799. Mirror Native Seed-0 defaults to port 8818 because ports 8792-8798
belong to the modular game runtimes.
