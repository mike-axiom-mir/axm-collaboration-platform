# Steam depot candidate evidence route

Status: **TEST** · no upload performed

This route separates what an isolated local candidate can prove from what
still requires Steamworks, a clean machine, hardware, or human judgment.

## Claims and proof surfaces

| Claim | Risk | Pass condition | Native evidence | Current boundary |
|---|---|---|---|---|
| Candidate contains the declared GameHub runtime only | medium | every staged file is allowlisted, hashed, and no undeclared file exists | parsed content contract + staged manifest re-hash | locally provable |
| Candidate excludes known secrets and personal machine paths | high | denylisted names and high-confidence secret/path signatures produce zero findings | independent staged-tree scan + manifest inventory | locally provable; cannot prove an unknown secret pattern does not exist |
| Bundled runtime starts from outside the Workshop tree | medium | staged `runtime/node/node.exe` starts the staged launcher and both health identities pass | fresh child process rooted in isolated candidate | locally provable |
| Staged shell is visibly usable | medium | 19-game shell renders, TEST boundary is visible, one game can enter active play, and return is recoverable | live in-app browser journey against isolated candidate | locally provable after observation |
| Player/server state avoids the install directory | high | state-writing games receive paths under the declared application-data root and candidate hashes remain unchanged after play | process environment contract + before/after candidate digest + external state receipt | locally provable for exercised games; remaining games require scoped checks |
| Steam download/install/update works | high | Steam client installs a private branch on a separate clean Windows account/device and relaunches after update | Steamworks branch + clean-machine observation | **UNKNOWN until account/App ID/build exist** |
| Final store/build are acceptable | high | Mike approves assets/content and Valve approves store and build reviews | human and Steamworks review records | **external gate** |

## Capability route

- `READY`: local file staging, hashing, denylist scanning, bundled-Node launch,
  HTTP authorization probes, and browser interaction.
- `DEGRADED`: an isolated folder is a strong depot-shape test but is not a
  Steam-client installation or update.
- `MISSING AUTHORITY`: account creation, fee payment, App/Depot IDs, uploads,
  branch publication, pricing, and release decisions remain with Michaela,
  Mike, and Valve.
- `MISSING SUBSTRATE/EVIDENCE`: clean secondary Windows account/device and
  physical phone/gamepad testing have not been supplied to this run.
