# AXM dependency and offline-install policy

As of 2026-07-23, `package.json` declares three direct packages and `package-lock.json` pins the resolved dependency graph. The supported Node range is `>=20 <25`; the current verified workstation runs Node 24.

The core Hub and most Workshop modules do not require `npm install` at runtime. Source checkouts that need the declared packages should use `npm ci`, which follows the lockfile exactly. `npm ci --offline` is valid only when the required package tarballs already exist in the local npm cache; the Workshop does not pretend that the lockfile itself is an offline package cache.

No dependency is downloaded automatically by verification, startup, or the tool index. `npm audit` requires network access or a maintained advisory source and is therefore an explicit operator action, not a hidden verify step. Vendoring the three dependency trees is deferred until licensing, update, and integrity ownership are defined; copying whole libraries merely to clear an offline warning is not allowed.
