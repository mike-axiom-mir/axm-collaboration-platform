# AXM Discord Bridge v0.1

An optional, local-first doorway between the AXM Workshop and one Discord server.

## What it does

- registers `/axm status`, `/axm propose`, and `/axm pause` as guild-scoped commands;
- stores attributed proposals in a local human-review queue;
- can post deliberately sanitized completed/failed `axm.action/v1` receipts;
- exposes a visible local pause and separate permission switches.
- offers the public AXM server widget behind an explicit browser-side load button.

## What it deliberately cannot do

- read ordinary Discord messages or request the Message Content intent;
- expose the bot token back to the browser;
- post raw prompts, inputs, action outputs, secrets, or automatic mentions;
- turn a Discord proposal into training data or executable work;
- reconnect automatically after a Workshop restart.

## Owner setup

1. Start the Workshop using `START_AXM_FULL.bat`.
2. Open **Discord Bridge** from the Hub.
3. In <https://discord.com/developers/applications>, create `AXM Workshop Bridge`.
4. Copy the Application ID and a newly reset bot token into the local setup screen.
5. In Discord, enable Developer Mode, then copy the AXM Workshop server ID and target channel ID.
6. Use the generated install link. It requests only View Channel, Send Messages, and slash-command installation.
7. Choose each lane, then press **Connect now**.

Permanent AXM Workshop community invite: <https://discord.gg/sGHMxFkKhs>

All private state is stored in `state/discord-bridge/`. Workshop public packaging excludes `state/`, so credentials and local community records are not shipped.
