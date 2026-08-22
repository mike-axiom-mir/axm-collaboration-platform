# AXM District Party economy

## Implemented v0.1.4 rule

Every successful mission reward is a gross amount per selected actor. The authoritative host splits each actor's gross reward into:

- **40% personal fund** — used for that actor's city weapons, protection, bodyguards, gang cars, roadblocks and optional casino play.
- **60% party fund** — credited to that actor's party treasury for future territory, squads, defence and other collective decisions.

The split uses integer cents and always preserves the gross total. Party A and Party B have completely separate treasuries. Slots 1–4 can only contribute to `party_a`; slots 5–8 can only contribute to `party_b`.

Example for a four-person Party A completing Hold the Relay:

| Value | Credits |
| --- | ---: |
| Gross reward per player | DC 25,00 |
| Personal 40% per player | DC 10,00 |
| Party contribution 60% per player | DC 15,00 |
| Total Party A treasury increase | DC 60,00 |

## Host authority

The host owns both balances and provides central operations for split rewards, direct party income, personal spending and party spending. Clients cannot submit a final balance or claim that a purchase succeeded. Invalid parties, insufficient funds, invalid amounts and cap overflow are handled centrally.

The shared screen shows each actor's personal fund in their existing corner and one party-fund total in the central mission HUD. Each phone shows both its personal balance and its own party treasury. Results explicitly show the gross reward, 40% personal cut and 60% party contribution.

## Current limits

- Funds remain session-only until the local profile/save layer exists.
- Free-roam now has an Armory and Crew Garage UI for weapon/protection upgrades, bodyguards, armored gang cars and roadblocks. District Dominion keeps its separate party-funded reinforcement purchase. A complete buy/sell catalogue and persistent upgrade format do not exist yet.
- The spending operations are implemented and tested as host seams, but no gameplay feature calls them yet.
- Territory-mode match fairness still needs a host choice between persistent campaign funds and an equal temporary war chest.
- Party-fund proposals or teammate approval voting are not implemented yet.

Recommended later rule: small personal purchases use only the player's fund. Large territory actions use only the party fund and require a second teammate confirmation; solo play confirms automatically.
