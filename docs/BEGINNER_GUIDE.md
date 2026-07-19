# AXM Workshop Beginner Guide

You do not need to understand Git branches, terminals, or AI configuration to
try the core Workshop.

## Windows

1. On the repository page, select **Code > Download ZIP**.
2. Open Downloads, right-click the ZIP, and select **Extract All**.
3. Open the extracted `axm-collaboration-platform` folder.
4. Double-click `OPEN_AXM_WORKSHOP.cmd`.
5. Keep the server window open while using AXM.

The launcher checks whether it is still inside a ZIP, finds a bundled portable
Node runtime when present, falls back to an installed Node.js LTS, waits for the
Hub to become healthy, and then opens the correct browser address.

## macOS or Linux

Open a terminal in the extracted folder and run:

```sh
chmod +x start-hub.sh
./start-hub.sh
```

## Common problems

### I see code instead of the Hub

You opened the launcher on GitHub or inside the ZIP. Download the complete ZIP,
extract it, and launch the file from the extracted folder.

### Windows says Node.js is missing

Install the current [Node.js LTS](https://nodejs.org/en/download), close the
message window, and double-click `OPEN_AXM_WORKSHOP.cmd` again. The core Hub
does not require `npm install`.

### The browser did not open

Leave the server window open and visit <http://127.0.0.1:8788/hub/index.html>.
If that page does not load, copy only the non-sensitive error text from the
server window into a Bug report.

### The port is already in use

An earlier AXM server may still be open. Return to its browser tab or close the
old server window and launch once more. Avoid starting several full Workshop
stacks at the same time on a small laptop.

### Do I need an AI account?

No. AI connections are optional. The local Hub, tools, documentation, and
included test experiences can be explored without an AI provider account.

## Stopping safely

Close the server window when you are finished. Workspaces that implement saved
state keep that state in their declared local boundary; public source packages
do not contain your local saves or history.

## Asking for help

Use the repository's Bug report template. Say what you clicked, what you
expected, and what appeared. Screenshots are helpful after you crop private
tabs, names, tokens, and personal data.
