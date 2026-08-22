# Ten Shared Assets — Practical Game Use Matrix

The deployment is intentionally generic so local Codex can reuse it across the eight active games without creating ten separate visual pipelines.

| Asset | Immediate gameplay uses | Useful sockets/records |
|---|---|---|
| Barrier | obstacle, checkpoint, lane control, cover, destructible street prop | collision manifest, warning-light nodes |
| Console | interaction station, shop, mission terminal, machine control | interaction socket, screen/accent nodes |
| Crate | loot, physics prop, storage, cover, delivery objective | carry/open sockets, box colliders |
| Doorway | room entrance, portal frame, checkpoint, building kit | passage/interaction positions |
| Energy Core | defense objective, power source, landmark, boss target | interaction, effect, objective sockets |
| Machine Tree | resource node, scenery, ecosystem machine, upgrade target | effect/resource anchors |
| Pickup Gem | currency, energy, score, upgrade material | pickup/effect origin |
| Terrain Platform | arena tile, bridge/floor base, modular map cell | corners, edge pieces, collision plane |
| Turret | defense, enemy, upgrade station, vehicle mount | muzzle/aim/mount sockets |
| Vehicle Chassis | delivery vehicle, enemy vehicle, modular transport | wheel/mount/cargo records |

## Best local use

Copy the prepared `AXM_ASSETS` directory into a shared project library. Let each game reference the same versioned asset instead of copying and modifying meshes invisibly. Create a new recipe/version only when geometry actually changes; visual skins should remain a separate material/style layer where possible.
