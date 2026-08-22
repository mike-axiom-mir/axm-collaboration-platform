# Inventory System

Status: **IMPLEMENTED AND INTEGRATED ON THE AUTHORITATIVE HOST · COMBAT CATALOGUE AND RIVAL DROPS ACTIVE**

`server/inventory-system.js` supplies the bounded inventory rules for each player actor. World creation gives every selected player—human, adapter or AI—an independent host-owned inventory. Civilian NPCs do not receive player inventories. `server/combat-gear-system.js` adds the first bounded catalogue and interprets only its declared weapon, armor and movement modifiers.

## Fixed layout

Each inventory has six equipped locations:

- `melee`
- `ranged`
- `ammo`
- `shoes`
- `body`
- `hat`

It also has exactly 12 general bag slots. The bag is a fixed array indexed `0` through `11`; empty locations contain `null`.

The shared-screen equipment grid preserves this order, placing `ammo` directly next to `ranged`:

```js
{
  hostOwned: true,
  revision: 0,
  equipment: {
    melee: null,
    ranged: null,
    ammo: null,
    shoes: null,
    body: null,
    hat: null
  },
  bag: [null, null, null, null, null, null, null, null, null, null, null, null],
  cursor: { container: "bag", index: 0 },
  selection: null
}
```

## Item contract

The machine-readable contract is `data/item-schema.json`. A minimum item instance contains:

```js
{
  id: "unique-item-instance-id",
  displayName: "Player-readable name",
  equipSlot: "melee | ranged | ammo | shoes | body | hat"
}
```

`abilities` and `statModifiers` remain validated extension seams. The combat-gear system applies only its known numeric fields; unknown modifiers remain inert. `metadata` provides identity and low-graphics visual styling but never bypasses a host rule.

Ranged weapons require an `ammoType`. Ammo requires the same kind of `ammoType` plus an integer `quantity` from 1 through 9999. A ranged weapon and equipped ammo stack may coexist only when their ammo types match.

The v0.7 catalogue contains Pulse Repeater MK II, Lantern Scatter Blaster, Undercity Arc Carbine, Street Weave Armor, Rivalbreaker Riot Plate, recovered Rival Guard Vest, Kinetic Street Boots and matched finite ammunition.

## Pickup rule

Call `pickupItem(inventory, item)` on the authoritative host.

1. The host validates and defensively copies the item.
2. A duplicate item ID is rejected.
3. If its compatible equipment slot is empty, the item auto-equips.
4. Otherwise it enters the first free bag slot.
5. If no legal equipment or bag location exists, pickup returns `inventory-full` without changing state.

An ammo pickup will not auto-equip beside an incompatible ranged weapon. It safely enters the bag instead.

The Armory sells host-created equipment instances. Downed rival roles also create short-lived authoritative drops: quick charges, matched ammunition, recoverable armor and sapper tech. ACTION collects a nearby drop; a phone never submits an item definition.

## Manual inventory API

- `setCursor(inventory, location)` moves the server-tracked UI cursor.
- `selectAtCursor(inventory)` records the selected item ID and source location.
- `placeSelectionAtCursor(inventory)` performs a validated atomic swap. A changed source produces `stale-selection` rather than moving a different item.
- `cancelSelection(inventory)` clears a selection.
- `equipFromBag(inventory, bagIndex, requestedSlot?)` equips or swaps an item.
- `unequipToBag(inventory, equipmentSlot, requestedBagIndex?)` moves equipment to an empty bag slot.
- `swapBagSlots(inventory, firstIndex, secondIndex)` reorders the bag.
- `swapLocations(inventory, firstLocation, secondLocation)` is the common validated primitive.

Locations are explicit:

```js
{ container: "equipment", slot: "ranged" }
{ container: "bag", index: 4 }
```

Every gameplay mutation is atomic and increments `inventory.revision`. Rejected operations leave the item layout unchanged.

## Controller and shared-screen behavior

The authenticated controller input contract adds four pulse intentions:

- `inventoryToggle`
- `inventoryPrev`
- `inventoryNext`
- `inventoryActivate`

