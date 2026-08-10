# Hardware Research & Build Registry CLI

Compile, verify, merge, and derive evidence snapshots from inert hardware
research packages. Use `node tools/hardware-research-registry/cli.js help` for
the command list.

Without `--out`, derived JSON is printed to stdout. With `--out`, the parent
directory must already exist, its real path must remain outside the Workshop
source tree, and the target must not already exist. No command operates hardware
or approves a build.
