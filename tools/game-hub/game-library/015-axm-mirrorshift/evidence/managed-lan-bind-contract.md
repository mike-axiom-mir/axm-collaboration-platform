# Managed LAN bind capability contract

```text
capability_id: transport.managed-lan-bind
purpose: Make the controller URLs advertised by AXM Game Hub reachable on the host's LAN interfaces without exposing an ordinary standalone development launch by default.
inputs and schemas: Process environment containing AXM_MANAGED_BY_GAME_HUB=1 and optional explicit HOST; existing managed launcher, health, controller, session, heartbeat, and action routes.
outputs and schemas: Managed launch resolves its bind host to 0.0.0.0; standalone launch resolves to 127.0.0.1; an explicit HOST always wins; /health declares the active bind policy.
side effects: Changes only the TCP listen interface selected at process start. It does not alter roster, simulation, input, reconnect, telemetry, qualification, privacy, or physical attestation state.
permissions and consent: Game Hub already advertises private-LAN controller URLs and marks the package supports_lan_link=true. Ordinary direct npm start remains loopback-only unless the operator explicitly overrides HOST.
resource budget: No new dependency, timer, storage, network request, or retained identifier.
failure and recovery behavior: Bind failures remain normal Node listen errors; an explicit HOST can narrow the interface; restarting the managed child reapplies the deterministic policy.
compatibility/version contract: Package 0.14.0; managed launch environment v1; existing controller and qualification schemas unchanged.
verification contract: Deterministic host-resolution assertions, real socket listen on 0.0.0.0, loopback health probe, and a same-machine private-interface health probe when a private IPv4 interface exists.
promotion gate: This capability may be READY after held-out and full regression evidence. The same-machine probe proves interface binding only; qa.physical-four-phone-lan remains UNKNOWN until four real phones complete the externally observed 30-minute intended-router run.
```