The phone buttons are **INVENTORY**, **PREV**, **NEXT** and **USE / EQUIP**. For local keyboard testing, use `I`, `[`, `]` and Enter respectively. Previous/next wraps across all 18 locations: six equipment locations followed by 12 pack locations.

Activating a pack slot equips or swaps its item into its declared equipment location. Activating an equipment location moves that item to the first free pack slot. The host performs and validates the mutation; the controller sends no desired item state. While the inventory is open, that actor's movement, interaction and combat inputs are suppressed. Other players remain active.

The Party A screen displays an open inventory in the player's fixed quarter:

- Player 1 → top-left
- Player 2 → top-right
- Player 3 → bottom-left
- Player 4 → bottom-right

Only an open inventory creates a panel, and each panel occupies at most one quarter of the shared screen. The overlay covers/replaces only the owning player's quarter; it does not become a full-screen menu or stop the other players' corner status from updating. The same modulo-four mapping reserves Party B seats 5–8 for later use. In the combined view, Party A and Party B actors share their matching relative corner. The party screen remains render-only and sends no inventory input.

## Shared-screen ammo summary

The authoritative display projection derives a read-only ammo summary for every player card. It is not stored as mutable actor state and cannot be supplied by a controller.

For a designed ranged item:

- `loaded` is the quantity in the compatible equipped ammo slot;
- `reserve` is the sum of every compatible ammo stack across all 12 bag slots;
- `total` is `loaded + reserve`;
- ammo with another `ammoType` is excluded.

The HUD renders this as `loaded/total`, so `4/13` means four currently equipped rounds and thirteen compatible rounds in total, including those four. The provisional built-in pulse sidearm has no equipped ranged item and is reported as `provisional-unlimited`; its player card displays **∞**. Armory weapons use finite matched ammunition and expose their loadout name on the shared HUD.

## Ammo consumption and automatic reload

Call `consumeEquippedAmmo(inventory, amount)` only after the host validates an attack and its weapon cooldown.

- The ranged weapon and ammo stack must exist and have matching `ammoType` values.
- Insufficient ammo rejects the operation without partial consumption.
- When quantity reaches zero, the depleted stack is removed.
- The lowest-index compatible ammo stack in the bag auto-equips.
- If no compatible stack exists, the equipped ammo slot remains empty.

`autoEquipCompatibleAmmo(inventory, ammoType)` is also exported for explicit host repair/reload flows.

Projectile creation now calls this operation when the actor has an equipped ranged item. When a shot consumes the final round, the lowest-index compatible ammunition stack in the pack is equipped automatically before the next shot. If no compatible stack exists, the host emits a dry-fire effect and does not create a projectile.

The provisional built-in pulse sidearm remains an unlimited fallback so a player can never be permanently disarmed. Buying an Armory weapon replaces it with a finite-ammo loadout; depleted matching stacks still auto-reload from the pack.

The phone may request an inventory operation, but it cannot manufacture an item, directly change a slot, set ammunition quantity or apply an ability.

## Tests

`tests/inventory-system.test.js` covers layout, validation, automatic pickup/equip, duplicate/full rejection, manual swaps, cursor selection, stale selection, ammo compatibility, consumption, depletion, automatic compatible-ammo replacement and loaded/reserve/total summary calculation.

`tests/inventory-integration.test.js` covers independent inventories for all eight simulated seat actors, authenticated per-seat open/navigation/equip behavior, movement suppression, host projectile ammunition consumption, automatic replacement, dry fire, the provisional ammo-free sidearm, and the exact controller/quarter-screen UI contract.

`tests/ammo-summary-state.test.js` verifies that display serialization derives fresh, compatible totals without adding HUD-only mutable state to the actor, including an eight-actor world. `tests/shared-hud.test.js` verifies **∞** and loaded/total formatting, fixed four-corner markup, centered mission status, Party B relative corners and combined-view stacking.

`tests/combat-gear-system.test.js` verifies real weapon profiles, armor mitigation, movement gear, deterministic drops, mixed-role drills, save restoration and the code-drawn visual contract.
