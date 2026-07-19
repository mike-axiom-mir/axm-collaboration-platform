# AXM Body Pulse v0.2

Body Pulse is the shared compute-opportunity governor for bounded automatic
Workshop processes. A module registers its goal queue, priority, active and idle
cadence, estimated body cost, local authority and promotion gate. It does not
own an independent heartbeat after integration; it asks the shared body for a
short lease.

The first rung deliberately separates four things:

1. **Presence** — a registered module may remain idle without being deleted.
2. **Compute opportunity** — a pulse lease says the body currently has room.
3. **Module-local execution** — the module may perform only its declared bounded
   candidate action.
4. **Promotion or real-world effect** — never granted by Body Pulse; any
   optional project review constitution still applies only to its selected actions.

Overall modes are `STOPPED`, `ACTIVE`, `CONSERVE` and `REST`. The body sample can
use CPU, memory, GPU and thermal signals, while leaving unavailable signals
explicitly unknown. The Windows adapter currently reads NVIDIA load and GPU
temperature through `nvidia-smi`, battery through Windows, and keeps CPU thermal
unknown because MSI Center exposes no supported read-only sensor value here.
Red pressure refuses new leases. Conserve mode holds work
below priority 70. Capacity is global, so two modules cannot each assume the
whole machine is available.

Request state has four different meanings: paused remains actionable but cannot
receive work; completed/cancelled moves to the visible archive; permanent forget
removes the goal plus goal-linked pulse receipts and events; produced assets,
code, products and other outputs are outside that deletion boundary. Archive
count and approximate storage are visible so retained history cannot grow for
months unnoticed. Automatic age deletion remains opt-in rather than silently
destroying someone else's history.

The service starts stopped after a fresh install. A future persistence policy may
resume approved queues after restart, but v0.2 requires an explicit overall mode.
